# Board Agent Guide

Use this role when one agent is responsible for keeping the board accurate and actionable while implementers focus on code.

## Role scope

- Keep board state truthful and current.
- Decompose planned work into clear, assignable cards.
- Wire dependencies early.
- Coordinate queue messages between agents.
- Keep worktree hygiene clean for parallel work.

Avoid doing implementation unless explicitly asked to switch roles.

## Canonical operating loop

Check message backlog:

```bash
agentboard queue conversations
agentboard inbox --agent board-agent
```

`queue conversations` output example:

```text
AGENT          UNREAD  LAST
implementer-1  3       Fix the auth flow please
```

Review active work:

```bash
agentboard cards list
agentboard cards list --status "Blocked"
agentboard cards list --status "In Progress"
```

`cards list` output example:

```text
REF      STATUS       TITLE                AGENT          UPDATED
card-1   In Progress  Fix auth middleware  implementer-1  2m
```

For cards needing intervention, inspect context:

```bash
agentboard cards context --card card-142 --agent board-agent
```

Take corrective board action:

```bash
agentboard cards update card-142 --latest-update "Waiting on schema decision from orchestrator."
agentboard cards update card-142 --blocked-reason "Need decision on migration direction."
agentboard dep add --card card-144 --blocker card-142
agentboard queue send --agent implementer-2 --body "Start card-145 while card-144 waits on card-142." --author board-agent
```

## Worktree workflow handling

### Policy

- One card maps to one card branch and one worktree.
- Multiple agents can share one feature, but not one implementation branch.
- Feature branch is the integration base for card branches.
- Keep branch naming stable and card-linked.

### Canonical examples

Create worktrees for parallel cards under one feature:

```bash
agentboard worktree create --card card-142 --repo agent-board --agent implementer-1
agentboard worktree create --card card-143 --repo agent-board --agent implementer-2
```

The board agent can verify branch/worktree alignment from card context:

```bash
agentboard cards context --card card-142 --agent board-agent
agentboard cards context --card card-143 --agent board-agent
```

If a card is closed or abandoned, clean up its worktree branch:

```bash
agentboard worktree remove --repo agent-board --card card-142
```

### Base branch input protocol

Base branch selection should be explicit when branch choice is risky or ambiguous.
When the target base is clear, rely on normal `worktree create` defaults.

Default base resolution order:

- `--base <branch>` when provided
- otherwise the repo's currently checked-out branch
- otherwise the repo `baseBranch`

Check context before creating a worktree:

```bash
agentboard cards context --card card-142 --agent board-agent
```

Ask for human input only when branch choice is not obvious or has elevated risk:

```bash
agentboard input request --card card-142 \
  --prompt "Which branch should I base this worktree off? Default: dev" \
  --type text --timeout 300
agentboard worktree create --card card-142 --repo agent-board --agent implementer-1 --base <response>
```

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

When a card has `conflictedAt` set (visible in card context output), dispatch the conflict resolver:

```bash
agentboard queue send \
  --agent conflict-resolver \
  --body "card-142 has recorded merge conflicts. Please resolve and post a handoff summary when done." \
  --author board-agent
```

After dispatching, monitor the card with `cards context`. When the output no longer includes `Conflicted:` and shows `Handoff:` set, the resolver is done. Advance the card to the appropriate next status:

```bash
agentboard cards move --card card-142 --agent board-agent --to "In Review"
```

Do not clear conflicts or attempt resolution yourself — that is the conflict resolver's job.

