# Agent Board API Reference

Base URL: `http://localhost:31377/api`

Preferred interface: `AGENT_CLI.md`

Use the CLI by default. This file is the canonical raw HTTP contract and edge-case reference.

CLI aliases such as `session`, `inbox`, singular/plural resource names, and workflow helpers like `start` or `finish` are implemented in the repo CLI only. They are not raw HTTP endpoints.

## Identity and status enforcement

- `agentId` is an arbitrary caller-chosen string such as `implementer-1`.
- Queue conversations are keyed by exact `agentId`.
- Transition rules are only enforced when a card status change includes `agentId`.
- Omitting `agentId` during `PATCH /cards/:id` bypasses transition-rule enforcement.

## Health

```http
GET /health
```

Response:

```json
{ "ok": true }
```

## Statuses

```http
GET    /statuses
POST   /statuses
PATCH  /statuses/:id
DELETE /statuses/:id
```

Bodies:

```json
POST /statuses
{ "name": "In Review", "color": "#a855f7" }

PATCH /statuses/:id
{ "name": "Blocked External", "color": "#ef4444", "position": 4 }
```

Notes:

- `GET /statuses` is ordered by `position`.
- `POST /statuses` auto-assigns the next `position` if one is not supplied.

## Repos

```http
GET    /repos
POST   /repos
PATCH  /repos/:id
DELETE /repos/:id
```

Bodies:

```json
POST /repos
{
  "name": "agent-board",
  "path": "C:\\Users\\Tyler\\Documents\\projects\\agent-board",
  "baseBranch": "main",
  "compareBase": "origin/main",
  "buildCommand": "bun run build"
}
```

Notes:

- `baseBranch` defaults to `main`.
- `compareBase` is used for epic-level commit browsing.
- `buildCommand` is optional but required for feature builds.

## Epics

```http
GET    /epics
POST   /epics
PATCH  /epics/:id
DELETE /epics/:id

GET    /epics/:id/commits?repoId=<repoId>
GET    /epics/:id/commits/:hash?repoId=<repoId>
```

Bodies:

```json
POST /epics
{
  "title": "Agent Operations CLI + Protocol",
  "description": "Create the CLI-first agent workflow",
  "statusId": "status-id",
  "workflowId": "workflow-id"
}
```

Notes:

- If `workflowId` is omitted, the server defaults to the first workflow of type `default`.
- Deleting an epic cascades through its features and cards.
- Epic commit browsing is repo-scoped, not feature-branch-scoped.
- The compared range is:
  - `compareBase..baseBranch` when `compareBase` exists
  - otherwise `baseBranch`

## Features

```http
GET    /features
POST   /features
PATCH  /features/:id
DELETE /features/:id

GET    /features/:id/commits
GET    /features/:id/commits/:hash

GET    /features/:id/build
POST   /features/:id/build
```

Bodies:

```json
POST /features
{
  "epicId": "epic-id",
  "title": "Agent CLI and documentation",
  "description": "CLI-first agent operations",
  "statusId": "status-id",
  "repoId": "repo-id",
  "branchName": "feat/agent-cli"
}
```

Notes:

- Feature commit browsing compares `repo.baseBranch..feature.branchName`.
- `POST /features/:id/build` requires:
  - `repoId`
  - `branchName`
  - repo `buildCommand`
- Builds run asynchronously in a detached temporary worktree.
- `GET /features/:id/build` returns the latest build result or `null`.

## Cards

### List and inspect

```http
GET /cards
GET /cards?status=<statusId>
GET /cards?unblocked=true
GET /cards/:id
GET /cards/completed-today
GET /cards/:id/allowed-statuses?agentId=<agentId>
```

Notes:

- `GET /cards/:id` returns the card plus embedded `comments`.
- `unblocked=true` excludes cards with any active blocker whose blocker card is not in `Done`.
- `allowed-statuses` returns every status when:
  - no transition rules exist, or
  - no `agentId` is supplied

### Create, claim, update, delete

```http
POST   /cards
POST   /cards/:id/claim
PATCH  /cards/:id
DELETE /cards/:id
```

