# Agent Board API Reference

Base URL: `http://localhost:31377/api`

Preferred interface: `agentboard help`

Use the CLI by default. This file is the canonical raw HTTP contract and endpoint reference.

The raw API exposes resource routes. Workflow helpers such as `start`, `finish`, and the CLI alias forms live in the repo CLI.

## Identity and status enforcement

- `agentId` is an arbitrary caller-chosen string such as `implementer-card-142`.
- Queue threads are keyed by exact `agentId`.
- Seeded statuses are core and permanent. They may be recolored/reordered, but they are not renameable or deletable.
- Additional statuses may be added for local UI/workflow needs.
- Use the common path `To Do -> In Progress -> In Review -> Needs Revision -> Done` unless the situation clearly calls for something else.

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
- Seeded statuses return `isCore: true`.
- Core statuses may be recolored/reordered, but the server rejects renaming or deleting them.

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
  "buildCommand": "bun run build"
}
```

Notes:

- `baseBranch` defaults to the currently checked-out branch at `path` when available, otherwise `main`.
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
```

Notes:

- `GET /cards/:id` returns the card plus embedded `comments`.
- `unblocked=true` excludes cards with any active blocker whose blocker card is not in `Done`.

### Create, claim, update, delete

```http
POST   /cards
POST   /cards/:id/claim
POST   /cards/:id/move
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
  "description": "Implement the queue subcommands"
}

POST /cards/:id/claim
{
  "agentId": "implementer-1",
  "autoAdvance": true
}

POST /cards/:id/move
{
  "statusId": "status-id",
  "agentId": "implementer-1"
}

PATCH /cards/:id
{
  "title": "Sharper title",
  "description": "Updated description",
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
- Once `featureId` is set on a card, the server rejects changing it to a different feature.
- Once `epicId` is set on a card, the server rejects changing it to a different epic.
- If a legacy/repair flow fills a null `featureId`, the server derives `epicId` from that feature automatically.
- If `featureId` is present, `epicId` must match that feature's epic.
- Card creation produces an unclaimed card.
- Claiming sets `agentId`.
- Claiming auto-advances `To Do -> In Progress` unless `autoAdvance` is `false`. (CLI: `--no-auto-advance` maps to `"autoAdvance": false`.)
- `POST /cards/:id/move` changes workflow status without changing ownership.
- Moving a card to `Done` stamps `completedAt`.
- Moving a card away from `Done` clears `completedAt`.
- `PATCH /cards/:id` updates metadata fields only.
- When an agent changes workflow status through the raw API, use `POST /cards/:id/move` and include `agentId` as the acting agent. Ownership remains on the card until `/claim` changes it.

### Comments

```http
POST /cards/:id/comments
```

Body:

```json
{ "body": "Checkpoint: build passed.", "author": "agent", "agentId": "implementer-1" }
```

Allowed authors:

- `agent`
- `user`

Rules:

- Agent-authored comments must include `agentId`.
- User-authored comments should use `author: "user"` and do not need `agentId`.

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

- `GET /cards/:id/diff` compares `<current-checked-out-branch-or-repo.baseBranch>...card.branchName`.
- `POST /cards/:id/recheck-conflicts` reruns `git merge-tree` and updates `conflictedAt` and `conflictDetails`.
- `POST /cards/:id/merge` is a destructive orchestration route. It:
  - refuses when `conflictedAt` is set
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
- When a blocker reaches `Done`, the server emits an unblock event if the dependent card has no active blockers.

## Input requests

```http
GET  /input
GET  /input?status=<pending|answered|timed_out>&cardId=<cardId>&agentId=<agentId>
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
  "agentId": "implementer-card-142",
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
  "agentId": "implementer-card-142",
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

Question type guidance:

- Use `yesno` only for true binary decisions.
- Use `choice` when the valid answers come from a finite list you can enumerate.
- Prefer `choice` over `text` whenever the allowed options are already known.
- Use `text` only when the human must provide a genuinely open-ended answer.
- Group multiple blocking questions into one request when they belong to the same pause point.

Notes:

- `POST /input` long-polls until the request is answered or times out.
- `POST /input` with `"detach": true` creates the request and returns immediately with the saved request record.
- `GET /input/:id` is the recovery/read path for a specific request.
- `GET /input` lists requests and supports filtering by `status`, `cardId`, and `agentId`.
- `agentId` is optional on input requests and records which agent opened the blocking request.
- If a status named exactly `Blocked` exists, the server moves the card there while the request is pending.
- The server records `previousStatusId`.
- On answer or timeout, the previous status is restored only if the card is in `Blocked`.
- Timeout response is HTTP `408` with:

```json
{ "requestId": "request-id", "status": "timed_out", "answers": null }
```

- Agents using the CLI should issue `input request` and then wait for an answer or a timeout. They must not continue work past the blocking decision.
- Agents using the raw API or low-level SDK helpers must follow the same rule: creating the request is not enough. They must immediately wait on that same request id until it is answered or timed out before continuing or ending the turn.
- Detached creation is an implementation detail for resilient waiting and recovery, not permission to fire-and-forget a blocking question.

## Queue and communication

```http
GET    /queue?agentId=<agentId>&status=<pending|read>&author=<author>
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
- Agent inbox polling should use `GET /queue?agentId=<id>&status=pending&author=user`.
- An empty result means the user has not sent that exact agent any unread messages.
- Queue is for user-facing communication, not agent-to-agent coordination.

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
  2. currently checked-out branch at `repo.path`
  3. `repo.baseBranch`
- if the requested card branch already exists, the server adds the worktree without `-b`
- the card's `branchName` and `repoId` are updated on success
- the response includes:
  - `branchName`: the worktree/card branch
  - `baseBranch`: the actual base branch used when this request created the branch
  - `reusedExistingBranch`: `true` when the branch already existed and the original base was not determined here

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

## CLI-only conveniences

These are implemented by the repo CLI, not the server itself:

- `start`, `finish`, `plan`, and `bootstrap`
- inferred worktree branch names
- single-question `input request` flags
- `input wait`
- `input list` / `input get`
- `raw --query key=value`

For those behaviors, run `agentboard help` or `agentboard <command> help`.
