# Agent Board — Mandatory Protocol

Task board: `http://localhost:31377/api`. **Use it for every task, without exception.**

## Before doing any work

1. `GET /cards` — find your assigned card
2. `POST /cards/:id/claim` — claim it
3. `GET /queue?agentId=<your-id>&status=pending` — check for messages

If no card exists, create one first. Every card needs a feature, every feature needs an epic — create from the top down if needed:
```
GET /statuses                          # resolve status names to IDs
POST /epics     { "title": "...", "statusId": "<id>" }
POST /features  { "epicId": "<id>", "title": "...", "statusId": "<id>" }
POST /cards     { "title": "...", "featureId": "<id>", "statusId": "<To Do id>", "type": "task", "agentId": "<your-id>" }
```

## While working

- Post a comment describing your plan **before** executing it
- Post a comment at each meaningful decision point or milestone
- If blocked or needing a decision: `POST /input` — do not guess, do not proceed silently
- Update card status as you progress
- Declare blockers: `POST /cards/:id/dependencies`

## When finished

- Move card to Done: `PATCH /cards/:id` with the Done `statusId`
- Post a final summary comment
- If you created a worktree branch: move to "Ready to Merge" instead — do not merge yourself; if `conflictedAt` is set, rebase to resolve, then `PATCH /cards/:id { "conflictedAt": null }` and move back to re-check

## Non-negotiable rules

- **Never begin work without claiming a card**
- **Never finish without updating the card status**
- **Never guess at a human decision — use `POST /input`**
- **Check messages at the start and end of every turn:** `GET /queue?agentId=<your-id>&status=pending` — always include both params; omitting `agentId` returns all agents' messages

Full API reference: `AGENT_API.md`