Bodies:

```json
POST /cards
{
  "title": "Implement queue helpers",
  "featureId": "feature-id",
  "statusId": "status-id",
  "type": "task",
  "description": "Implement the queue subcommands",
  "agentId": "implementer-1"
}

POST /cards/:id/claim
{
  "agentId": "implementer-1",
  "autoAdvance": true
}

PATCH /cards/:id
{
  "title": "Sharper title",
  "description": "Updated description",
  "statusId": "status-id",
  "agentId": "implementer-1",
  "featureId": "feature-id",
  "epicId": "epic-id",
  "type": "bug",
  "conflictedAt": null,
  "conflictDetails": null
}
```

Critical behavior:

- Card creation requires a valid `featureId`.
- The server copies `epicId` from the feature during card creation.
- Claiming sets `agentId`.
- Claiming auto-advances `To Do -> In Progress` unless `autoAdvance` is `false`.
- Moving a card to `Done` stamps `completedAt`.
- Moving a card away from `Done` clears `completedAt`.
- Transition rules are enforced only when the patch includes `agentId`.

### Comments

```http
POST /cards/:id/comments
```

Body:

```json
{ "body": "Checkpoint: build passed.", "author": "agent" }
```

Allowed authors:

- `agent`
- `user`

### Diff, merge, conflict checks

```http
GET  /cards/:id/diff
POST /cards/:id/recheck-conflicts
POST /cards/:id/merge
```

Bodies:

```json
POST /cards/:id/merge
{ "strategy": "squash", "targetBranch": "main" }
```

Notes:

- `GET /cards/:id/diff` compares `repo.baseBranch...card.branchName`.
- `POST /cards/:id/recheck-conflicts` reruns `git merge-tree` and updates `conflictedAt` and `conflictDetails`.
- `POST /cards/:id/merge` is a destructive orchestration route. It:
  - refuses when `conflictedAt` is still set
  - removes the worktree
  - checks out the target branch
  - merges or squash-merges the card branch
  - deletes the merged branch
  - clears `branchName`
  - moves the card to `Done` when that status exists

### Automatic conflict checks on status moves

When a card moves to a workflow status where `triggersMerge = true` and the card has both `branchName` and `repoId`, the server automatically runs `git merge-tree`.

Target branch resolution:

1. `feature.branchName` if present
2. otherwise `repo.baseBranch`

Effects:

- conflicts found: `conflictedAt` is stamped and `conflictDetails` is stored
- no conflicts: prior conflict state is cleared

## Card dependencies

```http
GET    /cards/dependencies
GET    /cards/:id/dependencies
POST   /cards/:id/dependencies
DELETE /cards/:id/dependencies/:blockerCardId
```

Bodies:

```json
POST /cards/:id/dependencies
{ "blockerCardId": "blocking-card-id" }
```

Notes:

- `:id` is the blocked card.
- Self-blocking is rejected.
- When a blocker reaches `Done`, the server emits an unblock event if the dependent card is no longer blocked by any active blocker.

## Input requests

```http
GET  /input
GET  /input?status=<pending|answered|timed_out>&cardId=<cardId>
GET  /input/pending
GET  /input/:id
POST /input
POST /input/:id/answer
```

Bodies:

```json
POST /input
{
  "cardId": "card-id",
  "questions": [
    { "id": "q1", "type": "yesno", "prompt": "Overwrite config?" },
    { "id": "q2", "type": "choice", "prompt": "Which env?", "options": ["staging", "prod"] },
    { "id": "q3", "type": "text", "prompt": "Endpoint name", "default": "/api/v2/users" }
  ],
  "timeoutSecs": 900
}

POST /input
{
  "cardId": "card-id",
  "questions": [
    { "id": "q1", "type": "yesno", "prompt": "Overwrite config?" }
  ],
  "timeoutSecs": 900,
  "detach": true
}

POST /input/:id/answer
{
  "answers": {
    "q1": "yes",
    "q2": "staging",
    "q3": "/api/v2/users"
  }
}
```

Notes:

