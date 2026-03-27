# Agent Board API Reference

Base URL: `http://localhost:31377/api`

**If the agent board is running locally, use it for all tasks.** It is the primary coordination surface between you and the user — for tracking work, signaling progress, asking questions, and receiving messages. Do not skip it in favor of inline comments or silent execution.

This board is the shared workspace between you and the user. Use it to track your work, signal progress, and — critically — ask the user for input when you need it.

---

## Orchestrator Responsibilities

If you are an **orchestrator** (spawning and directing other agents), you have additional responsibilities:

- **Assign stable agent IDs** to each sub-agent before spawning them (e.g. `implementer-1`, `reviewer-1`, `planner-1`). These IDs are used for card ownership, chat routing, and queue filtering — they must be unique and consistent for the lifetime of the task.
- **Create cards for sub-agents** before or immediately after spawning them. Each agent should have a card to work from.
- **Assign cards to agents** by setting `agentId` on the card so ownership is visible in the UI.
- **Use epics and features** to group related work. Create an epic for the overall goal, features for major workstreams, and cards for individual agent tasks.
- **Do not claim cards yourself** unless you are doing the work. Orchestrators typically create and assign, not execute.
- **Monitor via comments** — sub-agents post progress comments; you can read them via `GET /cards/:id` to decide next steps.
- **Route messages correctly** — if the user sends a message to a specific agent ID, forward it or ensure that agent checks its queue. Use `GET /queue/conversations` to see which agents have unread messages.

---

## Workflow Basics

1. **Claim a card** when you pick up a task — this sets you as the owner and moves it to In Progress.
2. **Post comments** on the card as you work. This is how the user follows along.
3. **Ask for input** using the long-poll endpoint whenever you need a decision, approval, or information. The request surfaces in the UI with an audio alert. **Do not proceed past a blocking question — wait for the answer.**
4. **Check your messages** at the start of each turn — the user may have left you a message via the chat system.
5. **Update the status** when you finish or hit a wall.

---

## Cards

### List all cards
```
GET /cards
GET /cards?status=<statusId>
```
Returns all cards, optionally filtered by status ID. Use `GET /statuses` first to resolve status names to IDs.

### Get a single card (with comments)
```
GET /cards/:id
```
Returns the card plus its full comment thread.

### Claim a card
```
POST /cards/:id/claim
{
  "agentId": "implementer-1",
  "autoAdvance": true
}
```
Sets you as the owner. If `autoAdvance` is true (default) and the card is in "To Do", it automatically moves to "In Progress". **Do this before starting work.**

### What statuses can I move this card to?
```
GET /cards/:id/allowed-statuses?agentId=implementer-1
```
Returns the list of status objects you are permitted to move this card to from its current status, based on the configured transition rules. If no rules are configured, returns all statuses. **Check this before patching status** to avoid a rejected move.

### Update a card
```
PATCH /cards/:id
{
  "statusId": "<id>",
  "agentId": "implementer-1",
  "title": "...",
  "description": "...",
  "type": "task|story|bug"
}
```
All fields are optional. When changing status, include your `agentId` so transition rules are enforced. If a move is not permitted, the server returns an error.

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
`featureId` is **required** — every card must belong to a feature. `epicId` is derived automatically from the feature. Use `GET /epics` then `GET /features` to resolve IDs.

### Delete a card
```
DELETE /cards/:id
```

### Post a comment
```
POST /cards/:id/comments
{
  "body": "Finished the database migration. Moving to review.",
  "author": "agent"
}
```
Use comments to narrate your progress. The user reads these.

---

## Requesting User Input ⚠️

**This is the most important endpoint. Use it any time you need a decision, approval, clarification, or information you cannot determine yourself. Do not guess — ask.**

```
POST /input
{
  "cardId": "<your card id>",
  "questions": [
    {
      "id": "q1",
      "type": "yesno",
      "prompt": "Should I overwrite the existing config file?"
    },
    {
      "id": "q2",
      "type": "choice",
      "prompt": "Which environment should this deploy to?",
      "options": ["staging", "production"]
    },
    {
      "id": "q3",
      "type": "text",
      "prompt": "What should the new API endpoint be named?",
      "default": "/api/v2/users"
    }
  ],
  "timeoutSecs": 900
}
```

**This call blocks.** The HTTP request stays open until the user answers in the UI (or the timeout expires). Your card is automatically moved to "Blocked" while waiting. When the user responds, the call returns:

```json
{
  "requestId": "...",
  "status": "answered",
  "answers": {
    "q1": "yes",
    "q2": "production",
    "q3": "/api/v2/users"
  }
}
```

