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

## Output format

All commands print structured text by default, optimized for readability and low token cost.

- Lists print aligned tables (for example `cards list`, `status list`).
- Single records print `key: value` lines with empty/null fields omitted.
- Mutations print short confirmation lines.
- `cards context` prints a labeled context block, including `Conflicted:` and `Recent comments:` when present.
- `cards diff` prints `base:`, `branch:`, and `stat:` headers, then raw unified diff text.

Use `--json` when you need machine-parseable output:

```bash
agentboard --json cards list
agentboard --json cards context --card card-142 --agent implementer-1
```

Global options like `--json` and `--url` can appear before or after the command.

## Hot Path Quick Reference

Most agent turns only need these:

```bash
# 1) Check queue
agentboard inbox --agent <agent-id>

# 2) Start/resume card
agentboard start --agent <agent-id> --card <card-ref> --plan "Investigate, implement, verify."

# 3) Inspect context before edits
agentboard cards context --card <card-ref> --agent <agent-id>

# 4) Post progress
agentboard checkpoint --card <card-ref> --agent <agent-id> --body "Progress update."

# 5) Ask blocking question (waits)
agentboard input request --card <card-ref> --prompt "Need decision?" --type yesno

# 6) Finish truthfully
agentboard finish --agent <agent-id> --card <card-ref> --summary "What changed and how it was verified."
```

## Core conventions

- The CLI is explicit-first. There is no saved session, sticky context, or implicit agent/card fallback.
- Use agent-friendly refs in normal workflows:
  - cards: `card-142`
  - features: `feat-12`
- Raw GUIDs are accepted, but refs are preferred.
- Default output is human-readable for common commands.
- Add `--json` when you want machine-friendly output or exact payloads.

## Canonical turn flow

Check inbox:

```bash
agentboard inbox --agent implementer-1
```

Start or resume a card:

```bash
agentboard start --agent implementer-1 --card card-142 --plan "Inspect the current flow, patch the CLI, then verify with bun run build."
```

Inspect the card context:

```bash
agentboard cards context --card card-142 --agent implementer-1
```

Create or resume the worktree when code changes are needed:

```bash
agentboard worktree create --card card-142 --repo agent-board --agent implementer-1
```

Post a checkpoint:

```bash
agentboard checkpoint --card card-142 --agent implementer-1 --body "Context loaded, patch in progress, verification next."
```

Request blocking input:

```bash
agentboard input request --card card-142 --prompt "Should I use the simpler status flow here?" --type yesno
```

Finish the turn truthfully:

```bash
agentboard finish --agent implementer-1 --card card-142 --summary "Implemented the refactor and verified with bun run build."
```

Notes:

- For normal card flow, the common path is `To Do -> In Progress -> In Review -> Needs Revision -> Done`.
- Use `Blocked` for true pauses like waiting on human input.
- Branch-backed work under the worktree workflow can finish into `Ready to Merge`.

## Cards

List and inspect:

```bash
agentboard cards list
agentboard cards list --status "Blocked"
agentboard cards list --mine --agent implementer-1
agentboard cards list --feature feat-12
agentboard cards get --card card-142
agentboard cards context --card card-142 --agent implementer-1
agentboard cards completed-today
```

Create, claim, and move:

```bash
agentboard cards create --feature feat-12 --title "Refactor card context output"
agentboard cards create --feature feat-12 --title "Refactor card context output" --claim --agent implementer-1
agentboard cards claim --card card-142 --agent implementer-1
agentboard cards move --card card-142 --agent implementer-1 --status "In Progress"
agentboard cards move --card card-142 --agent implementer-1 --to "In Review"
```

Update first-class workflow state:

```bash
agentboard plan --card card-142 --agent implementer-1 "Inspect routes, patch CLI output, then verify."
agentboard cards update --card card-142 --latest-update "CLI context command is returning the new summary."
agentboard cards update --card card-142 --blocked-reason "Waiting for confirmation on status semantics."
agentboard cards update --card card-142 --handoff-summary "Ready for review; build passed."
agentboard cards update --card card-142 --clear-conflict
```

Comments, diff, and merge helpers:

```bash
agentboard cards comment --card card-142 --agent implementer-1 --body "Checkpoint: context output now includes blocked reason."
agentboard cards diff --card card-142
agentboard cards recheck-conflicts --card card-142
agentboard cards merge --card card-142 --strategy squash --target main
```

Notes:

