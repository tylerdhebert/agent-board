# CLI Friction Log

This file captures friction encountered while implementing the explicit CLI refactor.

## 2026-04-06

- `agentboard cards create` inherited `implementer-1` as `agentId` from ambient CLI state even without `--claim`.
  - This happened while creating implementation cards for the refactor itself.
  - Impact: newly created work items looked pre-assigned before they were explicitly started or claimed.
- `agentboard inbox --help` failed with `Unknown option "--help"` because the top-level alias forwarded to queue parsing without scoped help handling.
- Top-level `session` docs still existed even though the product direction is moving away from hidden session state entirely.
- Using `--agent` after the subcommand, such as `agentboard cards comment --agent implementer-1`, does not work because global flags are only parsed before the command name.
  - This is expected by the parser, but it was easy to forget during the refactor and worth documenting explicitly.
- During verification on PowerShell, `agentboard raw POST ... --body-json <json>` was still brittle for nested JSON payloads.
  - I had to fall back to `--body-file` to smoke-test the input API cleanly.
  - This reinforces that `raw --query` helped GET ergonomics, but POST body ergonomics in PowerShell are still a sharp edge.
