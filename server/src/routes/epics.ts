import Elysia, { t } from "elysia";
import { db } from "../db";
import { epics, features, cards, repos } from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { wsManager } from "../wsManager";
import { git } from "../git";

export const epicRoutes = new Elysia({ prefix: "/epics" })
  .get("/", () => {
    return db.select().from(epics).all();
  })
  .post(
    "/",
    ({ body }) => {
      const id = randomUUID();
      const now = new Date().toISOString();
      const row = { id, ...body, createdAt: now, updatedAt: now };
      db.insert(epics).values(row).run();
      const created = db
        .select()
        .from(epics)
        .where(eq(epics.id, id))
        .get()!;
      wsManager.broadcast("epic:created", created);
      return created;
    },
    {
      body: t.Object({
        title: t.String(),
        description: t.Optional(t.String()),
        statusId: t.Optional(t.String()),
        workflowId: t.Optional(t.String()),
      }),
    }
  )
  .patch(
    "/:id",
    ({ params, body }) => {
      const now = new Date().toISOString();
      db.update(epics)
        .set({ ...body, updatedAt: now })
        .where(eq(epics.id, params.id))
        .run();
      const updated = db
        .select()
        .from(epics)
        .where(eq(epics.id, params.id))
        .get();
      if (!updated) throw new Error("Not found");
      wsManager.broadcast("epic:updated", updated);
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Partial(
        t.Object({
          title: t.String(),
          description: t.String(),
          statusId: t.String(),
        })
      ),
    }
  )
  .delete(
    "/:id",
    ({ params }) => {
      // Cascade: delete all cards belonging to this epic or its features
      const epicFeatures = db
        .select()
        .from(features)
        .where(eq(features.epicId, params.id))
        .all();

      const featureIds = epicFeatures.map((f) => f.id);

      // Delete cards directly under the epic
      db.delete(cards).where(eq(cards.epicId, params.id)).run();

      // Delete cards under any of the epic's features
      if (featureIds.length > 0) {
        db.delete(cards).where(inArray(cards.featureId, featureIds)).run();
      }

      // Delete features
      db.delete(features).where(eq(features.epicId, params.id)).run();

      // Delete the epic
      db.delete(epics).where(eq(epics.id, params.id)).run();

      wsManager.broadcast("epic:deleted", { id: params.id });
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  )
  // Get commit log for a repo, scoped to an epic context
  .get(
    "/:id/commits",
    ({ params, query, set }) => {
      const repo = db.select().from(repos).where(eq(repos.id, query.repoId)).get();
      if (!repo) {
        set.status = 400;
        return { error: "Repo not found" };
      }

      const range = repo.compareBase
        ? `${repo.compareBase}..${repo.baseBranch}`
        : repo.baseBranch;
      const result = git(
        ["log", range, "--format=%H|%ae|%s|%ai", "-50"],
        repo.path
      );

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
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ repoId: t.String() }),
    }
  )
  // Get a specific commit diff
  .get(
    "/:id/commits/:hash",
    ({ params, query, set }) => {
      const repo = db.select().from(repos).where(eq(repos.id, query.repoId)).get();
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

      // Parse header: first non-empty line contains the format string
      const headerLine = header.trim().split("\n").find(l => l.includes("|")) ?? "";
      const [hash, author, subject, date] = headerLine.split("|");

      return { hash, author, subject, date, diff };
    },
    {
      params: t.Object({ id: t.String(), hash: t.String() }),
      query: t.Object({ repoId: t.String() }),
    }
  );
