# Agent Board Mandatory Protocol

Task board URL: `http://localhost:31377/api`

Preferred interface:

```bash
agentboard ...
```

Use the CLI by default. Run `agentboard help` for the full command reference. Raw HTTP semantics are defined in `AGENT_API.md`.

## Core obligations

- Never begin meaningful work without a card.
- Never leave a card in a misleading status.
- Never change status through the raw API except via the dedicated move route. Use `POST /cards/:id/move` and include `agentId` when an agent is performing the move.
- Never ask a human for a blocking decision in free text when `input request` should be used.
- Never go silent on an active card for long stretches.
- Never merge your own worktree branch unless you are explicitly acting as the orchestrator or human operator.

## Role ownership model

Default multi-agent chain:

`planner -> orchestrator -> board-agent -> implementer/reviewer`

Role responsibilities:

- `planner`: decomposes work into tasks and sequencing intent.
- `orchestrator`: dispatches work and coordinates cross-agent handoffs.
- `board-agent`: creates cards, wires dependencies, assigns execution IDs, and prepares assignment tickets for orchestrator/runtime dispatch.
- `implementer` and `reviewer`: execute assigned cards and manage their own card lifecycle truthfully (`start`, `plan`, `checkpoint`, `move`, `input request`, `finish`).

Board-agent should not micromanage every status transition on active execution cards. Implementers/reviewers own truthful status updates on cards assigned to them.

## Agent ID policy

When board-agent is active, ID assignment is controlled by board-agent.

Control roles (`planner`, `orchestrator`, `board-agent`) should use request-scoped IDs:

- Format: `{role}-{request-slug}-{n}`
- Examples:
  - `orchestrator-q2-rollout-1`
  - `planner-q2-rollout-1`
  - `board-agent-q2-rollout-1`

Worker execution roles should remain task/card-based:

- card-backed work: `{role}-{card-ref}` (for example `implementer-card-142`, `reviewer-card-142`)
- direct worker IDs when no board-agent is active: `{role}-{task-slug}-{n}` (for example `implementer-auth-flow-1`)

When no board-agent is active (direct user-to-agent execution), the executing agent may choose its own ID:

- Format: `{role}-{task-slug}-{n}`
- Example: `implementer-auth-flow-1`
- `n` is the next available index when matching IDs already exist.

Stability rule:

- Once an agent ID is chosen for a card/turn thread, keep it stable for the full execution.
- Always use `agentboard id suggest` to choose the next available ID and avoid collisions.

Helper command:

```bash
agentboard id suggest --role orchestrator --control --request q2-rollout
agentboard id suggest --role planner --control --request q2-rollout
agentboard id suggest --role board-agent --control --request q2-rollout
agentboard id suggest --role implementer --card card-142
agentboard id suggest --role reviewer --card card-142
agentboard id suggest --role implementer --task "auth flow"
```

## Required turn flow

### Before work

1. Check your queue:

```bash
agentboard inbox --agent <agent-id>
```

2. Resume an existing card:

```bash
agentboard start --agent <agent-id> --card <card-ref>
```

3. Inspect the card before you code:

```bash
agentboard cards context --card <card-ref> --agent <agent-id>
```

4. If the work does not exist on the board yet:

- Prefer `bootstrap` when you need to create epic, feature, and card together.

```bash
agentboard bootstrap --epic "..." --feature "..." --title "..."
```

- Use `cards create` only when the epic and feature already exist.

```bash
agentboard feature list          # find the feature ref (e.g. feat-12)
agentboard cards create --feature <feature-ref> --title "..."
agentboard start --agent <agent-id> --card <card-ref>
```

### During work

- Post a plan before non-trivial execution:

```bash
agentboard plan --card <card-ref> --agent <agent-id> "Investigate, implement, verify, then hand off."
```

- Post checkpoints at meaningful milestones:

```bash
agentboard checkpoint --card <card-ref> --agent <agent-id> --body "Parser is fixed; running verification now."
```

- Move the active card through statuses truthfully:

```bash
agentboard cards move --card <card-ref> --agent <agent-id> --status "In Review"
```

- Declare card-to-card blockers explicitly:

```bash
agentboard dep add --card <blocked-card-ref> --blocker <blocker-card-ref>
```

- Survey the full blocker graph when you need a board-wide ready-work view:

