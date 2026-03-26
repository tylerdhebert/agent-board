# Agent Board API Reference

Base URL: `http://localhost:31377/api`

This board is the shared workspace between you and the user. Use it to track your work, signal progress, and — critically — ask the user for input when you need it.

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
  "type": "task|story|bug",
  "epicId": "<id or null>",
  "featureId": "<id or null>"
}
```
All fields are optional. When changing status, include your `agentId` so transition rules are enforced. If a move is not permitted, the server returns an error.

### Create a card
```
POST /cards
{
  "title": "Fix login bug",
  "statusId": "<To Do status ID>",
  "type": "bug",
  "description": "...",
  "agentId": "implementer-1",
  "epicId": "<id>",
  "featureId": "<id>"
}
```

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

**Recommended per-turn workflow:**
1. At the start of each turn, call `GET /queue?agentId=<your-id>&status=pending`.
2. Read the messages and adjust your plan accordingly.
3. Reply with `POST /queue` (set `author` to your agent id) if a response is warranted.
4. Call `POST /queue/:id/read` for each message you act on.
5. Note any changes to your plan in a comment on the relevant card.

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
  "statusId": "<id>"
}
```

### Update an epic
```
PATCH /epics/:id
{ "title": "...", "description": "...", "statusId": "<id>" }
```

---

## Features

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
  "statusId": "<id>"
}
```

### Update a feature
```
PATCH /features/:id
{ "title": "...", "description": "...", "statusId": "<id>" }
```

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
