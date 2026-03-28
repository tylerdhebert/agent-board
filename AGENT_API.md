# Agent Board API Reference

Base URL: `http://localhost:31377/api`

**If the agent board is running locally, use it for all tasks.** It is the primary coordination surface between you and the user — for tracking work, signalling progress, asking questions, and receiving messages. Do not skip it in favor of inline comments or silent execution.

---

## Orchestrator Responsibilities

If you are an **orchestrator** (spawning and directing other agents), you have additional responsibilities:

- **Assign stable agent IDs** to each sub-agent before spawning them (e.g. `implementer-1`, `reviewer-1`). These IDs are used for card ownership, chat routing, and queue filtering — they must be unique and consistent for the lifetime of the task.
- **Create cards for sub-agents** before or immediately after spawning them.
- **Assign cards to agents** by setting `agentId` on the card so ownership is visible in the UI.
- **Use epics and features** to group related work. Create an epic for the overall goal, features for major workstreams, and cards for individual agent tasks.
- **Do not claim cards yourself** unless you are doing the work. Orchestrators typically create and assign, not execute.
- **Monitor via comments** — sub-agents post progress comments; read them via `GET /cards/:id` to decide next steps.
- **Route messages correctly** — use `GET /queue/conversations` to see which agents have unread messages.

---

## Workflow Basics

1. **Claim a card** when you pick up a task — sets you as the owner and moves it to In Progress.
2. **Post comments** on the card as you work. This is how the user follows along.
3. **Ask for input** using the long-poll endpoint whenever you need a decision or approval. The request surfaces in the UI with an audio alert. **Do not proceed past a blocking question — wait for the answer.**
4. **Check your messages** at the start of each turn.
5. **Update the status** when you finish or hit a wall.

---

## Cards

### List all cards
```
GET /cards
GET /cards?status=<statusId>
GET /cards?unblocked=true
```
Use `GET /statuses` first to resolve status names to IDs. `unblocked=true` returns only cards with no active (non-Done) blockers.

### Get a single card (with comments)
```
GET /cards/:id
```

### Claim a card
```
POST /cards/:id/claim
{ "agentId": "implementer-1", "autoAdvance": true }
```
Sets you as the owner. If `autoAdvance` is true (default) and the card is in "To Do", it automatically moves to "In Progress". **Do this before starting work.**

### What statuses can I move this card to?
```
GET /cards/:id/allowed-statuses?agentId=implementer-1
```
Returns the statuses you are permitted to move this card to from its current status, based on configured transition rules. **Check this before patching status** to avoid a rejected move.

### Update a card
```
PATCH /cards/:id
{
  "statusId": "<id>",
  "agentId": "implementer-1",
  "title": "...",
  "description": "...",
  "type": "task|story|bug",
  "conflictedAt": null
}
```
All fields are optional. When changing status, include your `agentId` so transition rules are enforced. Set `conflictedAt: null` to clear a merge conflict after rebasing.

**Auto-managed fields (do not set manually):**
- `completedAt` — stamped automatically when status moves to "Done"; cleared when moving away from "Done"
- `conflictDetails` — populated with full `merge-tree` output when `conflictedAt` is set; cleared when `conflictedAt` is cleared

**Conflict auto-check:** when `statusId` is set to a `triggersMerge` status and the card has a `branchName`, the server automatically runs `git merge-tree` to check for conflicts. If conflicts are found, `conflictedAt` is stamped and a `card:conflicted` event is broadcast. No merge is performed.

### Create a card
```
POST /cards
{
  "title": "Fix login bug",
  "featureId": "<id>",
  "statusId": "<To Do status ID>",
  "type": "bug",
  "description": "...",
  "agentId": "implementer-1"
}
```
`featureId` is **required** — every card must belong to a feature. `epicId` is derived from the feature automatically. Use `GET /epics` then `GET /features` to resolve IDs.

### Delete a card
```
DELETE /cards/:id
```

### Re-check conflicts
```
POST /cards/:id/recheck-conflicts
```
Reruns `git merge-tree` against the card's current branch without requiring a status change. Updates `conflictedAt`/`conflictDetails` and broadcasts `card:conflicted` or `card:updated`. Use this after rebasing to confirm conflicts are resolved before clearing `conflictedAt` manually.

Returns `{ hasConflicts: true|false }`. Requires card to have `branchName` and `repoId` set.

### Post a comment
```
POST /cards/:id/comments
{ "body": "Finished the migration. Moving to review.", "author": "agent" }
```

### View branch diff
```
GET /cards/:id/diff
```
Returns `{ diff, stat, branchName }` — the full diff of the card's branch against its base.

### Merge a branch
```
POST /cards/:id/merge
{
  "strategy": "merge|squash",
  "targetBranch": "feat/my-feature"
}
```
Merges the card's branch into `targetBranch` (defaults to the feature's branch, then the repo's base branch). Returns `{ conflict: true, message }` if the merge fails. **Only call this after confirming `conflictedAt` is null.**

