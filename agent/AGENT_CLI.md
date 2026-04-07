# Agent Board CLI

Preferred invocation after one-time setup:

```bash
bun link
agentboard <command> [options]
```

Fallback without a global link:

```bash
bun run agentboard -- <command> [options]
```

The CLI is explicit-first. There is no saved session, per-repo context, or implicit agent/card fallback. Pass `--agent` and `--card` on the command that needs them.

## Command conventions

- Long flags accept either kebab-case or camelCase.
  - `--question-id` and `--questionId` both work.
  - `--no-auto-advance` and `--noAutoAdvance` both work.
- Agent and card targeting are command-local, not global.
  - Good: `agentboard cards comment <card-id> --agent implementer-1 --body "..."`
  - Bad: `agentboard --agent implementer-1 cards comment ...`

Global flags:

- `--url <url>`: override the board URL. Default: `http://localhost:31377/api`

## Recommended agent workflow

Claim or resume a card:

```bash
agentboard start --agent implementer-1 --card <card-id>
```

Check direct messages:

```bash
agentboard inbox --agent implementer-1
```

Post the plan:

```bash
agentboard plan --card <card-id> "Investigate the issue, implement the change, then verify with bun run build."
```

Update status truthfully:

```bash
agentboard cards move --card <card-id> --agent implementer-1 --status "In Review"
```

Request human input when blocked on a decision:

```bash
agentboard input request --card <card-id> --prompt "Should I overwrite the existing config?" --type yesno
```

Finish the turn:

```bash
agentboard finish --agent implementer-1 --card <card-id> --summary "Implemented the change and verified with bun run build."
```

`finish` prefers:

- `Done` for ordinary cards
- `Ready to Merge` for branch-backed cards when that status exists

## Top-level commands

Health and raw escape hatch:

```bash
agentboard health
agentboard raw GET /cards
agentboard raw GET /queue --query agentId=implementer-1 --query status=pending
agentboard raw POST /queue --body-file request.json
agentboard raw PATCH /cards/<card-id> --body-json '{"agentId":"implementer-1","statusId":"..."}'
```

Workflow helpers:

```bash
agentboard start --agent implementer-1 --card <card-id> --plan "First pass plan..."
agentboard checkpoint --card <card-id> --body "Build is green; moving into review cleanup."
agentboard finish --agent implementer-1 --card <card-id> --summary "Ready for handoff."
```

Create missing hierarchy in one shot:

```bash
agentboard bootstrap \
  --epic "Agent Operations CLI + Protocol" \
  --feature "Agent CLI and documentation" \
  --title "Implement queue helpers" \
  --agent implementer-1 \
  --plan "Create the command surface, then document it."
```

`bootstrap`:

- creates the epic if missing
- creates the feature if missing
- creates the card
- claims it by default unless `--no-claim`

## Cards

List and inspect:

```bash
agentboard cards list
agentboard cards list --status "Blocked"
agentboard cards list --mine --agent implementer-1
agentboard cards list --feature "Agent CLI and documentation"
agentboard cards get <card-id>
agentboard cards completed-today
agentboard cards allowed <card-id> --agent implementer-1
```

Create, claim, and move:

```bash
agentboard cards create --feature "Agent CLI and documentation" --title "Implement queue helpers"
agentboard cards create --feature "Agent CLI and documentation" --title "Implement queue helpers" --claim --agent implementer-1
agentboard cards claim <card-id> --agent implementer-1
agentboard cards move --card <card-id> --agent implementer-1 --status "In Progress"
agentboard cards move <card-id> --agent implementer-1 --to "In Review"
```

Notes:

- `cards create` leaves the new card unassigned unless you pass `--agent` or `--claim`.
- `cards create --claim` claims the new card immediately.
- `cards move` accepts either `--status` or `--to`.
- Status moves with an `agentId` are checked against transition rules before the patch is sent.

Patch fields and comments:

```bash
agentboard cards update <card-id> --title "Sharper title"
agentboard cards update <card-id> --description "Expanded description"
agentboard cards update <card-id> --clear-conflict
agentboard cards comment <card-id> --agent implementer-1 --body "Checkpoint: merged the parser changes."
agentboard cards comment <card-id> --body "Human note" --author user
```

