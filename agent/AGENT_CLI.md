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

The CLI is the preferred interface for agents. Use raw HTTP only when the CLI truly does not expose the capability you need.

Why the extra `--` in the fallback form:

- `bun run agentboard` runs the package script
- the `--` tells Bun to stop parsing its own flags and pass the rest through to the script
- so `bun run agentboard -- cards list` means "run the `agentboard` script with arguments `cards list`"

## Command conventions

- Session context is stored per working directory in `~/.agentboard/context.json`.
- After you run `start`, later commands can usually omit `--agent` and `--card`.
- Long flags accept either kebab-case or camelCase.
  - `--question-id` and `--questionId` both work.
  - `--no-auto-advance` and `--noAutoAdvance` both work.
- Environment variables:
  - `AGENT_BOARD_URL`
  - `AGENT_BOARD_AGENT_ID`
  - `AGENT_BOARD_CARD_ID`

Global flags:

- `--url <url>`: override the board URL. Default: `http://localhost:31377/api`
- `--agent <agent-id>`: default agent id for this invocation
- `--card <card-id>`: default card id for this invocation
- `--no-context`: ignore saved per-directory session context

## Recommended agent workflow

Claim or resume a card:

```bash
agentboard start --agent implementer-1 --card <card-id>
```

Check direct messages:

```bash
agentboard inbox
```

Post the plan:

```bash
agentboard plan "Investigate the issue, implement the change, then verify with bun run build."
```

Update status truthfully:

```bash
agentboard cards move --status "In Review"
```

Request human input when blocked on a decision:

```bash
agentboard input request --prompt "Should I overwrite the existing config?" --type yesno
```

Finish the turn:

```bash
agentboard finish --summary "Implemented the change and verified with bun run build."
```

`finish` prefers:

- `Done` for ordinary cards
- `Ready to Merge` for branch-backed cards when that status exists

## Top-level commands

Health and raw escape hatch:

```bash
agentboard health
agentboard raw GET /cards
agentboard raw PATCH /cards/<card-id> --body-json '{"agentId":"implementer-1","statusId":"..."}'
```

Session management:

```bash
agentboard session show
agentboard session set --agent implementer-1 --card <card-id>
agentboard session clear
agentboard session clear --card
```

Workflow helpers:

