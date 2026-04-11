import Elysia, { t } from "elysia";
import { db } from "../db";
import { cards, comments, statuses, repos, features, cardDependencies, epics, workflowStatuses } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { wsManager } from "../wsManager";
import { currentCheckedOutBranch, git, worktreePath } from "../git";
import { nowIso } from "../helpers/db";
import { serializeCard, serializeCardWithComments } from "../helpers/presenters";
import { nextCardRefNum } from "../db";

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Applies a patch to a card, re-fetches it, broadcasts card:updated, and
 * returns the updated row. Throws if the card is not found after the update.
 */
function updateCardAndBroadcast(id: string, patch: Record<string, unknown>) {
  db.update(cards).set(patch).where(eq(cards.id, id)).run();
  const updated = db.select().from(cards).where(eq(cards.id, id)).get();
  if (!updated) throw new Error("Not found");
  wsManager.broadcast("card:updated", updated);
  return updated;
}

export const cardRoutes = new Elysia({ prefix: "/cards" })
  // List cards, optional ?status= and ?unblocked= filters
  .get(
    "/",
    ({ query }) => {
      let allCards = query.status
        ? db.select().from(cards).where(eq(cards.statusId, query.status)).all()
        : db.select().from(cards).all();

      if (query.unblocked === "true") {
        // Find "Done" status id
        const doneStatus = db.select().from(statuses).all().find((s) => s.name.toLowerCase() === "done");
        const doneStatusId = doneStatus?.id;

        // Fetch all card_dependencies
        const allDeps = db.select().from(cardDependencies).all();

        // Build a lookup of all cards by ID for efficient blocker status checks
        const allCardsList = db.select().from(cards).all();
        const cardById = Object.fromEntries(allCardsList.map((c) => [c.id, c]));

        // For each dependency, if the blocker is not Done, mark the blocked card as having active blockers
        const cardIdsWithActiveblockers = new Set<string>();
        for (const dep of allDeps) {
          const blocker = cardById[dep.blockerCardId];
          if (blocker && blocker.statusId !== doneStatusId) {
            cardIdsWithActiveblockers.add(dep.blockedCardId);
          }
        }

        allCards = allCards.filter((c) => !cardIdsWithActiveblockers.has(c.id));
      }

      return allCards.map(serializeCard);
    },
    {
      query: t.Optional(
        t.Object({
          status: t.Optional(t.String()),
          unblocked: t.Optional(t.String()),
        })
      ),
    }
  )
  // Claim a card — sets agentId and optionally auto-advances from To Do → In Progress
  .post(
    "/:id/claim",
    ({ params, body }) => {
      const card = db.select().from(cards).where(eq(cards.id, params.id)).get();
      if (!card) throw new Error("Not found");

      const now = nowIso();
      const patch: Record<string, unknown> = { agentId: body.agentId, updatedAt: now };

      // Auto-advance: if card is currently "To Do", move it to "In Progress"
      if (body.autoAdvance !== false) {
        const currentStatus = db.select().from(statuses).where(eq(statuses.id, card.statusId)).get();
        if (currentStatus?.name.toLowerCase() === "to do") {
          const inProgress = db.select().from(statuses).all().find(
            (s) => s.name.toLowerCase() === "in progress"
          );
          if (inProgress) patch.statusId = inProgress.id;
        }
      }

      return serializeCard(updateCardAndBroadcast(params.id, patch));
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        agentId: t.String(),
        autoAdvance: t.Optional(t.Boolean()),
      }),
    }
  )
  // Cards completed today (local date prefix match on completed_at)
  .get("/completed-today", () => {
    const today = localDateKey(new Date());
    return db
      .select()
      .from(cards)
      .all()
      .filter((card) => card.completedAt && localDateKey(new Date(card.completedAt)) === today)
      .map(serializeCard);
  })
  // Get single card with comments
  .get(
    "/:id",
    ({ params }) => {
      const card = db
        .select()
        .from(cards)
        .where(eq(cards.id, params.id))
        .get();
      if (!card) throw new Error("Not found");
      const cardComments = db
        .select()
        .from(comments)
        .where(eq(comments.cardId, params.id))
        .all();
      return serializeCardWithComments(card, cardComments);
    },
    { params: t.Object({ id: t.String() }) }
  )
  // Create card
  .post(
    "/",
    ({ body, set }) => {
      const feature = db.select().from(features).where(eq(features.id, body.featureId)).get();
      if (!feature) {
        set.status = 400;
        return { error: "Feature not found" };
      }
      const id = randomUUID();
      const now = nowIso();
      const row = {
        id,
        refNum: nextCardRefNum(),
        featureId: body.featureId,
        epicId: feature.epicId,
        type: body.type ?? "task",
        title: body.title,
        description: body.description ?? "",
        statusId: body.statusId,
        agentId: body.agentId ?? null,
        plan: body.plan ?? null,
        latestUpdate: body.latestUpdate ?? null,
        handoffSummary: body.handoffSummary ?? null,
        blockedReason: body.blockedReason ?? null,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(cards).values(row).run();
      const created = db
        .select()
        .from(cards)
        .where(eq(cards.id, id))
        .get()!;
      wsManager.broadcast("card:created", created);
      return serializeCard(created);
    },
    {
      body: t.Object({
        title: t.String(),
        statusId: t.String(),
        featureId: t.String(),
        type: t.Optional(
          t.Union([t.Literal("story"), t.Literal("bug"), t.Literal("task")])
        ),
        description: t.Optional(t.String()),
        agentId: t.Optional(t.String()),
        plan: t.Optional(t.String()),
        latestUpdate: t.Optional(t.String()),
        handoffSummary: t.Optional(t.String()),
        blockedReason: t.Optional(t.String()),
      }),
    }
  )
  // Update card
  .patch(
    "/:id",
    ({ params, body }) => {
      const now = nowIso();

      // Determine completedAt: stamp when moving to Done, clear when moving away
      let completedAt: string | null | undefined = undefined;
      if (body.statusId) {
        const status = db.select().from(statuses).where(eq(statuses.id, body.statusId)).get();
        if (status) {
          completedAt = status.name.toLowerCase() === "done" ? now : null;
        }
      }

      const patch: Record<string, unknown> = { ...body, updatedAt: now };
      if (completedAt !== undefined) patch.completedAt = completedAt;

      const updated = updateCardAndBroadcast(params.id, patch);

      // Check for merge conflicts when moving to a triggersMerge status
      if (body.statusId && updated.branchName && updated.repoId) {
        const epic = updated.epicId
          ? db.select().from(epics).where(eq(epics.id, updated.epicId)).get()
          : null;
        if (epic?.workflowId) {
          const ws = db.select().from(workflowStatuses)
            .where(and(
              eq(workflowStatuses.workflowId, epic.workflowId),
              eq(workflowStatuses.statusId, body.statusId)
            ))
            .get();
          if (ws?.triggersMerge) {
            const repo = db.select().from(repos).where(eq(repos.id, updated.repoId)).get();
            const feature = updated.featureId
              ? db.select().from(features).where(eq(features.id, updated.featureId)).get()
              : null;
            const targetBranch = feature?.branchName ?? repo?.baseBranch;
            if (repo && targetBranch) {
              const baseResult = git(["merge-base", targetBranch, updated.branchName], repo.path);
              const base = baseResult.stdout.trim();
              if (base) {
                const mergeTreeResult = git(
                  ["merge-tree", base, targetBranch, updated.branchName],
                  repo.path
                );
                const hasConflicts = mergeTreeResult.stdout.includes("<<<<<<<");
                if (hasConflicts) {
                  db.update(cards)
                    .set({ conflictedAt: nowIso(), conflictDetails: mergeTreeResult.stdout })
                    .where(eq(cards.id, params.id))
                    .run();
                  const conflicted = db.select().from(cards).where(eq(cards.id, params.id)).get()!;
                  wsManager.broadcast("card:conflicted", conflicted);
                } else {
                  // Clear any previous conflict state
                  db.update(cards)
                    .set({ conflictedAt: null, conflictDetails: null })
                    .where(eq(cards.id, params.id))
                    .run();
                }
              }
            }
          }
        }
      }

      // If card was moved to Done, check if any blocked-by-this-card cards are now fully unblocked
      if (body.statusId) {
        const newStatus = db.select().from(statuses).where(eq(statuses.id, body.statusId)).get();
        if (newStatus?.name.toLowerCase() === "done") {
          const doneStatusId = newStatus.id;
          // Find all cards that were blocked by this card
          const blockedByThis = db.select().from(cardDependencies)
            .where(eq(cardDependencies.blockerCardId, params.id)).all();

          for (const dep of blockedByThis) {
            // Check if ALL blockers of that card are now Done
            const allBlockers = db.select().from(cardDependencies)
              .where(eq(cardDependencies.blockedCardId, dep.blockedCardId)).all();
            const allDone = allBlockers.every((b) => {
              if (b.blockerCardId === params.id) return true; // just marked done
              const blockerCard = db.select().from(cards).where(eq(cards.id, b.blockerCardId)).get();
              return blockerCard?.statusId === doneStatusId;
            });
            if (allDone) {
              wsManager.broadcast("card:unblocked", { cardId: dep.blockedCardId });
            }
          }
        }
      }

      return serializeCard(updated);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Partial(
        t.Object({
          title: t.String(),
          description: t.String(),
          statusId: t.String(),
          agentId: t.String(),
          featureId: t.Union([t.String(), t.Null()]),
          epicId: t.Union([t.String(), t.Null()]),
          type: t.Union([
            t.Literal("story"),
            t.Literal("bug"),
            t.Literal("task"),
          ]),
          plan: t.Union([t.String(), t.Null()]),
          latestUpdate: t.Union([t.String(), t.Null()]),
          handoffSummary: t.Union([t.String(), t.Null()]),
          blockedReason: t.Union([t.String(), t.Null()]),
          conflictedAt: t.Optional(t.Union([t.String(), t.Null()])),
          conflictDetails: t.Optional(t.Union([t.String(), t.Null()])),
        })
      ),
    }
  )
  // Delete card
  .delete(
    "/:id",
    ({ params }) => {
      db.delete(cards).where(eq(cards.id, params.id)).run();
      wsManager.broadcast("card:deleted", { id: params.id });
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  )
  // Get diff for a card's branch vs the repo's currently checked-out branch (fallback: repo base branch)
  .get(
    "/:id/diff",
    ({ params, query, set }) => {
      const card = db.select().from(cards).where(eq(cards.id, params.id)).get();
      if (!card) throw new Error("Not found");

      if (!card.branchName) {
        set.status = 400;
        return { error: "Card has no branch" };
      }

      if (!card.repoId) {
        set.status = 400;
        return { error: "Card has no repo associated" };
      }

      const repo = db.select().from(repos).where(eq(repos.id, card.repoId)).get();
      if (!repo) {
        set.status = 400;
        return { error: "Card has no repo associated" };
      }

      const baseBranch = query.baseBranch ?? currentCheckedOutBranch(repo.path) ?? repo.baseBranch;
      const diffResult = git(["diff", `${baseBranch}...${card.branchName}`], repo.path);
      const statResult = git(["diff", "--stat", `${baseBranch}...${card.branchName}`], repo.path);

      return {
        diff: diffResult.stdout,
        stat: statResult.stdout,
        baseBranch,
        branchName: card.branchName,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ baseBranch: t.Optional(t.String({ minLength: 1 })) }),
    }
  )
  // Merge a card's branch into a target branch
  .post(
    "/:id/merge",
    ({ params, body, set }) => {
      const card = db.select().from(cards).where(eq(cards.id, params.id)).get();
      if (!card) throw new Error("Not found");

      if (!card.branchName) {
        set.status = 400;
        return { error: "Card has no branch" };
      }

      if (!card.repoId) {
        set.status = 400;
        return { error: "Card has no repo associated" };
      }

      if (card.conflictedAt) {
        set.status = 409;
        return { conflict: true, message: "Card has unresolved conflicts. Rebase the branch and clear the conflict first." };
      }

      const repo = db.select().from(repos).where(eq(repos.id, card.repoId)).get();
      if (!repo) {
        set.status = 400;
        return { error: "Card has no repo associated" };
      }

      const repoPath = repo.path;
      const feature = card.featureId
        ? db.select().from(features).where(eq(features.id, card.featureId)).get()
        : null;
      const targetBranch = body.targetBranch ?? feature?.branchName ?? repo.baseBranch;
      const strategy = body.strategy ?? "merge";
      const branchName = card.branchName;

      // Remove the worktree first so the branch is free to merge
      const wtPath = worktreePath(repoPath, branchName);
      git(["worktree", "remove", "--force", wtPath], repoPath);

      // Checkout target branch
      const checkoutResult = git(["checkout", targetBranch], repoPath);
      if (checkoutResult.exitCode !== 0) {
        set.status = 409;
        return { conflict: true, message: checkoutResult.stderr };
      }

      // Merge
      const mergeArgs =
        strategy === "squash"
          ? ["merge", "--squash", branchName]
          : ["merge", branchName];
      const mergeResult = git(mergeArgs, repoPath);
      if (mergeResult.exitCode !== 0) {
        set.status = 409;
        return { conflict: true, message: mergeResult.stderr };
      }

      // If squash, need an explicit commit
      if (strategy === "squash") {
        const commitResult = git(
          ["commit", "-m", `Squash merge: ${branchName}`],
          repoPath
        );
        if (commitResult.exitCode !== 0) {
          set.status = 409;
          return { conflict: true, message: commitResult.stderr };
        }
      }

      // Cleanup: delete the branch
      git(["branch", "-D", branchName], repoPath);

      // Find "Done" status
      const doneStatus = db
        .select()
        .from(statuses)
        .all()
        .find((s) => s.name.toLowerCase() === "done");

      // Update card: set to Done, clear branch_name, set completedAt
      const mergedAt = nowIso();
      const patch: Record<string, unknown> = {
        branchName: null,
        updatedAt: mergedAt,
        completedAt: mergedAt,
      };
      if (doneStatus) patch.statusId = doneStatus.id;

      updateCardAndBroadcast(params.id, patch);

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        strategy: t.Optional(t.Union([t.Literal("merge"), t.Literal("squash")])),
        targetBranch: t.Optional(t.String()),
      }),
    }
  )
  // Re-check merge conflicts for a card's branch
  .post(
    "/:id/recheck-conflicts",
    ({ params, set }) => {
      const card = db.select().from(cards).where(eq(cards.id, params.id)).get();
      if (!card) { set.status = 404; return { error: "Not found" }; }
      if (!card.branchName || !card.repoId) {
        set.status = 400;
        return { error: "Card has no branch or repo" };
      }

      const repo = db.select().from(repos).where(eq(repos.id, card.repoId)).get();
      const feature = card.featureId
        ? db.select().from(features).where(eq(features.id, card.featureId)).get()
        : null;
      const targetBranch = feature?.branchName ?? repo?.baseBranch;

      if (!repo || !targetBranch) {
        set.status = 400;
        return { error: "Cannot determine target branch" };
      }

      const baseResult = git(["merge-base", targetBranch, card.branchName], repo.path);
      const base = baseResult.stdout.trim();
      if (!base) {
        set.status = 400;
        return { error: "Could not determine merge base" };
      }

      const mergeTreeResult = git(
        ["merge-tree", base, targetBranch, card.branchName],
        repo.path
      );
      const hasConflicts = mergeTreeResult.stdout.includes("<<<<<<<");

      const now = nowIso();
      if (hasConflicts) {
        db.update(cards)
          .set({ conflictedAt: now, conflictDetails: mergeTreeResult.stdout, updatedAt: now })
          .where(eq(cards.id, params.id))
          .run();
        const updated = db.select().from(cards).where(eq(cards.id, params.id)).get()!;
        wsManager.broadcast("card:conflicted", updated);
        return { hasConflicts: true };
      } else {
        db.update(cards)
          .set({ conflictedAt: null, conflictDetails: null, updatedAt: now })
          .where(eq(cards.id, params.id))
          .run();
        const updated = db.select().from(cards).where(eq(cards.id, params.id)).get()!;
        wsManager.broadcast("card:updated", updated);
        return { hasConflicts: false };
      }
    },
    { params: t.Object({ id: t.String() }) }
  )
  // Post comment on card
  .post(
    "/:id/comments",
    ({ params, body }) => {
      const card = db
        .select()
        .from(cards)
        .where(eq(cards.id, params.id))
        .get();
      if (!card) throw new Error("Card not found");
      const id = randomUUID();
      if (body.author === "agent" && !body.agentId) {
        throw new Error("Agent comments require agentId");
      }
      const row = {
        id,
        cardId: params.id,
        author: body.author,
        agentId: body.author === "agent" ? body.agentId : null,
        body: body.body,
        createdAt: nowIso(),
      };
      db.insert(comments).values(row).run();
      const created = db
        .select()
        .from(comments)
        .where(eq(comments.id, id))
        .get()!;
      wsManager.broadcast("comment:created", created);
      return created;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        body: t.String(),
        author: t.Union([t.Literal("agent"), t.Literal("user")]),
        agentId: t.Optional(t.String()),
      }),
    }
  )
  // Get all card dependencies (for board-level blocked indicators)
  .get(
    "/dependencies",
    () => {
      return db.select().from(cardDependencies).all();
    }
  )
  // Get card dependencies — returns blockers and cards this card is blocking
  .get(
    "/:id/dependencies",
    ({ params }) => {
      const allStatuses = db.select().from(statuses).all();
      const statusMap = Object.fromEntries(allStatuses.map((s) => [s.id, s]));

      // Cards that block this card
      const blockerDeps = db.select().from(cardDependencies)
        .where(eq(cardDependencies.blockedCardId, params.id)).all();
      const blockers = blockerDeps.map((dep) => {
        const blocker = db.select().from(cards).where(eq(cards.id, dep.blockerCardId)).get();
        const status = blocker ? statusMap[blocker.statusId] : null;
        return {
          id: dep.blockerCardId,
          ref: blocker ? serializeCard(blocker).ref : null,
          title: blocker?.title ?? "(deleted)",
          statusId: blocker?.statusId ?? "",
          statusName: status?.name ?? "",
        };
      });

      // Cards that this card blocks
      const blockingDeps = db.select().from(cardDependencies)
        .where(eq(cardDependencies.blockerCardId, params.id)).all();
      const blocking = blockingDeps.map((dep) => {
        const blocked = db.select().from(cards).where(eq(cards.id, dep.blockedCardId)).get();
        const status = blocked ? statusMap[blocked.statusId] : null;
        return {
          id: dep.blockedCardId,
          ref: blocked ? serializeCard(blocked).ref : null,
          title: blocked?.title ?? "(deleted)",
          statusId: blocked?.statusId ?? "",
          statusName: status?.name ?? "",
        };
      });

      return { blockers, blocking };
    },
    { params: t.Object({ id: t.String() }) }
  )
  // Add a blocker dependency to a card
  .post(
    "/:id/dependencies",
    ({ params, body, set }) => {
      if (body.blockerCardId === params.id) {
        set.status = 400;
        return { error: "A card cannot block itself" };
      }
      const id = randomUUID();
      db.insert(cardDependencies).values({
        id,
        blockerCardId: body.blockerCardId,
        blockedCardId: params.id,
      }).run();
      const created = db.select().from(cardDependencies).where(eq(cardDependencies.id, id)).get()!;
      wsManager.broadcast("card:dependency:added", { blockedCardId: params.id, blockerCardId: body.blockerCardId });
      return created;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ blockerCardId: t.String() }),
    }
  )
  // Remove a blocker dependency from a card
  .delete(
    "/:id/dependencies/:blockerCardId",
    ({ params, set }) => {
      db.delete(cardDependencies)
        .where(
          and(
            eq(cardDependencies.blockedCardId, params.id),
            eq(cardDependencies.blockerCardId, params.blockerCardId)
          )
        )
        .run();
      wsManager.broadcast("card:dependency:removed", { blockedCardId: params.id, blockerCardId: params.blockerCardId });
      set.status = 204;
    },
    { params: t.Object({ id: t.String(), blockerCardId: t.String() }) }
  );