```bash
agentboard dep board
```

- Request human decisions through the input system for the active card:

```bash
agentboard input request --card <card-ref> --agent <agent-id> --prompt "Should I overwrite the config?" --type yesno
```

- Use the narrowest question type that matches the blocker:
  - `yesno` only for true binary decisions
  - `choice` when the valid answers come from a known finite list
  - `text` only when the answer is genuinely open-ended

- Use queue only for user-facing communication:

```bash
agentboard queue reply --agent <agent-id> "I am blocked and waiting on your decision."
```

- Do not use queue for agent-to-agent coordination.

- If branch or worktree state matters, create or resume it through the board:

```bash
agentboard worktree create --card <card-ref> --repo agent-board --agent <agent-id>
```

### End of turn

- Check the queue again:

```bash
agentboard inbox --agent <agent-id>
```

- Finish the card truthfully:

```bash
agentboard finish --agent <agent-id> --card <card-ref> --summary "What changed and how it was verified."
```

`finish` should leave the card in a truthful handoff state:

- `Done` for ordinary completed work
- `Ready to Merge` for branch-backed work when available

If you resolved conflicts manually, clear stale conflict state before handoff:

```bash
agentboard cards update --card <card-ref> --clear-conflict
agentboard cards recheck-conflicts --card <card-ref>
```

## Communication rules

- Poll your inbox at the start and end of every turn.
- Inbox means unread user-authored queue messages for your exact `agentId`.
- An empty inbox means the user has not sent that exact agent any unread messages.
- Use queue threads for user-visible updates and replies only.
- Use card comments or checkpoints for progress narration tied to a task.
- Use `input request` when the blocker is a decision, approval, or missing human input.
- After issuing `input request`, you must wait for an answer or for the request to time out.
- Creating a blocking input request and then ending the turn without waiting is a protocol violation.
- If a waiting turn is interrupted, recover with: `agentboard input list --status pending --card <card>` to find the request, then `agentboard input wait <request-id>` to resume waiting.
- Do not bury blockers in free-text commentary while leaving the card in `In Progress`.

## Worktree and branch rules

- Branch-backed work should be attached to a card.
- Use `worktree create` and `worktree remove` instead of managing detached worktrees out of band.
- One card should map to one worktree branch.
- The feature branch is the integration base, not the shared worktree branch for multiple agents.
- If the server marks a card as conflicted, resolve the branch, then clear and re-check conflict state before moving forward.
- This repo provides `[.claude/skills/conflict-resolution/SKILL.md](/.claude/skills/conflict-resolution/SKILL.md)` for branch conflict repair. Treat that work as implementer-owned unless a human explicitly chooses a different coordination model.

## Explicit CLI discipline

- The CLI is stateless and explicit.
- `--agent` and `--card` are per-command flags. Place them after the subcommand (for example: `agentboard cards move --card card-142 --agent implementer-1 --to "In Review"`).
- `--url` and `--json` are global flags and may appear before or after the command name.
- Treat each command as a fresh call: pass the card and agent refs you want that command to operate on.

## Reading CLI output

CLI output is structured text by default (not raw JSON).

- Lists print table headers and rows, for example: `REF  STATUS  TITLE  AGENT  UPDATED`
- Single records print `key: value` lines with empty fields omitted. For `cards context`, omitted fields (description, plan, latest update, blockers, etc.) mean the value is empty or false — not that it failed to load.
- Most mutations confirm with a short action line. Exception: `cards update` returns the full post-update card context so you can verify the result without a follow-up `cards context` call.
- `cards context` always shows `Blocked:` and `Waiting on input:` (even when false). Optional fields only appear when set.
- `cards get` returns a concise summary (ref, title, status, agent, feature, epic, timestamps). Use `cards context` for the full operational picture before touching code.

Use `--json` when you need to extract specific fields programmatically:

```bash
agentboard --json cards context --card card-142 --agent implementer-1
```

## Non-negotiable failures

These are protocol violations:

- coding without a claimed or active card
- completing work without updating the board
- asking for a human decision outside `input request` when the decision blocks progress
- moving status through the raw API outside `POST /cards/:id/move`
- leaving blocked work undocumented
- leaving a branch-backed card in a misleading non-handoff state

If the CLI is unavailable, follow the same behavior through the raw API in `AGENT_API.md`.