```bash
agentboard start --agent implementer-1 --card <card-id> --plan "First pass plan..."
agentboard checkpoint --body "Build is green; moving into review cleanup."
agentboard finish --summary "Ready for handoff."
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
- stores the card in session context when claimed

## Cards

List and inspect:

```bash
agentboard cards list
agentboard cards list --status "Blocked"
agentboard cards list --mine
agentboard cards list --feature "Agent CLI and documentation"
agentboard cards get <card-id>
agentboard cards completed-today
agentboard cards allowed <card-id> --agent implementer-1
```

Create, claim, and move:

```bash
agentboard cards create --feature "Agent CLI and documentation" --title "Implement queue helpers"
agentboard cards create --feature "Agent CLI and documentation" --title "Implement queue helpers" --claim --use --agent implementer-1
agentboard cards claim <card-id> --agent implementer-1
agentboard cards move --status "In Progress" --agent implementer-1
agentboard cards move --to "In Review"
```

Notes:

- `cards create --claim` claims the new card immediately.
- `cards create --use` stores the new card in session context.
- `cards move` accepts either `--status` or `--to`.
- Status moves with an `agentId` are checked against transition rules before the patch is sent.

Patch fields and comments:

```bash
agentboard cards update --title "Sharper title"
agentboard cards update --description "Expanded description"
agentboard cards update --clear-conflict
agentboard cards comment --body "Checkpoint: merged the parser changes."
agentboard cards comment --body "Human note" --author user
```

Branch-backed card operations:

```bash
agentboard cards diff
agentboard cards recheck-conflicts
agentboard cards merge --strategy squash --target main
```

Delete:

```bash
agentboard cards delete <card-id>
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
agentboard input request --prompt "Should I overwrite the existing config?" --type yesno
agentboard input request --prompt "Which environment?" --type choice --option staging --option production
agentboard input request --prompt "What should the endpoint be called?" --type text --default "/api/v2/users"
```

Structured request from JSON:

```bash
agentboard input request --file questions.json
agentboard input request --question-json '{"id":"q1","type":"yesno","prompt":"Proceed?"}'
```

Answer requests:

```bash
agentboard input pending
agentboard input answer <request-id> --answer q1=yes
agentboard input answer <request-id> --answers-json '{"q1":"staging","q2":"prod"}'
agentboard input answer <request-id> --file answers.json
```

Notes:

- `input request` long-polls until the question is answered or it times out.
- If a `Blocked` status exists, the server moves the card there while the request is pending.
- On answer or timeout, the previous status is restored if the card is still in `Blocked`.

## Queue and communication

Thread list and inbox:

```bash
agentboard queue conversations
agentboard queue list --agent implementer-1
agentboard queue list --agent implementer-1 --all
agentboard inbox
```

Send and reply:

```bash
agentboard queue send --agent implementer-1 --body "Please prioritize the auth fix." --author user
agentboard queue reply "I have picked this up and will update the card."
```

Read and cleanup:

```bash
agentboard queue read <message-id>
agentboard queue read-all --agent implementer-1
agentboard queue clear --agent implementer-1
agentboard queue delete <message-id>
```

Notes:

- `queue reply` uses the current session agent as both conversation key and author.
- Use queue messages for direct conversation.
- Use card comments for progress narration tied to a card.

## Statuses

```bash
agentboard status list
agentboard status create --name "QA" --color "#6366f1"
agentboard status update "QA" --position 7
agentboard status delete "QA"
```

## Repos

```bash
agentboard repo list
agentboard repo create --name agent-board --path C:\path\to\repo --base main --compare-base origin/main --build "bun run build"
agentboard repo update agent-board --compare-base main
agentboard repo delete agent-board
```

## Epics

```bash
agentboard epic list
agentboard epic create --title "Agent UX" --description "Improve the operator workflow" --workflow Worktree
agentboard epic update "Agent UX" --title "Agent CLI + Protocol"
agentboard epic commits "Agent UX" --repo agent-board
agentboard epic commit "Agent UX" <hash> --repo agent-board
agentboard epic delete "Agent UX"
```

## Features

```bash
agentboard feature list
agentboard feature create --epic "Agent UX" --title "CLI" --repo agent-board --branch feat/agent-cli
agentboard feature update CLI --description "CLI-first agent operations"
agentboard feature commits CLI
agentboard feature commit CLI <hash>
agentboard feature build CLI
agentboard feature build-status CLI
agentboard feature delete CLI
```

## Workflows and transition rules

```bash
agentboard workflow list
agentboard workflow statuses Worktree
agentboard workflow add-status Worktree --status "Ready to Merge" --triggers-merge
agentboard workflow remove-status Worktree <workflow-status-id>
agentboard workflow set-position Worktree <workflow-status-id> 3
agentboard workflow set-merge Worktree <workflow-status-id> true

agentboard rule list
agentboard rule create --to "In Review" --from "In Progress" --agent-pattern "implementer*"
agentboard rule delete <rule-id>
```

## Worktrees

Create a worktree:

```bash
agentboard worktree create --repo agent-board
agentboard worktree create --repo agent-board --branch wt/implementer-1/cli
agentboard worktree create --repo agent-board --card <card-id> --base main
```

Delete a worktree:

```bash
agentboard worktree remove wt/implementer-1/cli --repo agent-board
agentboard worktree remove --branch wt/implementer-1/cli --repo agent-board
agentboard worktree remove --repo agent-board --card <card-id>
```

Branch inference order for `worktrees create`:

1. Explicit `--branch`
2. Existing `card.branchName`
3. `feature.branchName`
4. Generated branch: `wt/<agent>/<card-short-id>-<slug>`

When examples omit `<card-id>` for `cards move`, `cards comment`, `input request`, `worktree create`, or similar commands, they assume you already ran `agentboard start` and have active session context.

## Operational guidance

- Use `start` whenever you switch tasks.
- Use `plan` before non-trivial work.
- Use `cards move` instead of raw status patches.
- Use `input request` for true blocking decisions.
- Use `queue` for direct conversation and `cards comment` for status narration.
- Use `finish` for normal handoff.
- Reserve `cards merge` for orchestrator or explicit human merge duties.