- `cards context` is the fastest way to understand a card before touching code.
- `plan`, `latestUpdate`, `blockedReason`, and `handoffSummary` are first-class card fields now. Use them.
- `cards comment` is for agent-authored progress notes and requires `--agent`.

## Dependencies

Use dependencies for card-to-card blockers, not comments:

```bash
agentboard dep board
agentboard dep list card-142
agentboard dep add --card card-143 --blocker card-142
agentboard dep remove --card card-143 --blocker card-142
```

`agentboard cards deps ...` is an alias, but `dep ...` is shorter.

## Blocking input

Single-question request:

```bash
agentboard input request --card card-142 --prompt "Should I move this to Done now?" --type yesno
agentboard input request --card card-142 --prompt "Which branch should I target?" --type choice --option main --option release
agentboard input request --card card-142 --prompt "What should the new doc be called?" --type text
```

Recovery flow:

```bash
agentboard input list --status pending --card card-142
agentboard input get <request-id>
agentboard input wait <request-id>
```

Important behavior:

- `input request` is blocking on purpose.
- If a `Blocked` status exists, the server moves the card there while waiting.
- The server restores the previous status when the request is answered or times out, as long as the card remains in `Blocked`.
- Do not issue a blocking request and then keep working past that decision.

## Queue and direct communication

Check queue messages:

```bash
agentboard inbox --agent implementer-1
agentboard queue inbox --agent implementer-1 --all
agentboard queue conversations
```

Send and reply:

```bash
agentboard queue send --agent implementer-2 --body "Pick up card-143 after card-142 lands." --author orchestrator
agentboard queue reply --agent implementer-1 "I am blocked on the workflow decision and opened an input request."
```

Notes:

- Use queue messages for direct agent-to-agent or human-to-agent communication.
- Use card comments for progress narration tied to a specific card.

## Features

```bash
agentboard feature list
agentboard feature list --agent implementer-1
agentboard feature create --epic "Agent UX" --title "CLI workflow polish" --repo agent-board --branch feat/agent-cli
agentboard feature update feat-12 --description "Agent-first CLI workflow"
agentboard feature commits feat-12
agentboard feature commit feat-12 <hash>
agentboard feature build feat-12
agentboard feature build-status feat-12
```

## Worktrees

Create a worktree for a card:

```bash
agentboard worktree create --card card-142 --repo agent-board --agent implementer-1
agentboard worktree create --card card-142 --repo agent-board --agent implementer-1 --branch wt/implementer-1/card-142-context
agentboard worktree create --card card-142 --repo agent-board --agent implementer-1 --base main
```

Remove it when the card branch is done:

```bash
agentboard worktree remove --branch wt/implementer-1/card-142-context --repo agent-board
agentboard worktree remove --repo agent-board --card card-142
```

Branch selection order for `worktree create`:

1. Explicit `--branch`
2. Existing `card.branchName`
3. Generated per-card branch like `wt/<agent>/<card-ref>-<slug>`

Base branch selection order:

1. Explicit `--base`
2. Current checked-out branch at the repo path
3. Repo `baseBranch`

Board-agent policy override:

- If acting as `board-agent`, request user input for base branch first (`input request --card card-142 --type text --timeout 300 --prompt "Which base branch should I use?"`).
- Only after timeout may board-agent fall back to the default base-branch order above.

Parallel worktree guidance:

- One card should map to one worktree branch.
- Multiple agents can work on the same feature, but they should not share the same implementation branch.
- Treat the feature branch as the integration base, not as the default worktree branch.
- If two agents are working in parallel, each should claim a different card and create a different card worktree branch.

## Bootstrap

Create missing hierarchy in one shot:

```bash
agentboard bootstrap \
  --epic "Agent Operations" \
  --feature "CLI workflow polish" \
  --title "Refactor card context output" \
  --agent implementer-1 \
  --plan "Create the richer command surface, then update docs."
```

`bootstrap` creates missing epic and feature records, then creates the card.
Claim behavior:
- `--claim` claims the card (requires `--agent`)
- `--no-claim` leaves the card unclaimed
- with neither flag, it claims only when `--agent` is provided

## Raw and JSON escape hatches

```bash
agentboard --json cards context --card card-142 --agent implementer-1
agentboard raw GET /cards
agentboard raw PATCH /cards/<card-guid> --body-file patch.json
```

Use `raw` only when the CLI does not already expose the workflow you need.
On Windows/PowerShell, prefer `--body-file` over `--body-json` for POST/PATCH payloads to avoid quoting issues.
