import Elysia, { t } from "elysia";
import { db } from "../db";
import { inputRequests, cards, statuses } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { wsManager } from "../wsManager";
import { pollRegistry } from "../pollRegistry";
import { nowIso } from "../helpers/db";
import type { InferSelectModel } from "drizzle-orm";

type InputRequestRecord = InferSelectModel<typeof inputRequests>;

function buildBlockedReasonSummary(prompts: string[]) {
  if (prompts.length === 0) return null;
  return prompts.length === 1
    ? `Waiting for input: ${prompts[0]}`
    : `Waiting for input: ${prompts[0]} (+${prompts.length - 1} more)`;
}

function getBlockedStatusId() {
  return db
    .select()
    .from(statuses)
    .where(eq(statuses.name, "Blocked"))
    .get()?.id ?? null;
}

function resolvePreviousStatusIdForNewRequest(cardId: string, cardStatusId: string, blockedStatusId: string | null) {
  if (!blockedStatusId || cardStatusId !== blockedStatusId) {
    return cardStatusId;
  }

  const pendingForCard = db
    .select()
    .from(inputRequests)
    .where(and(eq(inputRequests.cardId, cardId), eq(inputRequests.status, "pending")))
    .all();

  const inherited = pendingForCard.find(
    (request) => request.previousStatusId && request.previousStatusId !== blockedStatusId
  );

  return inherited?.previousStatusId ?? null;
}

function restorePreviousStatus(cardId: string, previousStatusId: string | null | undefined) {
  if (!previousStatusId) return;

  const blockedStatusId = getBlockedStatusId();

  if (!blockedStatusId || previousStatusId === blockedStatusId) return;

  const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
  if (!card || card.statusId !== blockedStatusId) return;

  const updatedAt = nowIso();
  db.update(cards)
    .set({ statusId: previousStatusId, blockedReason: null, updatedAt })
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

function maybeRestoreCardAfterInputResolution(cardId: string, previousStatusId: string | null | undefined) {
  const stillPending = db
    .select()
    .from(inputRequests)
    .where(and(eq(inputRequests.cardId, cardId), eq(inputRequests.status, "pending")))
    .all();

  if (stillPending.length > 0) return;
  restorePreviousStatus(cardId, previousStatusId);
}

function serializeInputRequest(record: typeof inputRequests.$inferSelect) {
  return {
    ...record,
    questions: JSON.parse(record.questions),
    answers: record.answers ? JSON.parse(record.answers) : null,
  };
}

function getExpiredPendingRequests() {
  const now = Date.now();
  return db
    .select()
    .from(inputRequests)
    .where(eq(inputRequests.status, "pending"))
    .all()
    .filter((request) => {
      const expiresAt = new Date(request.requestedAt).getTime() + request.timeoutSecs * 1000;
      return Number.isFinite(expiresAt) && expiresAt <= now;
    });
}

function markRequestTimedOut(request: InputRequestRecord) {
  if (request.status !== "pending") return false;

  const current = db
    .select()
    .from(inputRequests)
    .where(eq(inputRequests.id, request.id))
    .get();

  if (!current || current.status !== "pending") return false;

  db.update(inputRequests)
    .set({ status: "timed_out" })
    .where(eq(inputRequests.id, request.id))
    .run();

  maybeRestoreCardAfterInputResolution(request.cardId, request.previousStatusId);
  wsManager.broadcast("input:timed_out", { requestId: request.id, cardId: request.cardId });
  return true;
}

function reconcileExpiredInputRequests() {
  for (const request of getExpiredPendingRequests()) {
    if (pollRegistry.has(request.id)) continue;
    markRequestTimedOut(request);
  }
}

export const inputRoutes = new Elysia({ prefix: "/input" })
  .get("/", ({ query }) => {
    reconcileExpiredInputRequests();
    const conditions = [
      query.status ? eq(inputRequests.status, query.status as "pending" | "answered" | "timed_out") : undefined,
      query.cardId ? eq(inputRequests.cardId, query.cardId) : undefined,
    ].filter(Boolean) as Parameters<typeof and>;

    return db
      .select()
      .from(inputRequests)
      .where(and(...conditions))
      .all()
      .map(serializeInputRequest);
  }, {
    query: t.Object({
      status: t.Optional(t.String()),
      cardId: t.Optional(t.String()),
    }),
  })
  .get("/pending", () => {
    reconcileExpiredInputRequests();
    return db
      .select()
      .from(inputRequests)
      .where(eq(inputRequests.status, "pending"))
      .all()
      .map(serializeInputRequest);
  })
  .get("/:id", ({ params, set }) => {
    reconcileExpiredInputRequests();
    const request = db
      .select()
      .from(inputRequests)
      .where(eq(inputRequests.id, params.id))
      .get();

    if (!request) {
      set.status = 404;
      return { error: "Input request not found" };
    }

    return serializeInputRequest(request);
  }, {
    params: t.Object({ id: t.String() }),
  })

  .post(
    "/",
    async ({ body, set }) => {
      const { cardId, questions, timeoutSecs = 900, detach = false } = body;

      const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
      if (!card) {
        set.status = 404;
        return { error: "Card not found" };
      }

      const blockedStatusId = getBlockedStatusId();
      const previousStatusId = resolvePreviousStatusIdForNewRequest(
        cardId,
        card.statusId,
        blockedStatusId
      );

      const requestId = randomUUID();
      const now = nowIso();
      db.insert(inputRequests)
        .values({
          id: requestId,
          cardId,
          previousStatusId,
          questions: JSON.stringify(questions),
          answers: null,
          status: "pending",
          requestedAt: now,
          timeoutSecs,
        })
        .run();

      if (blockedStatusId) {
        const blockedReason =
          card.statusId === blockedStatusId
            ? card.blockedReason
            : buildBlockedReasonSummary(questions.map((question) => question.prompt));
        db.update(cards)
          .set({ statusId: blockedStatusId, blockedReason, updatedAt: nowIso() })
          .where(eq(cards.id, cardId))
          .run();
        const updatedCard = db
          .select()
          .from(cards)
          .where(eq(cards.id, cardId))
          .get();
        wsManager.broadcast("card:updated", updatedCard);
      }

      const request = {
        id: requestId,
        cardId,
        previousStatusId,
        questions,
        answers: null,
        status: "pending",
        requestedAt: now,
        answeredAt: null,
        timeoutSecs,
      };
      wsManager.broadcast("input:requested", request);

      if (detach) {
        return request;
      }

      try {
        const answers = await pollRegistry.register(
          requestId,
          timeoutSecs,
          () => {
            db.update(inputRequests)
              .set({ status: "timed_out" })
              .where(eq(inputRequests.id, requestId))
              .run();
            maybeRestoreCardAfterInputResolution(cardId, previousStatusId);
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
        detach: t.Optional(t.Boolean()),
      }),
    }
  )

  .post(
    "/:id/answer",
    ({ params, body, set }) => {
      reconcileExpiredInputRequests();
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

      maybeRestoreCardAfterInputResolution(request.cardId, request.previousStatusId);

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

      return { success: true, resolved, request: serializeInputRequest(updatedRequest) };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        answers: t.Record(t.String(), t.String()),
      }),
    }
  );
