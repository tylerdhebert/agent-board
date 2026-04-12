# Orchestrator Guide

Use this guide for orchestrator agents, board agents, or human operators coordinating multiple implementers.

## Primary responsibilities

- Consume planner output and execute delegation against it.
- Coordinate assignment timing and handoffs across implementers.
- Confirm dependency/order intent from planner output is respected in execution.
- Hand card CRUD, dependency wiring, queue nudges, and worktree hygiene to the board agent when available.
- Avoid doing implementation work unless you are explicitly switching roles.

## Ownership boundary with board agent

- Planner owns decomposition, prioritization, and task-shape decisions.
- Orchestrator owns delegation and execution coordination based on planner output.
- Board agent is the execution owner for board operations: card updates/creation, dependency maintenance, queue coordination, and worktree policy enforcement.
- When a board agent is active, orchestrator should avoid directly mutating card state except for urgent correction.
- When no board agent is active, orchestrator temporarily performs board-agent duties.

## Starting a new epic

Create the feature first if needed:

```bash
agentboard feature create --epic "Agent Operations" --title "CLI workflow polish" --repo agent-board --branch feat/agent-cli
```

Create the initial task cards from planner output:

```bash
agentboard cards create --feature feat-12 --title "Refactor card context output"
agentboard cards create --feature feat-12 --title "Refactor worktree branch defaults"
agentboard cards create --feature feat-12 --title "Update agent docs and examples"
```

Wire up dependencies immediately:

```bash
agentboard dep add --card card-143 --blocker card-142
agentboard dep add --card card-144 --blocker card-143
```

Assign work and send kickoff messages:

```bash
agentboard cards claim card-142 --agent implementer-1
agentboard queue send --agent implementer-1 --body "Start with card-142. Use cards context before editing." --author orchestrator
agentboard queue send --agent implementer-2 --body "Hold for card-143 after card-142 moves to review." --author orchestrator
```

## Parallel agent rules

- Do not assign two agents to the same card.
- Do not expect two agents to share the same worktree branch.
- If multiple agents are working under one feature, each agent should have a separate card and a separate card worktree branch.
- Use dependencies to express order. Do not rely on queue messages alone.
- Keep the repo checked out to the intended integration branch before board agent worktree creation.

## Role split with board agent

- Planner owns planning, decomposition, assignment intent, prioritization, and sequence decisions.
- Orchestrator owns delegation timing, assignment execution, and cross-agent coordination.
- Board agent owns card creation/updates, dependency wiring, queue nudges, stale cleanup, and worktree hygiene checks.

Canonical handoff to board agent:

```bash
agentboard queue send --agent board-agent --body "Create cards for feat-12 from planner output and wire dependencies. Assign implementer-1 to card-142 and implementer-2 to card-143." --author orchestrator
agentboard queue send --agent board-agent --body "Confirm both cards have separate worktree branches after implementers start." --author orchestrator
```

This split keeps orchestrator prompts lean and keeps board state reliable.
