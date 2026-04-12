import Elysia, { t } from "elysia";
import { db } from "../db";
import { features, cards, repos, buildResults } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { wsManager } from "../wsManager";
import { git, worktreePath } from "../git";
import { nowIso, updateAndBroadcast } from "../helpers/db";
import { parseCommitLog, parseCommitDetail } from "../helpers/git";
import { serializeFeature } from "../helpers/presenters";
import { nextFeatureRefNum } from "../db";

export const featureRoutes = new Elysia({ prefix: "/features" })
  .get("/", () => {
    return db.select().from(features).all().map(serializeFeature);
  })
  .post(
    "/",
    ({ body }) => {
      const id = randomUUID();
      const now = nowIso();
      const row = { id, refNum: nextFeatureRefNum(), ...body, createdAt: now, updatedAt: now };
      db.insert(features).values(row).run();
      const created = db
        .select()
        .from(features)
        .where(eq(features.id, id))
        .get()!;
      wsManager.broadcast("feature:created", created);
      return serializeFeature(created);
    },
    {
      body: t.Object({
        epicId: t.String(),
        title: t.String(),
        description: t.Optional(t.String()),
        statusId: t.Optional(t.String()),
        repoId: t.Optional(t.String()),
        branchName: t.Optional(t.String()),
      }),
    }
  )
  .patch(
    "/:id",
    ({ params, body }) => {
      const updated = updateAndBroadcast(features, params.id, body, "feature:updated");
      return serializeFeature(updated);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Partial(
        t.Object({
          title: t.String(),
          description: t.String(),
          statusId: t.String(),
          epicId: t.String(),
          repoId: t.String(),
          branchName: t.String(),
        })
      ),
    }
  )
  .delete(
    "/:id",
    ({ params }) => {
      // Delete all cards under this feature first
      db.delete(cards).where(eq(cards.featureId, params.id)).run();
      db.delete(features).where(eq(features.id, params.id)).run();
      wsManager.broadcast("feature:deleted", { id: params.id });
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  )
  // Get commit log for a feature's branch
  .get(
    "/:id/commits",
    ({ params, set }) => {
      const feature = db.select().from(features).where(eq(features.id, params.id)).get();
      if (!feature?.repoId || !feature?.branchName) {
        set.status = 400;
        return { error: "Feature has no repo or branch configured" };
      }

      const repo = db.select().from(repos).where(eq(repos.id, feature.repoId)).get();
      if (!repo) {
        set.status = 400;
        return { error: "Repo not found" };
      }

      const range = `${repo.baseBranch}..${feature.branchName}`;
      const result = git(["log", range, "--format=%H|%ae|%s|%ai", "-50"], repo.path);

      return parseCommitLog(result.stdout);
    },
    { params: t.Object({ id: t.String() }) }
  )
  // Get a specific commit diff for a feature
  .get(
    "/:id/commits/:hash",
    ({ params, set }) => {
      const feature = db.select().from(features).where(eq(features.id, params.id)).get();
      if (!feature?.repoId) {
        set.status = 400;
        return { error: "Feature has no repo configured" };
      }

      const repo = db.select().from(repos).where(eq(repos.id, feature.repoId)).get();
      if (!repo) {
        set.status = 400;
        return { error: "Repo not found" };
      }

      const result = git(
        ["show", params.hash, "--format=%H|%ae|%s|%ai", "--patch"],
        repo.path
      );

      return parseCommitDetail(result.stdout);
    },
    { params: t.Object({ id: t.String(), hash: t.String() }) }
  )
  // Get latest build result for a feature
  .get(
    "/:id/build",
    ({ params }) => {
      const result = db.select().from(buildResults)
        .where(eq(buildResults.featureId, params.id))
        .orderBy(desc(buildResults.triggeredAt))
        .limit(1)
        .all();
      return result[0] ?? null;
    },
    { params: t.Object({ id: t.String() }) }
  )
  // Trigger a build for a feature (manual only)
  .post(
    "/:id/build",
    async ({ params, set }) => {
      const feature = db.select().from(features).where(eq(features.id, params.id)).get();
      if (!feature) {
        set.status = 404;
        return { error: "Feature not found" };
      }

      if (!feature.repoId) {
        set.status = 400;
        return { error: "Feature has no repo configured" };
      }

      if (!feature.branchName) {
        set.status = 400;
        return { error: "Feature has no branch configured" };
      }

      const repo = db.select().from(repos).where(eq(repos.id, feature.repoId)).get();
      if (!repo) {
        set.status = 400;
        return { error: "Repo not found" };
      }

      if (!repo.buildCommand) {
        set.status = 400;
        return { error: "No build command configured for this repo" };
      }

      const buildId = randomUUID();
      const now = nowIso();

      db.insert(buildResults).values({
        id: buildId,
        featureId: params.id,
        status: "running",
        triggeredAt: now,
      }).run();

      wsManager.broadcast("build:started", { featureId: params.id, buildId });

      // Fire-and-forget async build
      const featureId = params.id;
      const branchName = feature.branchName;
      const repoPath = repo.path;
      const buildCommand = repo.buildCommand;
      const tmpPath = worktreePath(repoPath, `__build__${buildId.slice(0, 8)}`);

      (async () => {
        try {
          // Create temp worktree detached so it doesn't conflict with an existing worktree on the same branch
          const wtResult = git(["worktree", "add", "--detach", tmpPath, branchName], repoPath);
          if (wtResult.exitCode !== 0) throw new Error(`Failed to create build worktree: ${wtResult.stderr}`);

          // Run build command asynchronously so the event loop stays free
          const { exitCode, output: rawOutput } = await new Promise<{ exitCode: number; output: string }>((resolve) => {
            const child = spawn(buildCommand, { shell: true, cwd: tmpPath, env: process.env });
            let out = "";
            child.stdout?.on("data", (d: Buffer) => { out += d.toString(); });
            child.stderr?.on("data", (d: Buffer) => { out += d.toString(); });
            child.on("close", (code) => resolve({ exitCode: code ?? 1, output: out }));
          });

          const output = rawOutput.slice(0, 50000);
          const status = exitCode === 0 ? "passed" : "failed";
          const completedAt = nowIso();

          db.update(buildResults)
            .set({ status, output, completedAt })
            .where(eq(buildResults.id, buildId))
            .run();

          wsManager.broadcast("build:completed", { featureId, buildId, status, output });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          const completedAt = nowIso();
          db.update(buildResults)
            .set({ status: "failed", output: errorMsg.slice(0, 50000), completedAt })
            .where(eq(buildResults.id, buildId))
            .run();
          wsManager.broadcast("build:completed", { featureId, buildId, status: "failed", output: errorMsg });
        } finally {
          // Cleanup worktree
          git(["worktree", "remove", "--force", tmpPath], repoPath);
        }
      })();

      return { buildId, status: "running" };
    },
    { params: t.Object({ id: t.String() }) }
  );
