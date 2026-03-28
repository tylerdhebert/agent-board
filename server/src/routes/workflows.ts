import Elysia, { t } from "elysia";
import { randomUUID } from "crypto";
import { db } from "../db";
import { workflows, workflowStatuses, statuses } from "../db/schema";
import { eq } from "drizzle-orm";
import { nowIso } from "../helpers/db";

export const workflowRoutes = new Elysia({ prefix: "/workflows" })
  .get("/", () => db.select().from(workflows).all())
  .get("/:id/statuses", ({ params }) => {
    return db
      .select({
        id: workflowStatuses.id,
        workflowId: workflowStatuses.workflowId,
        statusId: workflowStatuses.statusId,
        position: workflowStatuses.position,
        triggersMerge: workflowStatuses.triggersMerge,
        name: statuses.name,
        color: statuses.color,
      })
      .from(workflowStatuses)
      .innerJoin(statuses, eq(workflowStatuses.statusId, statuses.id))
      .where(eq(workflowStatuses.workflowId, params.id))
      .orderBy(workflowStatuses.position)
      .all();
  })
  .patch(
    "/:id/statuses/:wsId",
    ({ params, body }) => {
      // Legacy seeded records have composite ids; try both composite and direct
      const compositeId = `ws-${params.id}-${params.wsId}`;
      db.update(workflowStatuses)
        .set(body)
        .where(eq(workflowStatuses.id, compositeId))
        .run();
      return db
        .select()
        .from(workflowStatuses)
        .where(eq(workflowStatuses.id, compositeId))
        .get();
    },
    { body: t.Partial(t.Object({ position: t.Number(), triggersMerge: t.Boolean() })) }
  )
  // Add a status to a workflow
  .post(
    "/:id/statuses",
    ({ params, body }) => {
      const existing = db.select().from(workflowStatuses).where(eq(workflowStatuses.workflowId, params.id)).all();
      const maxPos = existing.reduce((m, ws) => Math.max(m, ws.position), -1);
      const id = randomUUID();
      const now = nowIso();
      db.insert(workflowStatuses).values({
        id,
        workflowId: params.id,
        statusId: body.statusId,
        position: maxPos + 1,
        triggersMerge: body.triggersMerge ?? false,
        createdAt: now,
      }).run();
      return db.select({
        id: workflowStatuses.id,
        workflowId: workflowStatuses.workflowId,
        statusId: workflowStatuses.statusId,
        position: workflowStatuses.position,
        triggersMerge: workflowStatuses.triggersMerge,
        name: statuses.name,
        color: statuses.color,
      }).from(workflowStatuses)
        .innerJoin(statuses, eq(workflowStatuses.statusId, statuses.id))
        .where(eq(workflowStatuses.id, id))
        .get();
    },
    { body: t.Object({ statusId: t.String(), triggersMerge: t.Optional(t.Boolean()) }) }
  )
  // Remove a status from a workflow (by workflowStatus row id)
  .delete(
    "/:id/statuses/:wsId",
    ({ params, set }) => {
      db.delete(workflowStatuses).where(eq(workflowStatuses.id, params.wsId)).run();
      set.status = 204;
    },
    { params: t.Object({ id: t.String(), wsId: t.String() }) }
  )
  // Reorder: update position of a workflow status by ws row id
  .patch(
    "/:id/statuses/:wsId/position",
    ({ params, body }) => {
      db.update(workflowStatuses).set({ position: body.position }).where(eq(workflowStatuses.id, params.wsId)).run();
      return { success: true };
    },
    {
      params: t.Object({ id: t.String(), wsId: t.String() }),
      body: t.Object({ position: t.Number() }),
    }
  )
  // Toggle triggersMerge by ws row id
  .patch(
    "/:id/statuses/:wsId/merge",
    ({ params, body }) => {
      db.update(workflowStatuses).set({ triggersMerge: body.triggersMerge }).where(eq(workflowStatuses.id, params.wsId)).run();
      return { success: true };
    },
    {
      params: t.Object({ id: t.String(), wsId: t.String() }),
      body: t.Object({ triggersMerge: t.Boolean() }),
    }
  );