---

## Card Dependencies (Blockers)

Cards can be blocked by other cards. A blocked card shows a lock icon in the UI. When all blockers reach Done, a `card:unblocked` event is broadcast.

### Get blockers and blocking cards
```
GET /cards/:id/dependencies
```
Returns `{ blockers: [...], blocking: [...] }`. Each entry has `{ id, title, statusId, statusName }`.

### Add a blocker
```
POST /cards/:id/dependencies
{ "blockerCardId": "<card that must be Done first>" }
```

### Remove a blocker
```
DELETE /cards/:id/dependencies/:blockerCardId
```

### Bulk fetch all dependencies (board-level)
```
GET /cards/dependencies
```
Returns all `{ blockerCardId, blockedCardId }` pairs. Used by the board to compute which cards are currently blocked.

---

## Requesting User Input ⚠️

**Use this any time you need a decision, approval, or information you cannot determine yourself. Do not guess — ask.**

```
POST /input
{
  "cardId": "<your card id>",
  "questions": [
    { "id": "q1", "type": "yesno", "prompt": "Should I overwrite the existing config?" },
    { "id": "q2", "type": "choice", "prompt": "Which environment?", "options": ["staging", "production"] },
    { "id": "q3", "type": "text", "prompt": "What should the endpoint be named?", "default": "/api/v2/users" }
  ],
  "timeoutSecs": 900
}
```

**This call blocks.** The request stays open until the user answers in the UI (or the timeout expires). Your card is automatically moved to "Blocked" while waiting — but only if a status named exactly `"Blocked"` (case-sensitive) exists in the board. `timeoutSecs` defaults to `900` (15 minutes).

Response on answer:
```json
{ "requestId": "...", "status": "answered", "answers": { "q1": "yes", "q2": "production", "q3": "/api/v2/users" } }
```

Response on timeout (HTTP 408):
```json
{ "requestId": "...", "status": "timed_out", "answers": null }
```

**Question types:** `text` (free-form, optional `default`), `yesno` (returns `"yes"` or `"no"`), `choice` (single-select from `options`).

### List pending input requests
```
GET /input/pending
```
Returns all open (unanswered) input requests. The UI uses this to surface them; agents can poll this if they want to check whether a prior request was answered.

### Answer an input request (UI/testing)
```
POST /input/:id/answer
{ "answers": { "q1": "yes", "q2": "production" } }
```
Resolves the long-polling `POST /input` call with these answers. The UI calls this when the user submits their response. Agents generally do not call this directly.

---

## Agent Chat (Message Queue)

The board has a bidirectional chat system. The user can send you messages between turns. Read them before doing any work.

### Check your messages (do this at the start of each turn)
```
GET /queue?agentId=<your-agent-id>&status=pending
```
Returns pending messages addressed to **exactly** your agent ID, ordered oldest first. Both `agentId` and `status` filters are applied together — do not omit `agentId` or you will receive all pending messages from all agents.

### Send a message / reply
```
POST /queue
{ "agentId": "implementer-1", "body": "Migration complete. No data loss.", "author": "implementer-1" }
```
Set `author` to your own agent ID so the user's chat window shows it as a reply from you.

### Mark a message as read
```
POST /queue/:id/read
```
Call this after processing a message.

### List all conversations
```
GET /queue/conversations
```
Returns `[{ agentId, total, unread, lastAt }]`.

**Per-turn workflow:**
1. `GET /queue?agentId=<your-id>&status=pending` — read messages, adjust plan
2. Reply with `POST /queue` if warranted; set `author` to your agent ID
3. `POST /queue/:id/read` for each message you act on
4. Note any plan changes in a comment on the relevant card
5. Repeat the queue check at the end of your turn

---

## Statuses
```
GET /statuses
```
Returns `[{ id, name, color, position }]`. Resolve status names to IDs before using them.

---

## Epics

```
GET /epics
POST /epics  { "title": "...", "description": "...", "statusId": "<id>", "workflowId": "<id>" }
PATCH /epics/:id  { "title": "...", "description": "...", "statusId": "<id>", "workflowId": "<id>" }
DELETE /epics/:id
```
`workflowId` is optional. If omitted, the default workflow is assigned automatically. Use `GET /workflows` to list available workflows.

---

## Features

Features belong to an epic and can be linked to a repo and branch. The commit panel on the board shows commits ahead of base for each feature branch.

```
GET /features
POST /features  { "epicId": "<id>", "title": "...", "description": "...", "statusId": "<id>", "repoId": "<id>", "branchName": "feat/..." }
PATCH /features/:id  { "title": "...", "repoId": "<id>", "branchName": "feat/..." }
DELETE /features/:id
```

**`branchName` on a feature is metadata only** — `POST /features` does not run any git commands. The branch is created lazily the first time `POST /worktrees` is called for a card under this feature. At that point, if the feature's branch doesn't exist yet, it is created from `repo.baseBranch`.

