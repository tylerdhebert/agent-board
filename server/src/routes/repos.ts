import Elysia, { t } from "elysia";
import { db } from "../db";
import { repos } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { nowIso } from "../helpers/db";
import { currentCheckedOutBranch, git } from "../git";

export const repoRoutes = new Elysia({ prefix: "/repos" })
  .get("/", () => db.select().from(repos).all())
  .post(
    "/",
    ({ body }) => {
      const now = nowIso();
      const inferredBase = currentCheckedOutBranch(body.path) ?? "main";
      const repo = { id: randomUUID(), ...body, baseBranch: body.baseBranch ?? inferredBase, createdAt: now };
      db.insert(repos).values(repo).run();
      return repo;
    },
    { body: t.Object({ name: t.String(), path: t.String(), baseBranch: t.Optional(t.String()), buildCommand: t.Optional(t.String()) }) }
  )
  .patch(
    "/:id",
    ({ params, body }) => {
      db.update(repos).set(body).where(eq(repos.id, params.id)).run();
      return db.select().from(repos).where(eq(repos.id, params.id)).get();
    },
    { params: t.Object({ id: t.String() }), body: t.Partial(t.Object({ name: t.String(), path: t.String(), baseBranch: t.String(), buildCommand: t.String() })) }
  )
  .delete("/:id", ({ params, set }) => {
    db.delete(repos).where(eq(repos.id, params.id)).run();
    set.status = 204;
  })
  .get(
    "/:id/branches",
    ({ params, set }) => {
      const repo = db.select().from(repos).where(eq(repos.id, params.id)).get();
      if (!repo) {
        set.status = 404;
        return { error: "Repo not found" };
      }
      const result = git(
        ["branch", "--sort=-committerdate", "--format=%(refname:short)"],
        repo.path
      );
      if (result.exitCode !== 0) {
        set.status = 400;
        return { error: result.stderr };
      }
      const branches = result.stdout
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean);
      return { branches };
    },
    { params: t.Object({ id: t.String() }) }
  );
