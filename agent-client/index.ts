/**
 * agent-client — typed HTTP helper for AI agents to interact with agent-board.
 *
 * Usage example:
 *
 *   import { createCard, updateCard, addComment, requestInput } from './agent-client/index.ts';
 *
 *   // 1. Create a card to represent this agent's work
 *   const card = await createCard({
 *     title: 'Refactor auth module',
 *     type: 'task',
 *     description: 'Migrating session tokens to comply with new requirements',
 *     agentId: 'auth-agent-01',
 *   });
 *
 *   // 2. Update progress
 *   await updateCard(card.id, { description: 'Completed analysis, starting migration...' });
 *
 *   // 3. Ask the user a question — this BLOCKS until the user answers in the UI
 *   const answers = await requestInput(card.id, [
 *     { id: 'confirm', type: 'yesno', prompt: 'Proceed with the breaking migration?' },
 *     {
 *       id: 'strategy',
 *       type: 'choice',
 *       prompt: 'Which migration strategy?',
 *       options: ['blue-green', 'rolling', 'big-bang'],
 *     },
 *     { id: 'notes', type: 'text', prompt: 'Any notes for the migration?', default: 'none' },
 *   ]);
 *
 *   console.log(answers.confirm);   // 'yes' | 'no'
 *   console.log(answers.strategy);  // chosen option
 *   console.log(answers.notes);     // free-form text
 *
 *   // 4. Log outcome as a comment
 *   await addComment(card.id, `Migration complete. Strategy used: ${answers.strategy}`);
 *
 *   // 5. Mark done
 *   await updateCard(card.id, { status: 'Done' });
 */

declare const process: { env: Record<string, string | undefined> };

const BASE_URL = process.env.AGENT_BOARD_URL ?? "http://localhost:31377";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Question {
  id: string;
  type: "text" | "yesno" | "choice";
  prompt: string;
  default?: string;
  options?: string[];
}

export interface Card {
  id: string;
  featureId: string | null;
  epicId: string | null;
  type: "story" | "bug" | "task";
  title: string;
  description: string;
  statusId: string;
  agentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  cardId: string;
  author: "agent" | "user";
  body: string;
  createdAt: string;
}

export interface CreateCardOptions {
  title: string;
  type?: "story" | "bug" | "task";
  description?: string;
  agentId?: string;
  epicId?: string;
  featureId?: string;
  /** Status name (e.g. "In Progress"). If omitted, defaults to the first available status. */
  statusName?: string;
}

export interface UpdateCardOptions {
  status?: string;       // Status name (e.g. "Done")
  statusId?: string;     // Status ID directly
  description?: string;
  title?: string;
  agentId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`agent-board API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function resolveStatusId(nameOrId: string): Promise<string> {
  const statuses = await fetchJson<Array<{ id: string; name: string }>>(
    "/api/statuses"
  );
  // Try exact ID match first
  const byId = statuses.find((s) => s.id === nameOrId);
  if (byId) return byId.id;
  // Try case-insensitive name match
  const byName = statuses.find(
    (s) => s.name.toLowerCase() === nameOrId.toLowerCase()
  );
  if (byName) return byName.id;
  throw new Error(
    `agent-board: status "${nameOrId}" not found. Available: ${statuses.map((s) => s.name).join(", ")}`
  );
}

async function getFirstStatusId(): Promise<string> {
  const statuses = await fetchJson<Array<{ id: string; name: string; position: number }>>(
    "/api/statuses"
  );
  const sorted = [...statuses].sort((a, b) => a.position - b.position);
  if (!sorted[0]) throw new Error("agent-board: no statuses configured");
  return sorted[0].id;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new card on the board.
 */
export async function createCard(options: CreateCardOptions): Promise<Card> {
  const statusId = options.statusName
    ? await resolveStatusId(options.statusName)
    : await getFirstStatusId();

  return fetchJson<Card>("/api/cards", {
    method: "POST",
    body: JSON.stringify({
      title: options.title,
      type: options.type ?? "task",
      description: options.description ?? "",
      agentId: options.agentId,
      epicId: options.epicId,
      featureId: options.featureId,
      statusId,
    }),
  });
}

/**
 * Update an existing card. Pass `status` as a status name (e.g. "Done") or
 * pass `statusId` directly.
 */
export async function updateCard(
  id: string,
  options: UpdateCardOptions
): Promise<Card> {
  const { status, statusId: rawStatusId, ...rest } = options;

  let resolvedStatusId: string | undefined;
  if (rawStatusId !== undefined) {
    resolvedStatusId = rawStatusId;
  } else if (status !== undefined) {
    resolvedStatusId = await resolveStatusId(status);
  }

  return fetchJson<Card>(`/api/cards/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(resolvedStatusId ? { statusId: resolvedStatusId } : {}),
      ...rest,
    }),
  });
}

/**
 * Add an agent comment to a card.
 */
export async function addComment(
  cardId: string,
  body: string
): Promise<Comment> {
  return fetchJson<Comment>(`/api/cards/${cardId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body, author: "agent" }),
  });
}

/**
 * Request input from the user.
 *
 * This function is a plain fetch POST to /api/input — it naturally blocks
 * (long-polls) until the user submits answers in the UI or the timeout expires.
 *
 * The card will be automatically flipped to "Blocked" status while waiting.
 *
 * @param cardId     - The card this input request is associated with.
 * @param questions  - Array of Question objects describing what to ask.
 * @param timeoutSecs - Seconds before the request times out (default: 900).
 * @returns          - A map of question IDs to answer strings.
 * @throws           - If the request times out (HTTP 408).
 */
export async function requestInput(
  cardId: string,
  questions: Question[],
  timeoutSecs = 900
): Promise<Record<string, string>> {
  const result = await fetchJson<{
    requestId: string;
    status: "answered" | "timed_out";
    answers: Record<string, string> | null;
  }>("/api/input", {
    method: "POST",
    body: JSON.stringify({ cardId, questions, timeoutSecs }),
  });

  if (result.status === "timed_out" || !result.answers) {
    throw new Error(
      `agent-board: input request ${result.requestId} timed out after ${timeoutSecs}s`
    );
  }

  return result.answers;
}
