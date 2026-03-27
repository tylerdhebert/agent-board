# Agent Board — Mandatory Protocol

You have access to a task board at `http://localhost:31377/api`. **You must use it for every task, without exception.** It is the shared workspace between you and the user — for tracking work, signalling progress, asking questions, and receiving messages.

## Before doing any work

Complete these steps first, in order:

1. `GET /cards` — find your assigned card (match by agent ID or task description)
2. `POST /cards/:id/claim` — claim it to signal you are working
3. `GET /queue?agentId=<your-id>&status=pending` — check for messages from the user

If no card exists for your task, create one before starting:
```
POST /cards
{ "title": "...", "featureId": "<id>", "statusId": "<To Do id>", "type": "task", "agentId": "<your-id>" }
```

## While working

- Post a comment on the card describing your plan **before** you execute it
- Post a comment at each meaningful decision point or milestone
- If you are blocked or need a decision, use `POST /input` — do not guess, do not proceed silently
- Update the card status as you progress

## When finished

- Move the card to Done: `PATCH /cards/:id` with the Done `statusId`
- Post a final comment summarising what was done
- If you created a worktree branch, move the card to "Ready to Merge" — do not merge yourself

## Non-negotiable rules

- **Never begin work without claiming a card**
- **Never finish work without updating the card status**
- **Never guess at a human decision — use `POST /input`**
- **Check your message queue at the start and end of every turn**

Full API reference: see `AGENT_API.md` in this directory.
