# Subagent Smoke Test Friction

This file captures friction encountered while smoke testing the `agentboard` CLI using only the inherited board references and instructions.

## 2026-04-06

- Top-level help for `checkpoint` and `finish` still says "active or specified card".
  - The CLI no longer has saved context, so this wording may be stale or ambiguous.
  - I am testing the actual runtime behavior explicitly instead of trusting the help text.
- `agentboard checkpoint --body "..."` fails with `No card specified. Pass --card or use a positional card argument.`
  - The runtime behavior is explicit-only, which is good.
  - The help text is stale because it still implies there may be an active-card fallback.
- `agentboard finish --summary "..."` fails with the same `No card specified` error when no card is passed.
  - Again, the implementation is explicit-only.
  - The help wording should match the actual behavior.
- `agentboard workflow statuses <workflow>` returns rows with a `name` field, not `statusName`.
  - My first lookup used `statusName` and quietly produced a null workflow-status id.
  - The result was a confusing fallback into `Usage:` errors for `workflow set-position`, `workflow set-merge`, and `workflow remove-status`.
  - The command implementations are likely fine; the friction is that the output shape needs to be trusted exactly as returned.
- `agentboard raw POST /queue --body-json '{"agentId":"worker-1","body":"Raw queue smoke test.","author":"user"}'` failed in PowerShell with `Failed to parse JSON`.
  - The same shape would be unremarkable in Bash.
  - The raw escape hatch is still noticeably sharper in PowerShell for POST bodies than for GET query parameters.
- Reusing `agentboard input request` inside a PowerShell background job produced noisy `RemoteException` output when the job emitted heartbeat lines.
  - The foreground `input wait` still completed successfully.
  - The operator experience is messy because normal heartbeat output is treated like job stream noise when recovered through `Receive-Job`.
  - `--heartbeat 0` is now available when a wrapper needs a quiet wait.
- For quick scripting, `agentboard` surfaces are much easier to compose when you already know exact ids.
  - Name-based lookup usually means `list` plus client-side filtering.
  - In practice that makes temporary-resource workflows more error-prone than they need to be when there is no direct `get by name` command.
