# Conflict Resolution Design

Design notes for auto-detecting and resolving merge conflicts in the agent-board workflow.

## Status Flow

```
Ready to Merge → [conflict check] → Conflicted → [CONFLICT_RESOLVER agent] → Ready to Merge
                                                                            ↘ Needs Review (unresolvable)
```

The CONFLICT_RESOLVER restores the branch to a clean, mergeable state — it does **not** merge into main. Merging remains a human action.

## Conflict Detection

**Trigger:** When a feature's status changes to a workflow status where `triggersMerge = true`, automatically run a conflict check.

**Mechanism:** Server endpoint `POST /features/:id/check-conflicts`
- Creates a temp worktree
- Runs `git rebase origin/<baseBranch>` (dry-run / abort immediately)
- Returns `{ hasConflicts: boolean, files: string[] }`
- Cleans up the temp worktree

If conflicts are found:
1. Move the feature's status to "Conflicted"
2. Auto-create a card: `"Resolve conflicts: <feature title>"`, type `task`, agentId `conflict-resolver`
3. Post the conflicted file list as the card's first comment

## CONFLICT_RESOLVER Agent Behavior

1. `git fetch origin`
2. `git rebase origin/<baseBranch>` on the feature branch
3. For each conflicted file: read the conflict markers, resolve using code context
4. `git add <file>` + `git rebase --continue` per file
5. Push the rebased branch (`git push --force-with-lease`)
6. Mark its card Done, move the feature status back to "Ready to Merge"

**If conflicts are unresolvable** (logic conflicts, ambiguous intent):
- Do NOT guess
- Move card to "Blocked", post a detailed comment explaining each unresolvable section
- Feature stays at "Conflicted" for human review

**Re-conflict guard:** If `main` moves again mid-rebase, retry up to 2 times before escalating to "Blocked".

## Required Infrastructure

- **"Conflicted" status** — seed alongside To Do / In Progress / Done / Blocked
- **Server endpoint** — `POST /features/:id/check-conflicts`
- **Auto-card creation** — triggered from the status-change handler in `PATCH /features/:id`
- **AGENT_MANDATE.md update** — document the Conflicted status and CONFLICT_RESOLVER role

## What Stays the Same

- Merge into main remains a human step
- The "Ready to Merge" → merge path is unchanged
- Transition rules still apply (conflict resolver moves through normal statuses)
