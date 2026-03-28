import Elysia, { t } from "elysia";
import { db } from "../db";
import { cards, comments, statuses, transitionRules, repos, features, cardDependencies, epics, workflowStatuses } from "../db/schema";
import { eq, like, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { wsManager } from "../wsManager";
import { git, worktreePath } from "../git";

function agentPatternMatch(pattern: string, agentId: string): boolean {
  // Simple wildcard: * matches anything
  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$", "i");
  return regex.test(agentId);
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

      return allCards;
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
  // What statuses can this agent move this card to?
  .get(
    "/:id/allowed-statuses",
    ({ params, query }) => {
      const card = db.select().from(cards).where(eq(cards.id, params.id)).get();
      if (!card) throw new Error("Not found");

      const allStatuses = db.select().from(statuses).orderBy(statuses.position).all();
      const rules = db.select().from(transitionRules).all();

      // No rules = all statuses allowed
      if (rules.length === 0 || !query.agentId) return allStatuses;

      return allStatuses.filter((s) =>
        rules.some((rule) => {
          const agentMatch = rule.agentPattern === null || agentPatternMatch(rule.agentPattern, query.agentId!);
          const fromMatch = rule.fromStatusId === null || rule.fromStatusId === card.statusId;
          const toMatch = rule.toStatusId === s.id;
          return agentMatch && fromMatch && toMatch;
        })
      );
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ agentId: t.Optional(t.String()) }),
    }
  )
  // Claim a card — sets agentId and optionally auto-advances from To Do → In Progress
  .post(
    "/:id/claim",
    ({ params, body }) => {
      const card = db.select().from(cards).where(eq(cards.id, params.id)).get();
      if (!card) throw new Error("Not found");

      const now = new Date().toISOString();
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

      db.update(cards).set(patch).where(eq(cards.id, params.id)).run();
      const updated = db.select().from(cards).where(eq(cards.id, params.id)).get()!;
      wsManager.broadcast("card:updated", updated);
      return updated;
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
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    return db.select().from(cards).where(like(cards.completedAt, `${today}%`)).all();
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
      return { ...card, comments: cardComments };
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
      const now = new Date().toISOString();
      const row = {
        id,
        featureId: body.featureId,
        epicId: feature.epicId,
        type: body.type ?? "task",
        title: body.title,
        description: body.description ?? "",
        statusId: body.statusId,
        agentId: body.agentId ?? null,
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
      return created;
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
      }),
    }
  )
  // Update card
  .patch(
    "/:id",
    ({ params, body }) => {
      const now = new Date().toISOString();

      // Determine completedAt: stamp when moving to Done, clear when moving away
      let completedAt: string | null | undefined = undefined;
      if (body.statusId) {
        const status = db.select().from(statuses).where(eq(statuses.id, body.statusId)).get();
        if (status) {
          completedAt = status.name.toLowerCase() === "done" ? now : null;
        }
      }

      // Enforce transition rules when agentId is changing the status
      if (body.statusId && body.agentId !== undefined) {
        // Use agentId from body if provided, else from current card
        const card = db.select().from(cards).where(eq(cards.id, params.id)).get();
        const agentId = body.agentId ?? card?.agentId;
        if (agentId) {
          const rules = db.select().from(transitionRules).all();
          if (rules.length > 0) {
            const currentStatusId = card?.statusId;
            // Check if any rule matches this agent + fromStatus + toStatus
            const allowed = rules.some((rule) => {
              // agentPattern match (null = wildcard)
              const agentMatch = rule.agentPattern === null || agentPatternMatch(rule.agentPattern, agentId);
              // fromStatusId match (null = any)
              const fromMatch = rule.fromStatusId === null || rule.fromStatusId === currentStatusId;
              // toStatusId must match
              const toMatch = rule.toStatusId === body.statusId;
              return agentMatch && fromMatch && toMatch;
            });
            if (!allowed) {
              throw new Error(`Agent "${agentId}" is not permitted to move cards to this status`);
            }
          }
        }
      }

      const patch: Record<string, unknown> = { ...body, updatedAt: now };
      if (completedAt !== undefined) patch.completedAt = completedAt;

      db.update(cards).set(patch).where(eq(cards.id, params.id)).run();
      const updated = db.select().from(cards).where(eq(cards.id, params.id)).get();
      if (!updated) throw new Error("Not found");
      wsManager.broadcast("card:updated", updated);

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
                const now2 = new Date().toISOString();
                if (hasConflicts) {
                  db.update(cards)
                    .set({ conflictedAt: now2, conflictDetails: mergeTreeResult.stdout })
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

      return updated;
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
          conflictedAt: t.Optional(t.Union([t.String(), t.Null()])),
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
  // Get diff for a card's branch vs main
  .get(
    "/:id/diff",
    ({ params, set }) => {
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

      const diffResult = git(["diff", `${repo.baseBranch}...${card.branchName}`], repo.path);
      const statResult = git(["diff", "--stat", `${repo.baseBranch}...${card.branchName}`], repo.path);

      return {
        diff: diffResult.stdout,
        stat: statResult.stdout,
        branchName: card.branchName,
      };
    },
    { params: t.Object({ id: t.String() }) }
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

      // Cleanup: remove worktree and delete branch
      const wtPath = worktreePath(repoPath, branchName);
      git(["worktree", "remove", "--force", wtPath], repoPath);
      git(["branch", "-D", branchName], repoPath);

      // Find "Done" status
      const doneStatus = db
        .select()
        .from(statuses)
        .all()
        .find((s) => s.name.toLowerCase() === "done");

      // Update card: set to Done, clear branch_name, set completedAt
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        branchName: null,
        updatedAt: now,
        completedAt: now,
      };
      if (doneStatus) patch.statusId = doneStatus.id;

      db.update(cards).set(patch).where(eq(cards.id, params.id)).run();
      const updated = db.select().from(cards).where(eq(cards.id, params.id)).get();
      if (updated) {
        wsManager.broadcast("card:updated", updated);
      }

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
      const now = new Date().toISOString();
      const row = {
        id,
        cardId: params.id,
        author: body.author,
        body: body.body,
        createdAt: now,
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
