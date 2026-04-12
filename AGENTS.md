# Agentboard Repo Instructions

Use `agentboard` as the required coordination interface for meaningful work in this repo.

Preferred workflow:

1. Before work, check your inbox and attach yourself to a card.
2. During work, keep the card truthful with plan, status, checkpoint, blocker, input-request, and queue updates.
3. At the end of the turn, check the inbox again and finish the card in a truthful handoff state.

Default command flow:

```bash
agentboard inbox --agent <agent-id>
agentboard start --agent <agent-id> --card <card-ref>
agentboard cards context --card <card-ref> --agent <agent-id>
agentboard plan --card <card-ref> --agent <agent-id> "Brief execution plan"
agentboard checkpoint --card <card-ref> --agent <agent-id> --body "Meaningful progress update"
agentboard cards move --card <card-ref> --agent <agent-id> --status "In Review"
agentboard input request --card <card-ref> --prompt "Blocking question here" --type yesno
agentboard queue reply --agent <agent-id> "Direct reply here"
agentboard finish --agent <agent-id> --card <card-ref> --summary "What changed and how it was verified"
```

Preferred references:

- CLI operating guide: `agent/AGENT_CLI.md`
- Mandatory protocol and behavior rules: `agent/AGENT_MANDATE.md`
- Raw HTTP/API fallback reference: `agent/AGENT_API.md`

Loading guidance:

- Start with the CLI guide.
- Use the mandate for required behavior and handoff rules.
- Use the API reference only when the CLI does not expose what you need.

Important norms:

- Do not begin meaningful work without a card.
- Do not leave a card in a misleading status.
- Use `input request` for blocking human decisions.
- Use queue messages for direct communication.
- Use checkpoints or card comments for task-specific progress narration.
- Prefer the direct command form `agentboard ...` over `bun run ...`.