Branch-backed card operations:

```bash
agentboard cards diff <card-id>
agentboard cards recheck-conflicts <card-id>
agentboard cards merge <card-id> --strategy squash --target main
```

## Dependencies

The dedicated command is `dep`, and `cards deps` is an alias.

```bash
agentboard dep board
agentboard dep list <card-id>
agentboard dep add --card <blocked-card-id> --blocker <blocker-card-id>
agentboard dep remove --card <blocked-card-id> --blocker <blocker-card-id>

agentboard cards deps list <card-id>
```

## Input requests

Single-question request:

```bash
agentboard input request --card <card-id> --prompt "Should I overwrite the existing config?" --type yesno
agentboard input request --card <card-id> --prompt "Which environment?" --type choice --option staging --option production
agentboard input request --card <card-id> --prompt "What should the endpoint be called?" --type text --default "/api/v2/users"
```

Recovery flow:

```bash
agentboard input list --status pending --card <card-id>
agentboard input get <request-id>
agentboard input wait <request-id>
```

Structured request from JSON:

```bash
agentboard input request --card <card-id> --file questions.json
agentboard input request --card <card-id> --question-json '{"id":"q1","type":"yesno","prompt":"Proceed?"}'
```

Notes:

- `input request` creates the input request first, then waits on that request id so the same turn can continue when the answer arrives.
- `input request` emits a heartbeat every 5 seconds by default while waiting.
- Set `--heartbeat 0` if you need a quiet wait in a shell job or wrapper.
- `input wait` is the recovery primitive when a runtime interrupts the original waiting turn.
- After issuing `input request`, the agent must wait for an answer or for the request to time out. It must not continue work past the blocking decision.
- If a `Blocked` status exists, the server moves the card there while the request is pending.
- On answer or timeout, the previous status is restored if the card is still in `Blocked`.

## Queue and communication

Thread list and inbox:

```bash
agentboard queue conversations
agentboard queue list --agent implementer-1
agentboard queue list --agent implementer-1 --all
agentboard inbox --agent implementer-1
```

Send and reply:

```bash
agentboard queue send --agent implementer-1 --body "Please prioritize the auth fix." --author user
agentboard queue reply --agent implementer-1 "I have picked this up and will update the card."
```

Read and cleanup:

```bash
agentboard queue read <message-id>
agentboard queue read-all --agent implementer-1
agentboard queue clear --agent implementer-1
agentboard queue delete <message-id>
```

Notes:

- `queue reply` uses the current agent as both conversation key and author.
- Use queue messages for direct conversation.
- Use card comments for progress narration tied to a card.

## Features

```bash
agentboard feature list
agentboard feature list --agent implementer-1
agentboard feature create --epic "Agent UX" --title "CLI" --repo agent-board --branch feat/agent-cli
agentboard feature update CLI --description "CLI-first agent operations"
agentboard feature commits CLI
agentboard feature commit CLI <hash>
agentboard feature build CLI
agentboard feature build-status CLI
agentboard feature delete CLI
```

## Worktrees

```bash
agentboard worktree create --card <card-id> --repo agent-board
agentboard worktree create --card <card-id> --repo agent-board --branch wt/implementer-1/cli
agentboard worktree create --card <card-id> --repo agent-board --base main

agentboard worktree remove wt/implementer-1/cli --repo agent-board
agentboard worktree remove --branch wt/implementer-1/cli --repo agent-board
agentboard worktree remove --repo agent-board --card <card-id>
```

Branch inference order for `worktree create`:

1. Explicit `--branch`
2. Existing `card.branchName`
3. `feature.branchName`
4. Generated branch: `wt/<agent>/<card-short-id>-<slug>`

## Operational guidance

- Use `start` whenever you switch tasks.
- Use `plan` before non-trivial work.
- Use `cards move` instead of raw status patches.
- Use `input request` for true blocking decisions.
- Use `queue` for direct conversation and `cards comment` for status narration.
- Use `finish` for normal handoff.
- Reserve `cards merge` for orchestrator or explicit human merge duties.
