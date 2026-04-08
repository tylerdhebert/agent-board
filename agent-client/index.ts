/**
 * agent-client — typed HTTP SDK for AI agents interacting with agent-board.
 *
 * Typical multi-turn agent loop:
 *
 *   import * as board from './agent-client/index.ts';
 *
 *   const AGENT_ID = 'implementer-1';
 *
 *   // --- Turn start ---
 *   // 1. Read and acknowledge any messages from the user or orchestrator
 *   const messages = await board.checkMessages(AGENT_ID);
 *   for (const msg of messages) {
 *     console.log(`[msg] ${msg.author}: ${msg.body}`);
 *     await board.markMessageRead(msg.id);
 *   }
 *
 *   // 2. Claim the card assigned to this agent
 *   const card = await board.claimCard(cardId, AGENT_ID, true);
 *
 *   // 3. Check allowed transitions before moving status
 *   const allowed = await board.getAllowedStatuses(card.id, AGENT_ID);
 *
 *   // 4. Work — post comments at each decision point
 *   await board.addComment(card.id, 'Starting implementation...');
 *
 *   // 5. Ask the user if approval is needed — this BLOCKS until answered
 *   const answers = await board.requestInput(card.id, [
 *     { id: 'proceed', type: 'yesno', prompt: 'Proceed with the breaking migration?' },
 *   ]);
 *
 *   // 6. Move to Ready to Merge when done (triggersMerge status auto-checks conflicts)
 *   await board.updateCard(card.id, { statusId: readyToMergeId, agentId: AGENT_ID });
 *
 *   // 7. Check for conflicts after moving to a triggersMerge status
 *   const updated = await board.getCard(card.id);
 *   if (updated.conflictedAt) {
 *     // rebase your branch, then clear the flag and re-trigger the check
 *     await board.updateCard(card.id, { conflictedAt: null });
 *   }
 *
 *   // 8. Re-check messages at end of turn
 *   const closing = await board.checkMessages(AGENT_ID);
 *   for (const msg of closing) await board.markMessageRead(msg.id);
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

export interface InputRequestRecord {
  id: string;
  cardId: string;
  previousStatusId: string | null;
  questions: Question[];
  answers: Record<string, string> | null;
  status: "pending" | "answered" | "timed_out";
  requestedAt: string;
  answeredAt: string | null;
  timeoutSecs: number;
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
  branchName: string | null;
  repoId: string | null;
  conflictedAt: string | null;
  conflictDetails: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CardWithComments extends Card {
  comments: Comment[];
}

export interface Comment {
  id: string;
  cardId: string;
  author: "agent" | "user";
  agentId?: string | null;
  body: string;
  createdAt: string;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface AllowedStatus {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  statusId: string;
  workflowId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Feature {
  id: string;
  epicId: string;
  title: string;
  description: string;
  statusId: string;
  repoId: string | null;
  branchName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Repo {
  id: string;
  name: string;
  path: string;
  baseBranch: string;
  buildCommand: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  type: string;
}

export interface QueueMessage {
  id: string;
  agentId: string;
  author: string;
  body: string;
  status: "pending" | "read";
  createdAt: string;
}

export interface Conversation {
  agentId: string;
  total: number;
  unread: number;
  lastAt: string;
}

export interface DependencyEntry {
  id: string;
  title: string;
  statusId: string;
  statusName: string;
}

export interface Dependencies {
  blockers: DependencyEntry[];
  blocking: DependencyEntry[];
}

export interface CardDiff {
  diff: string;
  stat: string;
  branchName: string;
}

export interface MergeResult {
  conflict: boolean;
  message: string;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
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
  /** Status ID directly, takes precedence over statusName. */
  statusId?: string;
}