On timeout (HTTP 408):
```json
{ "requestId": "...", "status": "timed_out", "answers": null }
```

**Question types:**
- `text` — free-form string. Supply `default` if there's a sensible fallback.
- `yesno` — answer will be `"yes"` or `"no"`.
- `choice` — single-select from `options`. Answer will be one of the option strings.

**When to use it:** Whenever you are blocked on a human decision, need approval before a destructive action, are uncertain about scope or intent, or need credentials/values you don't have. The user gets an audio alert and a prompt in the UI — they expect to be asked.

---

## Agent Chat (Message Queue)

The board has a bidirectional chat system. The user can send you messages between turns and expects you to read them before doing any work. You can also send replies that appear in the user's chat window.

### Check your messages (do this at the start of each turn)
```
GET /queue?agentId=<your-agent-id>&status=pending
```
Returns pending messages addressed to your exact agent id, ordered oldest first. Your agent id must match exactly — use the id the orchestrator assigned you.

### Reply to a message / send a message
```
POST /queue
{
  "agentId": "implementer-1",
  "body": "Done — the migration is complete. No data loss.",
  "author": "implementer-1"
}
```
Set `author` to your own agent id so the user's chat window shows it as a reply from you. The `agentId` field identifies which conversation thread this belongs to.

### Mark a message as read
```
POST /queue/:id/read
```
Call this after you have processed a message.

### List all conversations
```
GET /queue/conversations
```
Returns a summary per agent: `{ agentId, total, unread, lastAt }`.

### QueueMessage shape
```json
{
  "id": "uuid",
  "agentId": "implementer",
  "body": "Please prioritize the login bug fix next.",
  "status": "pending",
  "author": "user",
  "createdAt": "2026-03-24T10:00:00.000Z",
  "readAt": null
}
```

**`author` field:** `"user"` means the human sent it. Any other value is the agent id of the sender.

**Per-turn workflow:**
1. At the start of each turn, call `GET /queue?agentId=<your-id>&status=pending`.
2. Read the messages and adjust your plan accordingly.
3. Reply with `POST /queue` (set `author` to your agent id) if a response is warranted.
4. Call `POST /queue/:id/read` for each message you act on.
5. Note any changes to your plan in a comment on the relevant card.
6. Additionally, at the end of each turn, call `GET /queue?agentId=<your-id>&status=pending`.
7. If there are additional new messages for you, do not end your turn if the user has requested additional work.

---

## Statuses

### List all statuses (ordered by position)
```
GET /statuses
```
Returns `[{ id, name, color, position }]`. Resolve status names to IDs before using them in card operations.

---

## Epics

### List all epics
```
GET /epics
```

### Create an epic
```
POST /epics
{
  "title": "Authentication Overhaul",
  "description": "...",
  "statusId": "<id>",
  "workflowId": "<id>"
}
```
`workflowId` is optional. Use `GET /workflows` to list available workflows (`"workflow-default"` for standard boards, `"workflow-worktree"` for git-integrated boards).

### Update an epic
```
PATCH /epics/:id
{ "title": "...", "description": "...", "statusId": "<id>" }
```

---

## Features

Features belong to an epic and can optionally be linked to a repo and branch. The commit panel on the board shows commits for each feature's branch.

### List all features
```
GET /features
```

### Create a feature
```
POST /features
{
  "epicId": "<id>",
  "title": "JWT Token Issuance",
  "description": "...",
  "statusId": "<id>",
  "repoId": "<repo id>",
  "branchName": "feat/jwt-issuance"
}
```
`repoId` and `branchName` are optional. When set, the feature's commit history is shown in the board's right panel (commits ahead of `repo.baseBranch`).

### Update a feature
```
PATCH /features/:id
{ "title": "...", "description": "...", "statusId": "<id>", "repoId": "<id>", "branchName": "feat/..." }
```

### Get commit history for a feature's branch
```
GET /features/:id/commits
```
Returns up to 50 commits on `feature.branchName` that are not on `repo.baseBranch`. Requires `repoId` and `branchName` to be set on the feature.

### Get a specific commit diff
```
GET /features/:id/commits/:hash
```
Returns `{ hash, author, subject, date, diff }`.

---

## Repos

Repos represent git repositories that agents can create worktrees in. Managed via the admin panel.

### List all repos
```
GET /repos
```
Returns `[{ id, name, path, baseBranch, compareBase }]`. `baseBranch` is the trunk branch (e.g. `main`) used as the comparison base for feature commit ranges. `compareBase` is a legacy field; feature branches now use `baseBranch` as their base automatically.