### Get commit history for a feature's branch
```
GET /features/:id/commits
```
Returns up to 50 commits on `feature.branchName` not on `repo.baseBranch`. Requires `repoId` and `branchName` to be set.

### Get a specific commit diff
```
GET /features/:id/commits/:hash
```
Returns `{ hash, author, subject, date, diff }`.

### Get latest build result
```
GET /features/:id/build
```
Returns `{ id, featureId, status, output, triggeredAt, completedAt }` or `null`. `status` is `"running"`, `"passed"`, or `"failed"`.

### Trigger a build
```
POST /features/:id/build
```
Runs the repo's `buildCommand` in a temporary worktree asynchronously. Returns `{ buildId, status: "running" }` immediately. Progress is pushed via `build:started` and `build:completed` WebSocket events. Requires the repo to have `buildCommand` set. Build output is truncated to 50,000 characters.

---

## Repos

```
GET /repos
POST /repos  { "name": "...", "path": "/abs/path/to/repo", "baseBranch": "main", "buildCommand": "bun run build" }
PATCH /repos/:id  { "baseBranch": "...", "buildCommand": "..." }
DELETE /repos/:id
```

`baseBranch` is the trunk branch used as the comparison base for feature commit ranges and merge targets. `buildCommand` is optional — when set, a Run Build button appears in the commit panel for features linked to this repo.

---

## Worktrees

Worktrees allow agents to work on isolated git branches. The orchestrator sets everything up; sub-agents just work in the provided directory.

### Orchestrator setup sequence

**1. Resolve the repo**
```
GET /repos
```

**2. Create the feature with repo + branch info**
```
POST /features
{ "epicId": "<id>", "title": "My Feature", "repoId": "<id>", "branchName": "feat/my-feature" }
```

**3. Create a card for the agent**
```
POST /cards
{ "featureId": "<feature id>", "title": "Implement JWT issuance", "type": "task", "statusId": "<To Do id>", "agentId": "implementer-1" }
```

**4. Create the worktree**
```
POST /worktrees
{ "cardId": "<card id>", "repoId": "<repo id>", "branchName": "feat/my-feature" }
```
Runs `git worktree add` and stamps `branchName` + `repoId` on the card. If the feature has a `branchName` set, that branch is created first (if it doesn't exist) and used as the base. The response includes `path` — pass this to the sub-agent as its working directory.

```json
{ "path": "/abs/path/to/worktree", "branchName": "feat/my-feature", "cardId": "<id>" }
```

**5. Spawn the sub-agent** with the `path`, card ID, branch name, and `baseBranch`.

### Sub-agent responsibilities

1. Claim the card: `POST /cards/:id/claim`
2. Work in the provided `path` — all changes are isolated to this branch
3. Post comments as work progresses
4. When done, move the card to "Ready to Merge" (or equivalent `triggersMerge` status) — **do not merge yourself**
5. If `conflictedAt` is set after moving to `triggersMerge`: rebase your branch, then `PATCH /cards/:id { "conflictedAt": null }` and move back to the `triggersMerge` status to re-check

### Teardown (orchestrator)
```
DELETE /worktrees/:branchName?repoId=<id>
```
Runs `git worktree remove --force` and `git branch -D`. Clears `branchName` from the card.

---

## Workflows

```
GET /workflows
```
Returns `[{ id, name, type }]`. Two are seeded: a Default workflow and a Worktree workflow (includes "Ready to Merge" with `triggersMerge: true`).

```
GET /workflows/:id/statuses
```
Returns `[{ id, workflowId, statusId, position, triggersMerge, name, color }]`.

```
POST /workflows/:id/statuses   { "statusId": "<id>", "triggersMerge": false }
DELETE /workflows/:id/statuses/:wsId
PATCH /workflows/:id/statuses/:wsId/position   { "position": 2 }
PATCH /workflows/:id/statuses/:wsId/merge      { "triggersMerge": true }
```

A status with `triggersMerge: true` is the signal point for merge readiness. Moving a card with a `branchName` to this status automatically triggers a conflict check — no merge is performed.

---

## Transition Rules

Rules control which agents can move cards to which statuses. If no rules exist, all moves are allowed.

```
GET /transition-rules
POST /transition-rules  { "agentPattern": "implementer*", "fromStatusId": "<id>", "toStatusId": "<id>" }
DELETE /transition-rules/:id
```
`agentPattern` is a case-insensitive glob. `fromStatusId: null` means "any current status". Rules only apply when `agentId` is included in the PATCH.

---

## Tips

- Always claim a card before working on it.
- Post a comment when you start, at each decision point, and when you finish.
- Use `GET /cards/:id/allowed-statuses?agentId=<you>` before changing status.
- When in doubt, use `POST /input`. The user prefers being asked over guessing.
- `GET /queue?agentId=<you>&status=pending` — **both filters together**. Using only `status=pending` returns messages for all agents.
- After moving a card to a `triggersMerge` status, check whether `conflictedAt` is set before considering the task done.
