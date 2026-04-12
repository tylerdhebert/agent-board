# Agentboard Repo Instructions

Use `agentboard` as the required coordination interface for meaningful work in this repo.

## Getting started

Run this first:

```bash
agentboard help
```

This prints the full command reference: hot path, conventions, agent ID rules, all commands with flags and behavioral notes. It is self-contained — you do not need to read a separate CLI guide.

Then read the mandatory protocol:

```
agent/AGENT_MANDATE.md
```

The mandate covers behavioral obligations, role ownership, communication rules, and non-negotiable failures. Read it before beginning work.

## References

- Mandatory protocol and behavior rules: `agent/AGENT_MANDATE.md`
- Raw HTTP/API fallback (when CLI is unavailable): `agent/AGENT_API.md`
- Role-specific guides: `agent/BOARD_AGENT.md`, `agent/ORCHESTRATOR.md`, `agent/CONFLICT_RESOLVER.md`

## Important norms

- Do not begin meaningful work without a card.
- Do not leave a card in a misleading status.
- Use `input request` for blocking human decisions.
- Use queue messages for user-facing communication only.
- Use checkpoints or card comments for task-specific progress narration.
- Prefer the direct command form `agentboard ...` over `bun run ...`.
