# Orchestrator Guide

Use this role when you are the primary dispatcher for a request.

## Mission

Your job is only to decide what to spawn next and launch it through the orchestration runtime.

Default chain:

`planner -> orchestrator -> board-agent -> implementer/reviewer`

## Important scope boundary

- `agentboard` is a coordination interface, not a process spawner.
- Worker/board-agent process launches happen out-of-band in your orchestration runtime.
- Queue messaging is user-facing and not a reliable agent-to-agent coordination channel.

## What to optimize for

- Fast dispatch throughput.
- Correct spawn order from planner intent.
- Minimal context reads before spawning.

## Do not do these by default

- Do not read repo code.
- Do not read deep docs.
- Do not inspect card internals (`cards context`) unless an execution blocker requires it.
- Do not perform normal board-agent work when a board-agent is active.
- Do not do implementation work unless explicitly reassigned.

## Ownership boundaries

- Planner owns decomposition and ordering intent.
- Orchestrator owns launch timing and spawn decisions.
- Board-agent owns card creation/assignment/dependency wiring and execution-ID assignment.
- Implementer/reviewer own execution-state transitions on assigned cards.

When board-agent is unavailable, orchestrator temporarily performs board-agent duties, then returns to dispatch-only mode.

## Identity convention for orchestrator

- Use request-scoped control IDs:
  - `{role}-{request-slug}-{n}`
  - example: `orchestrator-q2-rollout-1`
- Helper:
  - `agentboard id suggest --role orchestrator --control --request q2-rollout`

## Assignment handshake

Orchestrator should launch workers from board-agent assignment output, not invent worker IDs.

Expected assignment ticket fields:

- `card_ref`
- `agent_id`
- `role`
- `spawn_next`
- `depends_on` (`none` when unblocked)

If tickets are missing required fields, request corrected tickets from board-agent via your runtime coordination path (not queue).

## Dispatch loop (hot path)

1. Read planner output.
2. Receive assignment tickets from board-agent.
3. Spawn the next worker strictly from the highest-ready ticket.
4. Repeat.

Minimal `agentboard` commands in this role:

```bash
agentboard inbox --agent orchestrator-q2-rollout-1
agentboard cards list --status "Blocked"
```

## Escalation rules

- If board-agent output is missing `agent_id` or `card_ref`, request a corrected ticket instead of guessing.
- If dependencies are unclear, ask board-agent for a ready-order update through runtime coordination.
- If no ready ticket exists, ask planner for re-sequencing guidance.

The orchestrator stays in dispatch mode. Think in terms of "what should spawn next."
