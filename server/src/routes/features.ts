import Elysia, { t } from "elysia";
import { db } from "../db";
import { features, cards, repos } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { wsManager } from "../wsManager";
import { git } from "../git";

export const featureRoutes = new Elysia({ prefix: "/features" })
  .get("/", () => {
    return db.select().from(features).all();
  })
  .post(
    "/",
    ({ body }) => {
      const id = randomUUID();
      const now = new Date().toISOString();
      const row = { id, ...body, createdAt: now, updatedAt: now };
      db.insert(features).values(row).run();
      const created = db
        .select()
        .from(features)
        .where(eq(features.id, id))
        .get()!;
      wsManager.broadcast("feature:created", created);
      return created;
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
      const now = new Date().toISOString();
      db.update(features)
        .set({ ...body, updatedAt: now })
        .where(eq(features.id, params.id))
        .run();
      const updated = db
        .select()
        .from(features)
        .where(eq(features.id, params.id))
        .get();
      if (!updated) throw new Error("Not found");
      wsManager.broadcast("feature:updated", updated);
      return updated;
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

      const commits = result.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash, author, subject, date] = line.split("|");
          return { hash, author, subject, date };
        });

      return commits;
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

      const stdout = result.stdout;
      const diffMarker = "diff --git";
      const diffIndex = stdout.indexOf(diffMarker);
      const header = diffIndex === -1 ? stdout : stdout.slice(0, diffIndex);
      const diff = diffIndex === -1 ? "" : stdout.slice(diffIndex);

      const headerLine = header.trim().split("\n").find((l) => l.includes("|")) ?? "";
      const [hash, author, subject, date] = headerLine.split("|");

      return { hash, author, subject, date, diff };
    },
    { params: t.Object({ id: t.String(), hash: t.String() }) }
  );
