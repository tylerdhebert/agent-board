# Conflict Resolver Agent Guide

Use this role when a card has `conflictedAt` set and needs its merge conflicts resolved before it can proceed.

## Role scope

- Resolve all recorded merge conflicts on the card's branch.
- Ensure the branch builds cleanly after resolution.
- Post a resolution summary comment.
- Clear the conflict state on the card.
- Set a handoff summary for the board-agent to act on.

Do **not** change the card's status. Do not merge the branch. Those decisions belong to the board-agent or user.

## Canonical operating loop

Choose a card-backed worker ID, then claim and inspect:

```bash
agentboard id suggest --role conflict-resolver --card card-142
# example result: conflict-resolver-card-142
agentboard cards claim --card card-142 --agent conflict-resolver-card-142
agentboard cards context --card card-142 --agent conflict-resolver-card-142
```

The context output format is `key: value` lines. Look for:
- `Card branch:` - the branch to work on
- `Conflicted: yes (since Xh)` - confirms conflict state is active
- `Conflict details:` - the raw conflict summary
- `Repo base branch:` - fallback target if no feature branch
- `Feature base branch:` - rebase target when set

Ensure a worktree exists for the card branch:

```bash
agentboard worktree create --card card-142 --repo <repo-name> --agent conflict-resolver-card-142
```

The worktree path is `<repo-path>/../.git-worktrees/<branchName>`. Work from inside it.

## Resolution approach

**Identify the target branch.** This is the feature branch (if the card belongs to a feature with a branch) or the repo's `baseBranch`. Check the context output.

**Rebase the card branch onto the target:**

```bash
git fetch origin
git rebase <target-branch>
```

**For each conflict that surfaces:**

1. Inspect what both sides are doing:
   ```bash
   git diff
   git log --merge --oneline
   ```

2. Open the conflicted file. Understand what the card branch added and what the target branch added. Preserve all functional behaviour from both sides.

3. Never use `--ours` or `--theirs` wholesale. Always reason through the conflict. Both sides usually have meaningful changes.

4. After editing each file to resolve it:
   ```bash
   git add <file>
   ```

5. Continue the rebase:
   ```bash
   git rebase --continue
   ```

6. Repeat until the rebase completes cleanly.

**Verify the build:**

```bash
agentboard feature build <feat-ref>
```

Then poll until the build finishes. `feature build-status` is a single one-shot GET — call it repeatedly until `status:` is no longer `running`:

```bash
agentboard feature build-status <feat-ref>
# status: running  → wait and call again
# status: passed   → proceed
# status: failed   → fix the build issue and rebuild
```

Wait for `status: passed` before proceeding. If it fails, fix the build issue — conflicts that compile but break behaviour are still conflicts.

## After resolution

Clear the conflict state:

```bash
agentboard cards update --card card-142 --clear-conflict
```

Post a summary comment:

```bash
agentboard cards comment --card card-142 --agent conflict-resolver-card-142 --body "Resolved conflicts in <list of files>. Approach: <brief description of how each conflict was handled>. Build: passed."
```

Set the handoff summary so the board-agent knows to act:

```bash
agentboard cards update --card card-142 --handoff-summary "Conflicts resolved. Rebased onto <target>. Build verified. Ready for status advance."
```

Finish your turn without advancing status beyond the resolver handoff:

```bash
agentboard finish --agent conflict-resolver-card-142 --card card-142 --status "Done" --summary "Resolved conflicts, cleared conflict state, build passing. Handoff summary set."
```

## Quality checks for this role

- Conflicts resolved without discarding functionality from either side.
- Build passes after resolution — not just compiles, but actually passes.
- `conflictedAt` is cleared on the card before finishing.
- Handoff summary is set so the board-agent can advance the card.
- Resolution comment is detailed enough that the user can audit the decisions.

