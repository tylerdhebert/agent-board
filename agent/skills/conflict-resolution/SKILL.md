---
name: conflict-resolution
description: Resolve merge conflicts on agent-board card branches without changing card ownership or card status. Use when a branch-backed card has `conflictedAt` set, a rebase onto the feature/base branch produces conflicts, or an implementer needs a repeatable workflow for reconciling both sides of a conflicted change and handing the card back in a truthful state.
---

# Conflict Resolution

Use this skill while acting as the current card owner or as a helper working under that owner's direction. Treat conflict resolution as branch repair work, not as a separate board role.

Do not use this skill to claim a card, reassign ownership, or decide final status transitions. The current owner remains responsible for the board lifecycle before and after conflict resolution.

## Workflow

1. Read the card context before touching git.

```bash
agentboard cards context --card <card-ref> --agent <current-owner-id>
```

Look for:

- `Card branch:` - the branch to repair
- `Conflicted: yes` - confirms the board still thinks the branch is conflicted
- `Repo base branch:` - fallback target if the feature has no branch
- `Feature base branch:` - preferred rebase target when set

2. Work from the card's branch and existing worktree.

If a worktree already exists for the card branch, use it. If not, create one as the current card owner:

```bash
agentboard worktree create --card <card-ref> --repo <repo-name> --agent <current-owner-id>
```

3. Rebase onto the correct target branch.

Use the feature branch when present; otherwise use the repo base branch.

```bash
git fetch origin
git rebase <target-branch>
```

4. Resolve each conflict deliberately.

- Inspect both sides before editing:

```bash
git diff
git log --merge --oneline
```

- Preserve behavior from both sides whenever possible.
- Do not use blanket `--ours` or `--theirs` resolutions unless the file truly warrants it.
- After each resolved file:

```bash
git add <file>
git rebase --continue
```

5. Run the narrowest truthful verification for the touched area.

- For this repo, follow the current instructions in `AGENTS.md`.
- If the resolution touched UI-only code, prefer `bun run build`.
- If the resolution touched broader logic, run the verification the owning agent would normally run for that card.

6. Clear conflict state and hand the card back truthfully.

Clear both conflict fields:

```bash
agentboard cards update --card <card-ref> --clear-conflict
```

If the card should be checked again against its merge target, rerun the conflict check:

```bash
agentboard cards recheck-conflicts --card <card-ref>
```

Then record what happened as the current owner:

```bash
agentboard cards comment --card <card-ref> --agent <current-owner-id> --body "Resolved conflicts in <files>. Rebased onto <target>. Verification: <what was run>."
```

If a handoff summary is appropriate, set it without changing ownership:

```bash
agentboard cards update --card <card-ref> --handoff-summary "Conflict resolved. Rebased onto <target>. Verification: <result>."
```

## Guardrails

- Do not run `agentboard start`, `cards claim`, or `finish` just to use this skill.
- Do not change card ownership as part of conflict resolution.
- Do not move status unless you are already the card owner and the next status is truly your responsibility.
- Do not merge the branch as part of this skill.
- If you are helping another agent out of band, return the resolution details to that agent instead of claiming their card.