export interface UpdateCardOptions {
  title?: string;
  description?: string;
  /** Status name (e.g. "Done") — resolved to an ID automatically. */
  status?: string;
  /** Status ID directly, takes precedence over status. */
  statusId?: string;
  /** Agent ID to associate with this card. Include when changing status so transition rules are enforced. */
  agentId?: string;
  /** Set to null to clear a merge conflict after rebasing. */
  conflictedAt?: null;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveStatusId(nameOrId: string): Promise<string> {
  const statuses = await fetchJson<Status[]>("/api/statuses");
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
  const statuses = await fetchJson<Status[]>("/api/statuses");
  const sorted = [...statuses].sort((a, b) => a.position - b.position);
  if (!sorted[0]) throw new Error("agent-board: no statuses configured");
  return sorted[0].id;
}

// ---------------------------------------------------------------------------
// Queue / Chat
// ---------------------------------------------------------------------------

/**
 * Check pending messages addressed to this agent.
 *
 * Call this at the start (and end) of every turn. Both filters are applied
 * together — always pass agentId or you will receive messages for all agents.
 *
 * @param agentId - Your agent's stable ID.
 */
export async function checkMessages(agentId: string): Promise<QueueMessage[]> {
  return fetchJson<QueueMessage[]>(
    `/api/queue?agentId=${encodeURIComponent(agentId)}&status=pending`
  );
}

/**
 * Send a message (or reply) to the user.
 *
 * Set author to your own agent ID so the chat window correctly attributes
 * the message to you.
 *
 * @param agentId - The conversation thread to post into (usually your own ID).
 * @param body    - Message text.
 */
export async function sendMessage(
  agentId: string,
  body: string
): Promise<QueueMessage> {
  return fetchJson<QueueMessage>("/api/queue", {
    method: "POST",
    body: JSON.stringify({ agentId, body, author: agentId }),
  });
}

/**
 * Mark a message as read after you have processed it.
 *
 * @param messageId - The message's ID from checkMessages.
 */
export async function markMessageRead(messageId: string): Promise<void> {
  await fetchJson<unknown>(`/api/queue/${messageId}/read`, {
    method: "POST",
  });
}

/**
 * List all agent conversations with unread counts.
 *
 * Useful for orchestrators deciding which agents need attention.
 */
export async function getConversations(): Promise<Conversation[]> {
  return fetchJson<Conversation[]>("/api/queue/conversations");
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/**
 * Fetch a single card and its comments.
 *
 * @param id - Card ID.
 */
export async function getCard(id: string): Promise<CardWithComments> {
  return fetchJson<CardWithComments>(`/api/cards/${id}`);
}

/**
 * List cards, optionally filtered by status or blocked state.
 *
 * Resolve status names to IDs via getStatuses() before filtering by status.
 *
 * @param opts.status    - Filter by status ID.
 * @param opts.unblocked - When true, returns only cards with no active blockers.
 */
export async function listCards(
  opts: { status?: string; unblocked?: boolean } = {}
): Promise<Card[]> {
  const params = new URLSearchParams();
  if (opts.status !== undefined) params.set("status", opts.status);
  if (opts.unblocked !== undefined) params.set("unblocked", String(opts.unblocked));
  const query = params.toString();
  return fetchJson<Card[]>(`/api/cards${query ? `?${query}` : ""}`);
}

/**
 * Claim a card and become its owner.
 *
 * Call this before starting work on any card. If autoAdvance is true (default)
 * and the card is in "To Do", it automatically moves to "In Progress".
 *
 * @param id          - Card ID.
 * @param agentId     - Your agent ID.
 * @param autoAdvance - Automatically advance from To Do to In Progress (default: true).
 */
export async function claimCard(
  id: string,
  agentId: string,
  autoAdvance = true
): Promise<Card> {
  return fetchJson<Card>(`/api/cards/${id}/claim`, {
    method: "POST",
    body: JSON.stringify({ agentId, autoAdvance }),
  });
}

/**
 * Get the statuses this agent is allowed to move a card to from its current status.
 *
 * Always check this before patching status to avoid rejected moves.
 *
 * @param cardId  - Card ID.
 * @param agentId - Your agent ID (used to evaluate transition rules).
 */
export async function getAllowedStatuses(
  cardId: string,
  agentId: string
): Promise<AllowedStatus[]> {
  return fetchJson<AllowedStatus[]>(
    `/api/cards/${cardId}/allowed-statuses?agentId=${encodeURIComponent(agentId)}`
  );
}

/**
 * Update a card's fields.
 *
 * Pass status (name) or statusId when changing status. Include agentId when
 * changing status so transition rules are enforced. Set conflictedAt: null
 * to clear a merge conflict after rebasing.
 *
 * @param id   - Card ID.
 * @param opts - Fields to update (all optional).
 */
export async function updateCard(
  id: string,
  opts: UpdateCardOptions
): Promise<Card> {
  const { status, statusId: rawStatusId, ...rest } = opts;

  let resolvedStatusId: string | undefined;
  if (rawStatusId !== undefined) {
    resolvedStatusId = rawStatusId;
  } else if (status !== undefined) {
    resolvedStatusId = await resolveStatusId(status);
  }

  return fetchJson<Card>(`/api/cards/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(resolvedStatusId !== undefined ? { statusId: resolvedStatusId } : {}),
      ...rest,
    }),
  });
}

/**
 * Create a new card on the board.
 *
 * featureId is required by the API — every card must belong to a feature.
 * Provide statusName (e.g. "In Progress") or statusId; if neither is given,
 * the first status by position is used.
 *
 * @param opts - Card creation options.
 */
export async function createCard(opts: CreateCardOptions): Promise<Card> {
  let statusId: string;
  if (opts.statusId) {
    statusId = opts.statusId;
  } else if (opts.statusName) {
    statusId = await resolveStatusId(opts.statusName);
  } else {
    statusId = await getFirstStatusId();
  }

  return fetchJson<Card>("/api/cards", {
    method: "POST",
    body: JSON.stringify({
      title: opts.title,
      type: opts.type ?? "task",
      description: opts.description ?? "",
      agentId: opts.agentId,
      epicId: opts.epicId,
      featureId: opts.featureId,
      statusId,
    }),
  });
}

/**
 * Delete a card permanently.
 *
 * @param id - Card ID.
 */
export async function deleteCard(id: string): Promise<void> {
  await fetchJson<unknown>(`/api/cards/${id}`, { method: "DELETE" });
}

/**
 * Post a comment on a card.
 *
 * Post at the start of work, at each decision point, and when finished.
 * This is how the user and orchestrator follow progress.
 *
 * @param cardId - Card ID.
 * @param body   - Comment text.
 * @param author - Defaults to "agent".
 */
export async function addComment(
  cardId: string,
  body: string,
  options: { author?: "agent" | "user"; agentId?: string } = {}
): Promise<Comment> {
  const author = options.author ?? "agent";
  if (author === "agent" && !options.agentId) {
    throw new Error("agent-board: agent comments require agentId for auditability");
  }
  return fetchJson<Comment>(`/api/cards/${cardId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body, author, agentId: options.agentId }),
  });
}