- `POST /input` long-polls until the request is answered or times out.
- `POST /input` with `"detach": true` creates the request and returns immediately with the saved request record.
- `GET /input/:id` is the recovery/read path for a specific request.
- `GET /input` lists requests and supports filtering by `status` and `cardId`.
- If a status named exactly `Blocked` exists, the server moves the card there while the request is pending.
- The server records `previousStatusId`.
- On answer or timeout, the previous status is restored only if the card is still in `Blocked`.
- Timeout response is HTTP `408` with:

```json
{ "requestId": "request-id", "status": "timed_out", "answers": null }
```

- Agents using the CLI should issue `input request` and then wait for an answer or a timeout. They must not continue work past the blocking decision.

## Queue and communication

```http
GET    /queue/conversations
GET    /queue?agentId=<agentId>&status=<pending|read>
POST   /queue
POST   /queue/:id/read
DELETE /queue/conversations/:agentId
DELETE /queue/:id
```

Bodies:

```json
POST /queue
{
  "agentId": "implementer-1",
  "body": "Please prioritize the auth bug.",
  "author": "user"
}
```

Notes:

- `agentId` matching is exact.
- `POST /queue` defaults `author` to `"user"` when omitted.
- For agent replies inside their own thread, use:
  - `agentId = <agent-id>`
  - `author = <agent-id>`
- Conversation unread counts count `pending` messages whose `author != "user"`.

## Worktrees

```http
POST   /worktrees
DELETE /worktrees/:branchName?repoId=<repoId>
```

Bodies:

```json
POST /worktrees
{
  "cardId": "card-id",
  "repoId": "repo-id",
  "branchName": "wt/implementer-1/agent-cli",
  "baseBranch": "main"
}
```

Creation behavior:

- the repo must exist
- the worktree path is derived from `repo.path` plus branch name
- base branch resolution is:
  1. explicit `baseBranch`
  2. `feature.branchName` if present
  3. otherwise `HEAD`
- if the chosen feature branch does not exist yet, the server creates it from `repo.baseBranch`
- if the requested card branch already exists, the server adds the worktree without `-b`
- the card's `branchName` and `repoId` are updated on success

Deletion behavior:

- removes the worktree
- deletes the branch
- clears `branchName` on any card using that branch

## Workflows

```http
GET    /workflows
GET    /workflows/:id/statuses
POST   /workflows/:id/statuses
DELETE /workflows/:id/statuses/:wsId
PATCH  /workflows/:id/statuses/:wsId/position
PATCH  /workflows/:id/statuses/:wsId/merge
PATCH  /workflows/:id/statuses/:wsId
```

Notes:

- `GET /workflows/:id/statuses` returns workflow-status rows joined with status metadata.
- The joined status display field is `name`, not `statusName`.

Bodies:

```json
POST /workflows/:id/statuses
{ "statusId": "status-id", "triggersMerge": true }

PATCH /workflows/:id/statuses/:wsId/position
{ "position": 3 }

PATCH /workflows/:id/statuses/:wsId/merge
{ "triggersMerge": true }
```

Notes:

- `GET /workflows/:id/statuses` returns joined metadata including `name` and `color`.
- `PATCH /workflows/:id/statuses/:wsId` is a legacy generic route. Prefer the dedicated `/position` and `/merge` endpoints.

## Transition rules

```http
GET    /transition-rules
POST   /transition-rules
DELETE /transition-rules/:id
```

Bodies:

```json
POST /transition-rules
{
  "toStatusId": "status-id",
  "fromStatusId": "status-id",
  "agentPattern": "implementer*"
}
```

Notes:

- `agentPattern` is case-insensitive and supports `*`.
- `fromStatusId: null` means "from any status".
- Rules only matter when status changes include `agentId`.

## CLI-only conveniences

These are implemented by the repo CLI, not the server itself:

- `start`, `finish`, `plan`, and `bootstrap`
- inferred worktree branch names
- single-question `input request` flags
- `input wait`
- `input list` / `input get`
- `raw --query key=value`
- `cards move` preflight validation against allowed statuses

For those behaviors, see `AGENT_CLI.md`.
