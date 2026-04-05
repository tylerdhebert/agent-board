import Elysia, { t } from "elysia";
import { db } from "../db";
import { inputRequests, cards, statuses } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { wsManager } from "../wsManager";
import { pollRegistry } from "../pollRegistry";
import { nowIso } from "../helpers/db";

function restorePreviousStatus(cardId: string, previousStatusId: string | null | undefined) {
  if (!previousStatusId) return;

  const blockedStatus = db
    .select()
    .from(statuses)
    .where(eq(statuses.name, "Blocked"))
    .get();

  if (!blockedStatus || previousStatusId === blockedStatus.id) return;

  const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
  if (!card || card.statusId !== blockedStatus.id) return;

  const updatedAt = nowIso();
  db.update(cards)
    .set({ statusId: previousStatusId, updatedAt })
    .where(eq(cards.id, cardId))
    .run();

  const updatedCard = db
    .select()
    .from(cards)
    .where(eq(cards.id, cardId))
    .get();

  if (updatedCard) {
    wsManager.broadcast("card:updated", updatedCard);
  }
}

export const inputRoutes = new Elysia({ prefix: "/input" })
  // Get all pending input requests
  .get("/pending", () => {
    return db
      .select()
      .from(inputRequests)
      .where(eq(inputRequests.status, "pending"))
      .all()
      .map((r) => ({
        ...r,
        questions: JSON.parse(r.questions),
        answers: r.answers ? JSON.parse(r.answers) : null,
      }));
  })

  // Long-poll: agent POSTs questions and blocks until answered
  .post(
    "/",
    async ({ body, set }) => {
      const { cardId, questions, timeoutSecs = 900 } = body;

      // Validate card exists
      const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
      if (!card) {
        set.status = 404;
        return { error: "Card not found" };
      }

      // Find the "Blocked" status
      const blockedStatus = db
        .select()
        .from(statuses)
        .where(eq(statuses.name, "Blocked"))
        .get();

      // Save the input request
      const requestId = randomUUID();
      const now = nowIso();
      db.insert(inputRequests)
        .values({
          id: requestId,
          cardId,
          previousStatusId: card.statusId,
          questions: JSON.stringify(questions),
          answers: null,
          status: "pending",
          requestedAt: now,
          timeoutSecs,
        })
        .run();

      // Flip card status to Blocked if that status exists
      if (blockedStatus) {
        db.update(cards)
          .set({ statusId: blockedStatus.id, updatedAt: nowIso() })
          .where(eq(cards.id, cardId))
          .run();
        const updatedCard = db
          .select()
          .from(cards)
          .where(eq(cards.id, cardId))
          .get();
        wsManager.broadcast("card:updated", updatedCard);
      }

      // Broadcast input:requested
      const request = {
        id: requestId,
        cardId,
        questions,
        status: "pending",
        requestedAt: now,
        timeoutSecs,
      };
      wsManager.broadcast("input:requested", request);

      // Park the promise and wait
      try {
        const answers = await pollRegistry.register(
          requestId,
          timeoutSecs,
          () => {
            // On timeout: update DB
            db.update(inputRequests)
              .set({ status: "timed_out" })
              .where(eq(inputRequests.id, requestId))
              .run();
            restorePreviousStatus(cardId, card.statusId);
            wsManager.broadcast("input:timed_out", { requestId, cardId });
          }
        );

        // Resolved — return answers
        return { requestId, status: "answered", answers };
      } catch (reason) {
        if (reason === "timed_out") {
          set.status = 408;
          return { requestId, status: "timed_out", answers: null };
        }
        set.status = 500;
        return { error: "Unexpected error" };
      }
    },
    {
      body: t.Object({
        cardId: t.String(),
        questions: t.Array(
          t.Object({
            id: t.String(),
            type: t.Union([
              t.Literal("text"),
              t.Literal("yesno"),
              t.Literal("choice"),
            ]),
            prompt: t.String(),
            default: t.Optional(t.String()),
            options: t.Optional(t.Array(t.String())),
          })
        ),
        timeoutSecs: t.Optional(t.Number()),
      }),
    }
  )

  // Answer an input request
  .post(
    "/:id/answer",
    ({ params, body, set }) => {
      const request = db
        .select()
        .from(inputRequests)
        .where(eq(inputRequests.id, params.id))
        .get();

      if (!request) {
        set.status = 404;
        return { error: "Input request not found" };
      }
      if (request.status !== "pending") {
        set.status = 409;
        return { error: `Request is already ${request.status}` };
      }

      const now = nowIso();
      db.update(inputRequests)
        .set({
          answers: JSON.stringify(body.answers),
          status: "answered",
          answeredAt: now,
        })
        .where(eq(inputRequests.id, params.id))
        .run();

      restorePreviousStatus(request.cardId, request.previousStatusId);

      // Resolve the waiting long-poll
      const resolved = pollRegistry.answer(params.id, body.answers);

      const updatedRequest = db
        .select()
        .from(inputRequests)
        .where(eq(inputRequests.id, params.id))
        .get()!;

      wsManager.broadcast("input:answered", {
        requestId: params.id,
        cardId: request.cardId,
        answers: body.answers,
      });

      return { success: true, resolved, request: updatedRequest };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        answers: t.Record(t.String(), t.String()),
      }),
    }
  );