/**
 * Get the full diff of a card's branch against its base.
 *
 * Returns diff, stat, and branchName.
 *
 * @param cardId - Card ID.
 */
export async function getCardDiff(cardId: string): Promise<CardDiff> {
  return fetchJson<CardDiff>(`/api/cards/${cardId}/diff`);
}

/**
 * Merge the card's branch into a target branch.
 *
 * Only call this after confirming conflictedAt is null. Returns
 * { conflict: true, message } if the merge cannot complete cleanly.
 *
 * @param cardId          - Card ID.
 * @param opts.strategy   - "merge" or "squash" (default: "merge").
 * @param opts.targetBranch - Branch to merge into (defaults to feature branch, then repo base branch).
 */
export async function mergeCard(
  cardId: string,
  opts: { strategy?: "merge" | "squash"; targetBranch?: string } = {}
): Promise<MergeResult> {
  return fetchJson<MergeResult>(`/api/cards/${cardId}/merge`, {
    method: "POST",
    body: JSON.stringify(opts),
  });
}

/**
 * Re-run the conflict check for a card's branch without requiring a status change.
 *
 * Use this after rebasing to confirm conflicts are resolved before manually
 * clearing conflictedAt. Requires the card to have branchName and repoId set.
 *
 * @param cardId - Card ID.
 */
export async function recheckConflicts(
  cardId: string
): Promise<ConflictCheckResult> {
  return fetchJson<ConflictCheckResult>(
    `/api/cards/${cardId}/recheck-conflicts`,
    { method: "POST" }
  );
}

// ---------------------------------------------------------------------------
// Card Dependencies (Blockers)
// ---------------------------------------------------------------------------

/**
 * Get the blockers and blocking cards for a given card.
 *
 * @param cardId - Card ID.
 */
export async function getDependencies(cardId: string): Promise<Dependencies> {
  return fetchJson<Dependencies>(`/api/cards/${cardId}/dependencies`);
}

/**
 * Add a blocker: this card cannot proceed until blockerCardId reaches Done.
 *
 * @param cardId        - The card being blocked.
 * @param blockerCardId - The card that must be Done first.
 */
export async function addBlocker(
  cardId: string,
  blockerCardId: string
): Promise<void> {
  await fetchJson<unknown>(`/api/cards/${cardId}/dependencies`, {
    method: "POST",
    body: JSON.stringify({ blockerCardId }),
  });
}

