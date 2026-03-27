import Elysia, { t } from "elysia";
import { db } from "../db";
import { cards, repos } from "../db/schema";
import { eq } from "drizzle-orm";
import { wsManager } from "../wsManager";
import { git, worktreePath } from "../git";

export const worktreeRoutes = new Elysia({ prefix: "/worktrees" })
  // Create a worktree for a card
  .post(
    "/",
    ({ body, set }) => {
      const repo = db.select().from(repos).where(eq(repos.id, body.repoId)).get();
      if (!repo) {
        set.status = 400;
        return { error: "Repo not found" };
      }

      const wtPath = worktreePath(repo.path, body.branchName);
      const base = body.baseBranch ?? "HEAD";

      const result = git(
        ["worktree", "add", "-b", body.branchName, wtPath, base],
        repo.path
      );

      if (result.exitCode !== 0) {
        set.status = 400;
        return { error: result.stderr };
      }

      // Update card's branch_name and repo_id in DB
      const now = new Date().toISOString();
      db.update(cards)
        .set({ branchName: body.branchName, repoId: body.repoId, updatedAt: now })
        .where(eq(cards.id, body.cardId))
        .run();

      const updated = db.select().from(cards).where(eq(cards.id, body.cardId)).get();
      if (updated) {
        wsManager.broadcast("card:updated", updated);
      }

      return { path: wtPath, branchName: body.branchName, cardId: body.cardId };
    },
    {
      body: t.Object({
        cardId: t.String(),
        branchName: t.String(),
        repoId: t.String(),
        baseBranch: t.Optional(t.String()),
      }),
    }
  )
  // Remove a worktree and delete the branch
  .delete(
    "/:branchName",
    ({ params, query, set }) => {
      const repo = db.select().from(repos).where(eq(repos.id, query.repoId)).get();
      if (!repo) {
        set.status = 400;
        return { error: "Repo not found" };
      }

      const wtPath = worktreePath(repo.path, params.branchName);

      git(["worktree", "remove", "--force", wtPath], repo.path);
      git(["branch", "-D", params.branchName], repo.path);

      // Clear branch_name on any card that had this branch
      const now = new Date().toISOString();
      const affected = db
        .select()
        .from(cards)
        .where(eq(cards.branchName, params.branchName))
        .all();

      for (const card of affected) {
        db.update(cards)
          .set({ branchName: null, updatedAt: now })
          .where(eq(cards.id, card.id))
          .run();
        const updated = db.select().from(cards).where(eq(cards.id, card.id)).get();
        if (updated) {
          wsManager.broadcast("card:updated", updated);
        }
      }

      set.status = 204;
      return;
    },
    {
      params: t.Object({ branchName: t.String() }),
      query: t.Object({ repoId: t.String() }),
    }
  );
