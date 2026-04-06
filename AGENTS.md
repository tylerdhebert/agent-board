# Agentboard Sample AGENTS.md

Use `agentboard` as the required coordination interface for meaningful work in this repo.

Preferred workflow:

1. Before work, check your inbox and attach yourself to a card.
2. During work, keep the card truthful with plan, status, comment, blocker, input-request, and queue updates.
3. At the end of the turn, check the inbox again and finish the card in a truthful handoff state.

Default command flow:

```bash
agentboard inbox
agentboard start --agent <agent-id> --card <card-id>
agentboard plan "Brief execution plan"
agentboard cards move --status "In Progress"
agentboard cards comment --body "Meaningful progress update"
agentboard input request --prompt "Blocking question here" --type yesno
agentboard queue reply "Direct reply here"
agentboard finish --summary "What changed and how it was verified"
```

Preferred references:

- CLI operating guide: `<path-to>/agent/AGENT_CLI.md`
- Mandatory protocol and behavior rules: `<path-to>/agent/AGENT_MANDATE.md`
- Raw HTTP/API fallback reference: `<path-to>/agent/AGENT_API.md`

Loading guidance:

- Start with the CLI guide.
- Use the mandate for required behavior and handoff rules.
- Use the API reference only when the CLI does not expose what you need.

Important norms:

- Do not begin meaningful work without a card.
- Do not leave a card in a misleading status.
- Use `input request` for blocking human decisions.
- Use queue messages for direct communication.
- Use card comments for task-specific progress narration.
- Prefer the direct command form `agentboard ...` over `bun run ...`.
