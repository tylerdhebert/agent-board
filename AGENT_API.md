# Agent Board API Reference

Base URL: `http://localhost:31377/api`

---

## Cards

### List / Get
```
GET /cards
GET /cards?status=<statusId>
GET /cards?unblocked=true    # excludes cards with active (non-Done) blockers
GET /cards/:id               # includes comments
```

### Claim
```
POST /cards/:id/claim
{ "agentId": "implementer-1", "autoAdvance": true }
```
`autoAdvance: true` (default) moves "To Do" → "In Progress".

### Allowed transitions
```
GET /cards/:id/allowed-statuses?agentId=implementer-1
```
Check before patching status — returns permitted transitions for your agent.

### Update
```
PATCH /cards/:id
{ "statusId": "<id>", "agentId": "implementer-1", "title": "...", "description": "...", "type": "task|story|bug", "conflictedAt": null }
```
Include `agentId` when changing status so transition rules are enforced. Set `conflictedAt: null` to clear a conflict after rebasing. Do not set `completedAt` or `conflictDetails` — auto-managed.

When moving to a `triggersMerge` status, the server auto-runs `git merge-tree`; if conflicts are found, `conflictedAt` is stamped and `card:conflicted` is broadcast. No merge is performed.

### Create
```
POST /cards
{ "title": "...", "featureId": "<id>", "statusId": "<To Do id>", "type": "task|story|bug", "description": "...", "agentId": "implementer-1" }
```
`featureId` is **required**. Use `GET /statuses` to resolve status names to IDs.

### Other
```
DELETE /cards/:id

POST /cards/:id/recheck-conflicts          # reruns git merge-tree; returns { hasConflicts: bool }
POST /cards/:id/comments  { "body": "...", "author": "agent" }
GET  /cards/:id/diff                       # { diff, stat, branchName }
POST /cards/:id/merge  { "strategy": "merge|squash", "targetBranch": "feat/..." }
```
`targetBranch` defaults to feature branch then repo base branch. Only call after `conflictedAt` is null.

---

## Card Dependencies (Blockers)

```
GET    /cards/:id/dependencies             # { blockers: [...], blocking: [...] }
POST   /cards/:id/dependencies  { "blockerCardId": "<id>" }
DELETE /cards/:id/dependencies/:blockerCardId
GET    /cards/dependencies                 # all pairs board-wide
```

---

## Requesting User Input ⚠️

**Use any time you need a decision you cannot determine yourself. Do not guess.**

```
POST /input
{
  "cardId": "<your card id>",
  "questions": [
    { "id": "q1", "type": "yesno",   "prompt": "Overwrite existing config?" },
    { "id": "q2", "type": "choice",  "prompt": "Which environment?", "options": ["staging", "production"] },
    { "id": "q3", "type": "text",    "prompt": "Endpoint name?", "default": "/api/v2/users" }
  ],
  "timeoutSecs": 900
}
```

**Blocks** until answered or timeout. Card is auto-moved to "Blocked" while pending (requires a status named exactly `"Blocked"`). Default: 900s.

- Answer: `{ status: "answered", answers: { "q1": "yes", "q2": "production", "q3": "/api/v2/users" } }`
- Timeout (HTTP 408): `{ status: "timed_out", answers: null }`
- Types: `text` (free-form, optional `default`), `yesno` → `"yes"`/`"no"`, `choice` (single-select)

```
GET  /input/pending
POST /input/:id/answer  { "answers": { "q1": "yes" } }   # UI use; agents generally don't call this
```

---

## Agent Chat (Message Queue)

```
GET  /queue?agentId=<your-id>&status=pending   # pending messages, oldest first; always include both params
POST /queue  { "agentId": "implementer-1", "body": "...", "author": "implementer-1" }
POST /queue/:id/read
GET  /queue/conversations                      # [{ agentId, total, unread, lastAt }]
```

---

## Statuses / Epics / Repos

```
GET /statuses   # [{ id, name, color, position }]

GET /epics
POST   /epics      { "title": "...", "description": "...", "statusId": "<id>", "workflowId": "<id>" }
PATCH  /epics/:id  { "title": "...", "statusId": "...", "workflowId": "..." }
DELETE /epics/:id

GET /repos
POST   /repos      { "name": "...", "path": "/abs/path", "baseBranch": "main", "buildCommand": "bun run build" }
PATCH  /repos/:id  { "baseBranch": "...", "buildCommand": "..." }
DELETE /repos/:id
```

---

## Features

`branchName` is metadata only — branch is created lazily on first `POST /worktrees`.

```
GET /features
POST   /features      { "epicId": "<id>", "title": "...", "statusId": "<id>", "repoId": "<id>", "branchName": "feat/..." }
PATCH  /features/:id  { "title": "...", "repoId": "<id>", "branchName": "feat/..." }
DELETE /features/:id
GET    /features/:id/commits          # up to 50 commits on branch not on baseBranch
GET    /features/:id/commits/:hash    # { hash, author, subject, date, diff }
GET    /features/:id/build            # { status: "running"|"passed"|"failed", output, ... } | null
POST   /features/:id/build            # runs repo's buildCommand async
```

---

## Worktrees

### Orchestrator setup
```
# 1. Resolve repo
GET /repos

# 2. Create feature
POST /features  { "epicId": "<id>", "title": "...", "repoId": "<id>", "branchName": "feat/my-feature" }

# 3. Create card
POST /cards  { "featureId": "<id>", "title": "...", "type": "task", "statusId": "<To Do id>", "agentId": "implementer-1" }

# 4. Create worktree — returns { path, branchName, cardId }
POST /worktrees  { "cardId": "<id>", "repoId": "<id>", "branchName": "feat/my-feature" }
```
Pass the returned `path`, card ID, branch name, and `baseBranch` to the sub-agent.

### Sub-agent responsibilities
1. `POST /cards/:id/claim`
2. Work in the provided `path`
3. Post comments as work progresses
4. Move to "Ready to Merge" when done — **do not merge yourself**
5. If `conflictedAt` is set: rebase, `PATCH /cards/:id { "conflictedAt": null }`, move back to re-check

### Teardown
```
DELETE /worktrees/:branchName?repoId=<id>   # removes worktree + branch; clears branchName from card
```

---

## Workflows

```
GET /workflows                              # [{ id, name, type }]
GET /workflows/:id/statuses                # [{ id, statusId, position, triggersMerge, name, color }]
POST   /workflows/:id/statuses             { "statusId": "<id>", "triggersMerge": false }
DELETE /workflows/:id/statuses/:wsId
PATCH  /workflows/:id/statuses/:wsId/position  { "position": 2 }
PATCH  /workflows/:id/statuses/:wsId/merge     { "triggersMerge": true }
```
Moving a card with a `branchName` to a `triggersMerge` status triggers an auto conflict check (no merge).

---

## Transition Rules

```
GET    /transition-rules
POST   /transition-rules  { "agentPattern": "implementer*", "fromStatusId": "<id>", "toStatusId": "<id>" }
DELETE /transition-rules/:id
```
`agentPattern` is a case-insensitive glob. `fromStatusId: null` = any status. Rules only apply when `agentId` is included in the PATCH.
