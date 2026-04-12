# Agent Board Mandatory Protocol

Task board URL: `http://localhost:31377/api`

Preferred interface:

```bash
agentboard ...
```

Use the CLI by default. The CLI workflow is defined in `AGENT_CLI.md`. Raw HTTP semantics are defined in `AGENT_API.md`.

## Core obligations

- Never begin meaningful work without a card.
- Never leave a card in a misleading status.
- Never change status through the raw API without including `agentId`.
- Never ask a human for a blocking decision in free text when `input request` should be used.
- Never go silent on an active card for long stretches.
- Never merge your own worktree branch unless you are explicitly acting as the orchestrator or human operator.

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
agentboard bootstrap --epic "..." --feature "..." --title "..." --agent <agent-id>
```

- Use `cards create` only when the epic and feature already exist.

```bash
agentboard cards create --feature <feature-ref> --title "..." --claim --agent <agent-id>
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

- Request human decisions through the input system for the active card:

```bash
agentboard input request --card <card-ref> --prompt "Should I overwrite the config?" --type yesno
```

- Use the narrowest question type that matches the blocker:
  - `yesno` only for true binary decisions
  - `choice` when the valid answers come from a known finite list
  - `text` only when the answer is genuinely open-ended

- Use queue messages for direct conversation:

```bash
agentboard queue reply --agent <agent-id> "I am blocked on the schema decision."
```

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
- Use queue threads for direct conversation.
- Use card comments or checkpoints for progress narration tied to a task.
- Use `input request` when the blocker is a decision, approval, or missing human input.
- After issuing `input request`, you must wait for an answer or for the request to time out.
- Creating a blocking input request and then ending the turn without waiting is a protocol violation.
- Do not bury blockers in free-text commentary while leaving the card in `In Progress`.

## Worktree and branch rules

- Branch-backed work should be attached to a card.
- Use `worktree create` and `worktree remove` instead of managing detached worktrees out of band.
- One card should map to one worktree branch.
- The feature branch is the integration base, not the shared worktree branch for multiple agents.
- If the server marks a card as conflicted, resolve the branch, then clear and re-check conflict state before moving forward.

## Explicit CLI discipline

- There is no saved CLI session or per-repo context.
- There is no implicit agent/card environment fallback.
- Pass `--agent` and `--card` explicitly on the command that needs them.
- If a waiting turn is interrupted, recover with `agentboard input wait <request-id>` or inspect pending requests with `agentboard input list`.

## Reading CLI output

CLI output is structured text by default (not raw JSON).

- Lists print table headers and rows, for example: `REF  STATUS  TITLE  AGENT  UPDATED`
- Single records print `key: value` lines with empty fields omitted
- Mutations confirm with a short action line
- `cards context` includes `Conflicted: yes (since Xh)` and `Recent comments:` when applicable

Use `--json` when you need to extract specific fields programmatically:

```bash
agentboard --json cards context --card card-142 --agent implementer-1
```

## Non-negotiable failures

These are protocol violations:

- coding without a claimed or active card
- completing work without updating the board
- asking for a human decision outside `input request` when the decision blocks progress
- moving status through the raw API without `agentId`
- leaving blocked work undocumented
- leaving a branch-backed card in a misleading non-handoff state

If the CLI is unavailable, follow the same behavior through the raw API in `AGENT_API.md`.
