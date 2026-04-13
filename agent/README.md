# Agent Docs

This directory holds the reusable agent instruction documents for this repo:

- `AGENT_MANDATE.md`
- `AGENT_API.md`
- `ORCHESTRATOR.md`
- `BOARD_AGENT.md`

Repo-local skill:

- `.claude/skills/conflict-resolution/SKILL.md`

Compatibility pointer:

- `CONFLICT_RESOLVER.md`

Use the helper scripts in `scripts/` to expose these docs in another directory as symlinks.

Notes:

- `link-agent-docs.sh` is for environments with `bash` and `ln -s`.
- On Windows, `link-agent-docs.ps1` may require an elevated shell or Developer Mode to create file symlinks.

Examples:

```bash
bash agent/scripts/link-agent-docs.sh /path/to/agent-dir
```

```powershell
powershell -ExecutionPolicy Bypass -File .\agent\scripts\link-agent-docs.ps1 -Destination C:\path\to\agent-dir
```
