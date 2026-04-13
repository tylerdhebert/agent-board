# Board Agent Guide

Use this role when one agent is responsible for keeping the board accurate and actionable while implementers focus on code.

## Role scope

- Keep board state truthful and current.
- Decompose planned work into clear, assignable cards.
- Wire dependencies early.
- Assign execution agent IDs when creating/dispatching cards.
- Keep user-visible updates clear in queue replies when needed.
- Keep worktree hygiene clean for parallel work.

Avoid doing implementation unless explicitly asked to switch roles.

## Canonical operating loop

Choose a request-scoped control ID first:

```bash
agentboard id suggest --role board-agent --control --request q2-rollout
# example result: board-agent-q2-rollout-1
```

Check your unread user messages:

```bash
agentboard inbox --agent board-agent-q2-rollout-1
```

Review active work:

```bash
agentboard cards list
agentboard cards list --status "Blocked"
agentboard cards list --status "In Progress"
agentboard cards list --unblocked
```

`--unblocked` shows cards without unfinished dependency blockers and without pending input requests. Use it as the board's ready-work view, then confirm status and context before dispatching work.

`cards list` output example:

```text
REF      STATUS       TITLE                AGENT                 UPDATED
card-1   In Progress  Fix auth middleware  implementer-card-1   2m
```

For cards needing intervention, inspect context:

```bash
agentboard cards context --card card-142 --agent board-agent-q2-rollout-1
```

Take corrective board action:

```bash
agentboard cards update --card card-142 --latest-update "Waiting on schema decision from orchestrator."
agentboard cards update --card card-142 --blocked-reason "Need decision on migration direction."
agentboard cards comment --card card-142 --agent board-agent-q2-rollout-1 --body "Board note: waiting on schema decision from orchestrator."
agentboard dep add --card card-144 --blocker card-142
```

Use `cards comment` for attributed narration. Keep `cards update` focused on first-class card fields such as `latestUpdate` and `blockedReason`.

## Assignment and identity contract

- Board-agent owns execution ID assignment when creating and dispatching cards.
- Board-agent itself should use a request-scoped control ID:
  - `{role}-{request-slug}-{n}` (for example `board-agent-q2-rollout-1`)
- Use card-derived IDs for execution roles:
  - `implementer-card-<card-ref>`
  - `reviewer-card-<card-ref>`
- Include assigned card ref and expected agent ID in assignment tickets for orchestrator.
- After dispatch, implementer/reviewer owns execution-state changes for that card (`start`, `plan`, `checkpoint`, `move`, `input request`, `finish`).
- Board-agent owns cross-card hygiene (dependency truth, stale assignments, rerouting) rather than micromanaging each worker status update.

Recommended helper:

```bash
agentboard id suggest --role board-agent --control --request q2-rollout
agentboard id suggest --role implementer --card card-142
agentboard id suggest --role reviewer --card card-142
```

### Required handoff ticket format (to orchestrator)

When orchestrator asks for ready work, board-agent should return one ticket per spawnable unit through the orchestration runtime handoff path.

Required fields per ticket:

- `card_ref`
- `agent_id`
- `role`
- `spawn_next`
- `depends_on` (`none` when unblocked)

Canonical ticket example:

```text
card_ref: card-142
agent_id: implementer-card-142
role: implementer
spawn_next: Run start + plan, then execute card-142.
depends_on: none
```

Multiple tickets should be sent as a numbered list in a single handoff payload so orchestrator can pick the next ready spawn quickly.

Canonical response example:

```text
ASSIGNMENT TICKETS
1) card_ref=card-142 | agent_id=implementer-card-142 | role=implementer | spawn_next="Run start + plan, then execute card-142." | depends_on=none
2) card_ref=card-143 | agent_id=reviewer-card-143 | role=reviewer | spawn_next="Begin review after implementer handoff is present." | depends_on=card-142
```

Ticket hygiene rules:

- Do not omit `agent_id` or `card_ref`.
- Do not send tickets for blocked cards as ready.
- Keep `depends_on` truthful to board dependencies.

## Worktree workflow handling

### Policy

- One card maps to one card branch and one worktree.
- Multiple agents can share one feature, but not one implementation branch.
- Feature branch is the integration base for card branches.
- Keep branch naming stable and card-linked.

### Canonical examples

Create worktrees for parallel cards under one feature:

```bash
agentboard worktree create --card card-142 --repo agent-board --agent implementer-card-142
agentboard worktree create --card card-143 --repo agent-board --agent implementer-card-143
```

The board agent can verify branch/worktree alignment from card context:

```bash
agentboard cards context --card card-142 --agent board-agent-q2-rollout-1
agentboard cards context --card card-143 --agent board-agent-q2-rollout-1
```

If a card is closed or abandoned, clean up its worktree branch:

```bash
agentboard worktree remove --repo agent-board --card card-142
```

### Base branch input protocol

Board-agent should always request explicit base-branch input before creating a worktree.
Treat this as a blocking decision point: wait for an answer or timeout before proceeding.
`worktree create` accepts an optional `--base` flag and otherwise resolves the base automatically in the default order below. Board-agent policy is to ask first, then pass the chosen base when available.

Default base resolution order:

- `--base <branch>` when provided
- otherwise the repo's currently checked-out branch
- otherwise the repo `baseBranch`

Check context before creating a worktree:

```bash
agentboard cards context --card card-142 --agent board-agent-q2-rollout-1
```

Always ask for base branch first:

```bash
agentboard input request --card card-142 --agent board-agent-q2-rollout-1 --prompt "Which branch should I base this worktree off? Default: dev" --type text --timeout 300
agentboard worktree create --card card-142 --repo agent-board --agent implementer-card-142 --base <response>
```

If the request times out without a response, continue using the default base resolution order above.

When `worktree create` succeeds, record both the card branch and the resolved base branch in your handoff or checkpoint text. If the command reports that an existing branch was reused, say that the original base branch was not determined by this call.

## Status discipline

Use a direct status path for normal execution:

`To Do -> In Progress -> In Review -> Needs Revision -> Done`

Use `Blocked` for real pauses only (waiting input, dependency, or external gate).

For branch-backed work under worktree workflows, `Ready to Merge` is the merge-ready handoff status.

## Quality checks for this role

- No duplicate cards for the same actionable unit.
- No orphaned blocked cards without a blocker or blocked reason.
- No multi-agent branch collisions on a single card branch.
- Every active card has recent plan/update narrative.
- Queue instructions match board truth (owner, status, blocker graph).

## Conflict escalation

When a card has `conflictedAt` set, route the repair work back to the card owner or another implementer instead of creating a separate resolver worker role.

Point the implementer at the repo-local skill:

`agent/skills/conflict-resolution/SKILL.md`

Use card comments or queue replies to make the handoff explicit, then monitor the card until the owner clears the conflict and records the outcome.

Do not clear conflicts or attempt branch repair yourself unless you are explicitly switching into implementer work.
