import Elysia, { t } from "elysia";
import { db } from "../db";
import { repos } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { nowIso } from "../helpers/db";
import { currentCheckedOutBranch } from "../git";

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
  });