/**
 * Remove a blocker relationship.
 *
 * @param cardId        - The blocked card.
 * @param blockerCardId - The blocker card to remove.
 */
export async function removeBlocker(
  cardId: string,
  blockerCardId: string
): Promise<void> {
  await fetchJson<unknown>(
    `/api/cards/${cardId}/dependencies/${blockerCardId}`,
    { method: "DELETE" }
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Request input from the user.
 *
 * This call blocks — the HTTP request stays open until the user submits
 * answers in the UI or the timeout expires. The card is automatically moved
 * to "Blocked" while waiting (if that status exists).
 *
 * Do not proceed past a blocking question — wait for the answer.
 *
 * @param cardId      - The card this input request is associated with.
 * @param questions   - Array of Question objects describing what to ask.
 * @param timeoutSecs - Seconds before the request times out (default: 900).
 * @returns           - A map of question IDs to answer strings.
 * @throws            - If the request times out (HTTP 408).
 */
export async function requestInput(
  cardId: string,
  questions: Question[],
  timeoutSecs = 900
): Promise<Record<string, string>> {
  const request = await createInputRequest(cardId, questions, timeoutSecs);
  const result = await waitForInputRequest(request.id, timeoutSecs);

  if (result.status === "timed_out" || !result.answers) {
    throw new Error(
      `agent-board: input request ${result.requestId} timed out after ${timeoutSecs}s — no answer received`
    );
  }

  return result.answers;
}

/**
 * Low-level helper: create an input request record without waiting.
 *
 * Most agents should not call this directly. Prefer requestInput(), which
 * creates the request and then waits for an answer or timeout in the same
 * control flow. If you do call this helper, you must immediately follow it
 * with waitForInputRequest(request.id, ...) before continuing or ending turn.
 */
export async function createInputRequest(
  cardId: string,
  questions: Question[],
  timeoutSecs = 900
): Promise<InputRequestRecord> {
  return fetchJson<InputRequestRecord>("/api/input", {
    method: "POST",
    body: JSON.stringify({ cardId, questions, timeoutSecs, detach: true }),
  });
}

export async function getInputRequest(requestId: string): Promise<InputRequestRecord> {
  return fetchJson<InputRequestRecord>(`/api/input/${requestId}`);
}

export async function waitForInputRequest(
  requestId: string,
  timeoutSecs?: number,
  pollIntervalSecs = 2
): Promise<{
  requestId: string;
  status: "answered" | "timed_out";
  answers: Record<string, string> | null;
}> {
  const startedAt = Date.now();
  const deadlineAt =
    typeof timeoutSecs === "number" ? startedAt + (timeoutSecs * 1000) : null;

  for (;;) {
    if (deadlineAt !== null && Date.now() > deadlineAt) {
      throw new Error(`agent-board: timed out waiting for input request ${requestId} after ${timeoutSecs}s`);
    }

    const request = await getInputRequest(requestId);
    if (request.status === "answered" || request.status === "timed_out") {
      return {
        requestId,
        status: request.status,
        answers: request.answers,
      };
    }
    await sleep(pollIntervalSecs * 1000);
  }
}

export async function listInputRequests(
  opts: { status?: "pending" | "answered" | "timed_out"; cardId?: string } = {}
): Promise<InputRequestRecord[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.cardId) params.set("cardId", opts.cardId);
  const query = params.toString();
  return fetchJson<InputRequestRecord[]>(`/api/input${query ? `?${query}` : ""}`);
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * List all statuses. Use this to resolve status names to IDs before filtering
 * cards or updating status.
 */
export async function getStatuses(): Promise<Status[]> {
  return fetchJson<Status[]>("/api/statuses");
}

/**
 * List all epics.
 */
export async function getEpics(): Promise<Epic[]> {
  return fetchJson<Epic[]>("/api/epics");
}

/**
 * List all features.
 */
export async function getFeatures(): Promise<Feature[]> {
  return fetchJson<Feature[]>("/api/features");
}

/**
 * List all repos.
 */
export async function getRepos(): Promise<Repo[]> {
  return fetchJson<Repo[]>("/api/repos");
}

/**
 * List all workflows.
 *
 * Two are seeded by default: a Default workflow and a Worktree workflow
 * (which includes a "Ready to Merge" status with triggersMerge: true).
 */
export async function getWorkflows(): Promise<Workflow[]> {
  return fetchJson<Workflow[]>("/api/workflows");
}