---

## Worktrees

Worktrees allow agents to work on isolated git branches. The orchestrator sets everything up; the sub-agent just works in the provided directory.

### Orchestrator setup sequence

When kicking off a worktree-based task, the orchestrator should:

**1. Resolve the repo**
```
GET /repos
```
Find the repo matching the codebase the agent will work in. Note its `id` and `baseBranch` (the trunk, e.g. `main`).

**2. Create the feature (if it doesn't exist) with repo + branch info**
```
POST /features
{
  "epicId": "<epic id>",
  "title": "My Feature",
  "repoId": "<repo id>",
  "branchName": "feat/my-feature"
}
```
This links the feature to the branch so commit history appears in the UI. Use a descriptive branch name scoped to the feature (e.g. `feat/auth-jwt`, `fix/login-bug`).

**3. Create a card for the agent**
```
POST /cards
{
  "featureId": "<feature id>",
  "title": "Implement JWT issuance",
  "type": "task",
  "statusId": "<To Do id>",
  "agentId": "implementer-1"
}
```

**4. Create the worktree**
```
POST /worktrees
{
  "cardId": "<card id>",
  "repoId": "<repo id>",
  "branchName": "feat/my-feature",
  "baseBranch": "main"
}
```
This runs `git worktree add -b feat/my-feature` in the repo directory and stamps `branchName` + `repoId` on the card. The response includes the `worktreePath` — the absolute directory the agent should work in.

**5. Spawn the sub-agent with the worktree path**
Pass `worktreePath` from the response as the working directory for the sub-agent. Tell the agent:
- The card ID to claim
- The worktree path to work in
- The branch name (for commit messages, PR context, etc.)
- The repo's `baseBranch` so they know what they're branching from

### Sub-agent responsibilities

Once inside a worktree, the agent should:
1. Claim the card: `POST /cards/:id/claim`
2. Do the work in the provided `worktreePath` — all changes are isolated to this branch
3. Post comments on the card as work progresses
4. When done, move the card to "Ready to Merge" (or equivalent) — **do not merge the branch yourself**. Merging is a human action performed in the UI.

### Teardown (orchestrator)

After the user merges or abandons the branch:
```
DELETE /worktrees/:branchName?repoId=<id>
```
Runs `git worktree remove --force` and `git branch -D`. Clears `branchName` from the card.

### View a card's diff
```
GET /cards/:id/diff
```
Returns `{ diff, stat, branchName }` — the full diff of the branch against its base. Useful for orchestrators reviewing work before signalling it's ready.

---

## Workflows

### List all workflows
```
GET /workflows
```
Returns `[{ id, name, type }]`. Two are seeded: `"workflow-default"` (standard) and `"workflow-worktree"` (includes Ready to Merge with `triggersMerge: true`).

### List statuses for a workflow
```
GET /workflows/:id/statuses
```
Returns `[{ id, workflowId, statusId, position, triggersMerge, name, color }]` — the ordered columns for that workflow.

### Add a status to a workflow
```
POST /workflows/:id/statuses
{ "statusId": "<status id>", "triggersMerge": false }
```
Appends the status at the end of the workflow. `triggersMerge` is optional (default false).

### Remove a status from a workflow
```
DELETE /workflows/:id/statuses/:wsId
```
`:wsId` is the `id` field from the workflow status row (not the status id).

### Reorder a workflow status
```
PATCH /workflows/:id/statuses/:wsId/position
{ "position": 2 }
```

### Toggle merge trigger
```
PATCH /workflows/:id/statuses/:wsId/merge
{ "triggersMerge": true }
```
Marks a status as the merge point in the UI. The actual merge is performed by the user — agents should move the card to this status to signal readiness, not attempt to merge directly.

---

## Transition Rules

Rules control which agents can move cards to which statuses. If no rules exist, all moves are allowed.

### List all rules
```
GET /transition-rules
```
Returns `[{ id, agentPattern, fromStatusId, toStatusId }]`. `null` means "any".

---

## Tips

- Always claim a card before working on it.
- Post a comment when you start, when you hit a decision point, and when you finish.
- Use `GET /cards/:id/allowed-statuses?agentId=<you>` before changing status — it tells you exactly what moves are available to you.
- When in doubt about anything, use `POST /input`. The user prefers being asked over having you guess.
- `timeoutSecs` defaults to 900 (15 min). For non-urgent questions you can increase it; for quick confirmations leave it at default.
- Check `GET /queue?agentId=<you>&status=pending` at the start of each turn before doing any other work.
