# Agent Docs

This directory holds the reusable agent instruction documents for this repo:

- `AGENT_MANDATE.md`
- `AGENT_API.md`
- `ORCHESTRATOR.md`
- `BOARD_AGENT.md`

Repo-local skill:

- `skills/conflict-resolution/SKILL.md`

Use the helper scripts in `scripts/` to expose these docs in another directory as symlinks. The scripts link the markdown files and create a `skills/` directory in the destination with symlinks to each skill subdirectory.

Notes:

- `link-agent-docs.sh` is for environments with `bash` and `ln -s`.
- On Windows, `link-agent-docs.ps1` uses Junctions for skill directories (no elevated shell needed) and SymbolicLinks for files (may require elevated shell or Developer Mode).

Examples:

```bash
bash agent/scripts/link-agent-docs.sh /path/to/agent-dir
```

```powershell
powershell -ExecutionPolicy Bypass -File .\agent\scripts\link-agent-docs.ps1 -Destination C:\path\to\agent-dir
```
