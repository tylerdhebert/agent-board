import { DEFAULT_BASE_URL } from "./core/constants";

function section(title: string, body: string) {
  return `${title}\n${body}`;
}

export function wantsScopedHelp(args: string[]) {
  return args.length === 0 || args[0] === "help" || args.includes("--help") || args.includes("-h");
}

export function helpText() {
  return `agentboard

CLI-first interface for the running agent-board server.

Setup:
  bun link                         one-time global install
  agentboard <command> [options]   preferred invocation
  bun run agentboard -- <command>  alternate invocation without global link

Global options:
  --url <url>   Override board URL (default: ${DEFAULT_BASE_URL})
  --json        Force JSON output on any command

────────────────────────────────────────────────────────────────
HOT PATH — most agent turns only need these six commands
────────────────────────────────────────────────────────────────

  # 1) Check queue for assignments and messages
  agentboard inbox --agent <agent-id>

  # 2) Start/resume a card — claims it, optionally posts a plan
  agentboard start --agent <agent-id> --card <card-ref> --plan "Investigate, implement, verify."

  # 3) Inspect full card context before editing
  agentboard cards context --card <card-ref> --agent <agent-id>

  # 4) Post a progress checkpoint at meaningful milestones
  agentboard checkpoint --card <card-ref> --agent <agent-id> --body "Progress update."

  # 5) Request a blocking human decision (command waits for answer)
  agentboard input request --card <card-ref> --agent <agent-id> --prompt "Need decision?" --type yesno

  # 6) Finish truthfully at end of turn
  agentboard finish --agent <agent-id> --card <card-ref> --summary "What changed and how it was verified."

────────────────────────────────────────────────────────────────
CORE CONVENTIONS
────────────────────────────────────────────────────────────────

  Explicit-first and stateless: each command stands on its own.
  Pass --agent and --card on every command that needs them.
  --agent and --card are per-command flags: place them after the subcommand.
    correct:   agentboard cards move --card card-142 --agent implementer-1 --to "In Review"
    incorrect: agentboard --agent implementer-1 cards move --card card-142 --to "In Review"
  --url and --json are global and may appear before or after the command name.

  Preferred refs:  cards → card-142,  features → feat-12
  Raw GUIDs are accepted but refs are preferred.

  Default output is human-readable structured text:
    - Lists print aligned tables: REF  STATUS  TITLE  AGENT  UPDATED
    - Single records print key: value lines with empty fields omitted
    - Mutations print a short confirmation line
    - cards context prints a labeled block including Conflicted: and Recent comments: when present

  Add --json for machine-parseable output:
    agentboard --json cards context --card card-142 --agent implementer-1

────────────────────────────────────────────────────────────────
AGENT ID CONVENTIONS
────────────────────────────────────────────────────────────────

  When board-agent is active, IDs are assigned by board-agent.

  Control roles (planner, orchestrator, board-agent) — request-scoped:
    Format:   {role}-{request-slug}-{n}
    Examples: orchestrator-q2-rollout-1  board-agent-q2-rollout-1

  Worker roles (implementer, reviewer) — card-backed:
    Format:   {role}-{card-ref}
    Examples: implementer-card-142  reviewer-card-142

  When no board-agent is active, self-select a direct execution ID:
    Format:   {role}-{task-slug}-{n}
    Example:  implementer-auth-flow-1

  Increment n when matching IDs already exist on the board.
  Once chosen for a card thread, keep the same ID for the full execution.

  Helper:
    agentboard id suggest --role implementer --card card-142
    agentboard id suggest --role orchestrator --control --request q2-rollout
    agentboard id help

────────────────────────────────────────────────────────────────
TOP-LEVEL COMMANDS
────────────────────────────────────────────────────────────────

  help
  health
  inbox --agent <id> [--status pending|read] [--all] [--mark-read]
  start --agent <id> --card <card> [--plan "..."] [--skip-inbox] [--no-auto-advance]
  plan --card <card> --agent <id> "..."
  checkpoint --card <card> --agent <id> --body "..."
  finish --card <card> --agent <id> [--summary "..."] [--status "Done|Ready to Merge"]
  bootstrap --epic "..." --feature "..." --title "..."
  raw <METHOD> <path> [--body-json <json> | --body-file <path>]

────────────────────────────────────────────────────────────────
RESOURCE COMMANDS  (run <group> help for full details)
────────────────────────────────────────────────────────────────

  id help        Agent ID suggestion helpers
  cards help     Card lifecycle: list, get, context, create, claim, move, update, comment, diff, merge
  dep help       Card-to-card dependencies and blockers
  input help     Blocking human-decision requests
  queue help     User-facing message queue and inbox
  worktree help  Git worktree management
  feature help   Feature records and build triggers
  epic help      Epic records
  status help    Board status configuration
  repo help      Repository registration
  workflow help  Workflow / status-set configuration

────────────────────────────────────────────────────────────────
ESCAPE HATCHES
────────────────────────────────────────────────────────────────

  agentboard raw GET /cards
  agentboard raw PATCH /cards/<guid> --body-file patch.json
  agentboard --json cards context --card card-142 --agent implementer-1

  Use raw when you need direct endpoint-level control.
  On Windows/PowerShell, prefer --body-file over --body-json for POST/PATCH payloads.`;
}

export function coreHelp(topic?: string) {
  if (topic === "raw") {
    return section(
      "agentboard raw",
      `Usage:
  agentboard raw <GET|POST|PATCH|DELETE> <path> [--query key=value]... [--body-json <json> | --body-file <path>]

Examples:
  agentboard raw GET /health
  agentboard raw GET /queue --query agentId=implementer-card-142 --query status=pending --query author=user
  agentboard raw POST /queue --body-file request.json
  agentboard raw POST /queue --body-json '{"agentId":"orchestrator","body":"Need input","author":"user"}'

Note:
  On Windows/PowerShell, prefer --body-file for POST/PATCH payloads to avoid quoting issues.`
    );
  }

  return section(
    "agentboard core",
    `Commands:
  health
  raw help`
  );
}

export function taskflowHelp(command: "start" | "plan" | "checkpoint" | "finish" | "bootstrap") {
  switch (command) {
    case "start":
      return section(
        "agentboard start",
        `Usage:
  agentboard start --agent <id> --card <card> [--plan "..."] [--skip-inbox] [--no-auto-advance]

Sets card ownership to the agent, optionally advances "To Do" to "In Progress", and returns pending unread user messages for that agent.

Flags:
  --plan "..."        Sets the card's plan and latestUpdate fields, and posts it as a comment.
                      Skip if you aren't ready to commit to a plan yet.
  --no-auto-advance   By default, start auto-advances the card from "To Do" to "In Progress".
                      Pass this flag to suppress that status change.
  --skip-inbox        Skip the inbox fetch at the end of start.

Notes:
  - Use "cards context" first when you want to confirm the current owner before resuming or reclaiming work.
  - The status shown in the response is the actual status after auto-advance.`
      );

    case "plan":
      return section(
        "agentboard plan",
        `Usage:
  agentboard plan --card <card> --agent <id> "..."
  agentboard plan --card <card> --agent <id> --body "..."

Updates the card's plan and latestUpdate fields, and posts the same text as an agent comment.
Positional text and --body are equivalent; --body takes priority if both are given.`
      );

    case "checkpoint":
      return section(
        "agentboard checkpoint",
        `Usage:
  agentboard checkpoint --card <card> --agent <id> --body "..."

Posts a progress comment on the card and updates its latestUpdate field.
Use at meaningful milestones, not for every small action.`
      );

    case "finish":
      return section(
        "agentboard finish",
        `Usage:
  agentboard finish --card <card> --agent <id> [--summary "..."] [--status "Done|Ready to Merge"] [--no-comment]

Completes the card and posts the summary as a handoff comment.

Status selection order:
  1. Explicit --status value (overrides everything)
  2. "Ready to Merge" — auto-selected when the card has both branchName and repoId set,
     and a "Ready to Merge" status exists on the board
  3. "Done" — used when "Ready to Merge" is not available on the board

  The Status: line in the response shows the actual status chosen.
  Use --status "Done" to force Done even on a branch-backed card.

Flags:
  --summary "..."   Sets handoffSummary and latestUpdate, and posts as a comment.
  --no-comment      Write the summary to the card fields but skip the comment post.`
      );

    case "bootstrap":
      return section(
        "agentboard bootstrap",
        `Usage:
  agentboard bootstrap --epic "..." --feature "..." --title "..." [--description "..."] [--repo <repo>] [--branch <branch>] [--plan "..."]

Creates missing epic and feature records, then creates the card.
Existing epics/features with matching titles are reused, not duplicated.

Flags:
  --plan "..."   Sets the initial plan and latestUpdate fields on the new card.

Notes:
  - bootstrap creates the board records and leaves the new card ready to be started.
  - Use "agentboard start --agent <id> --card <card-ref>" when an agent is ready to take ownership.`
      );
  }
}

export function cardsHelp(topic?: "cards" | "dependencies") {
  if (topic === "dependencies") {
    return section(
      "agentboard dep",
      `Usage:
  agentboard dep board
  agentboard dep list --card <card>
  agentboard dep add --card <card> --blocker <card>
  agentboard dep remove --card <card> --blocker <card>

Aliases:
  agentboard cards deps ...
  agentboard cards dependencies ...

Use dep to express card-to-card blocking relationships. Do not bury blockers in comments.`
    );
  }

  return section(
    "agentboard cards",
    `Usage:

  List and inspect:
    agentboard cards list [--status <status>] [--unblocked] [--epic <epic>] [--feature <feature>] [--agent <id> | --mine]
    agentboard cards get --card <card>
    agentboard cards context --card <card> [--agent <id>]
    agentboard cards completed-today

  Create, claim, and move:
    agentboard cards create --title "..." --feature <feature> [--status <status>]
    agentboard cards claim --card <card> --agent <id> [--no-auto-advance]
    agentboard cards move --card <card> --to "<status>" --agent <id>
    agentboard cards move --card <card> --status "<status>" --agent <id>

  Update first-class fields:
    agentboard cards update --card <card> [--title ...] [--description ...] [--feature ...] [--type ...]
    agentboard cards update --card <card> [--plan ...] [--latest-update ...] [--handoff-summary ...] [--blocked-reason ...]
    agentboard cards update --card <card> [--clear-conflict]

  Comments, diff, and merge:
    agentboard cards comment --card <card> --agent <id> --body "..."
    agentboard cards diff --card <card>
    agentboard cards recheck-conflicts --card <card>
    agentboard cards merge --card <card> [--strategy <strategy>] [--target <branch>]
    agentboard cards delete --card <card>
    agentboard cards deps help

Notes:
  cards get vs cards context:
    - "cards get" returns a concise summary of the card (title, status, agent, feature, epic, timestamps).
    - "cards context" returns the full operational picture: blockers, dependencies, conflict state,
      pending input requests, recent comments, and suggested branch. Use context before touching code.

  cards list flags:
    - --unblocked filters to cards with no active blockers. Useful for orchestrators finding dependency-ready work.
    - --mine filters cards owned by the provided --agent.

  cards move flags:
    - --to and --status are equivalent. If both are passed, --to takes priority.

  Ownership and workflow:
    - start and cards claim set ownership on the card.
    - cards move changes workflow status and keeps ownership in place.
    - cards update edits card metadata such as plan, latestUpdate, blockedReason, handoffSummary, and conflict fields.

  First-class card fields (prefer these over free-text comments):
    plan, latestUpdate, blockedReason, handoffSummary — all surfaced in cards context output.

  cards update output:
    - Returns the full post-update card context so you can verify the mutation without a follow-up
      "cards context" call.`
  );
}

export function communicationHelp(topic: "input" | "queue") {
  if (topic === "input") {
    return section(
      "agentboard input",
      `Usage:
  agentboard input request --card <card> [--agent <id>] --prompt "..." [--type text|yesno|choice] [--option "..."]... [--default "..."] [--timeout <secs>]
  agentboard input request --card <card> [--agent <id>] --file questions.json
  agentboard input list [--status pending|answered|timed_out] [--card <card>] [--agent <id>]
  agentboard input get <requestId>
  agentboard input wait <requestId> [--timeout <secs>] [--poll-interval <secs>] [--heartbeat <secs>]
  agentboard input answer <requestId> --answers-json '{"q1":"yes"}'
  agentboard input answer <requestId> --answer q1=yes --answer q2=no

Question types:
  yesno    Binary yes/no decision. Use only for true binary decisions.
  choice   Finite list of options. Supply with --option "..." for each option.
  text     Open-ended answer for information the human needs to write in directly.

Behavior:
  - input request is blocking — the command waits until the human answers or the request times out.
  - Use --agent to record which agent opened the blocking request. This is recommended for
    agent-issued requests and will show up in input list/get output.
  - While waiting, the CLI prints a heartbeat line at regular intervals so you know it is still blocked.
  - If a "Blocked" status exists on the board, the server moves the card there while waiting.
  - When the request is answered or times out, the server restores the card's previous status
    (as long as the card is still in "Blocked").
  - Do not issue a blocking request and then keep working past that decision point.

Recovery (if a waiting turn was interrupted):
  agentboard input list --status pending --card <card>   find the request id
  agentboard input wait <requestId>                       resume waiting`
    );
  }

  return section(
    "agentboard queue",
    `Usage:
  agentboard inbox --agent <id> [--status pending|read] [--all] [--mark-read]
  agentboard queue inbox --agent <id> [--status pending|read] [--all] [--mark-read]
  agentboard queue reply --agent <id> "..."
  agentboard queue send --agent <id> --body "..." [--author <id|user>]
  agentboard queue read <messageId>
  agentboard queue read-all --agent <id>
  agentboard queue delete <messageId>
  agentboard queue clear-conversation --agent <id>

reply vs send:
  - queue reply   THE normal agent outbox command. Agents use this to send messages to the user.
                  Author is always set to the agent's own ID — it will appear as an agent message.
  - queue send    Posts with an explicit --author. Use it for system messages or for injecting
                  a user-side message with a chosen author identity.

inbox behavior:
  - inbox and queue inbox are identical — both check unread user-authored messages for the exact agent id.
  - default behavior is pending unread user messages only.
  - --all includes read user-authored messages too.
  - an empty inbox means the user has no unread messages queued for that exact agent id.

Do not use queue for agent-to-agent coordination. Use card comments or dep for that.`
  );
}

export function identityHelp() {
  return section(
    "agentboard id",
    `Usage:
  agentboard id suggest --role <role> --control --request <request-slug>
  agentboard id suggest --role <role> --card <card>
  agentboard id suggest --role <role> --task "task description"

Provide exactly one of --control, --card, or --task:
  --control   Requires --request. Returns indexed control IDs: orchestrator-q2-rollout-1
  --card      Returns deterministic card-backed IDs: implementer-card-142
  --task      Returns indexed direct-execution IDs: implementer-auth-flow-1, then -2 on collision

Examples:
  agentboard id suggest --role orchestrator --control --request q2-rollout
  agentboard id suggest --role board-agent --control --request q2-rollout
  agentboard id suggest --role implementer --card card-142
  agentboard id suggest --role reviewer --card card-142
  agentboard id suggest --role implementer --task "auth flow"`
  );
}

export function adminHelp(topic: "status" | "epic" | "feature" | "repo" | "workflow" | "worktree") {
  switch (topic) {
    case "status":
      return section(
        "agentboard status",
        `Usage:
  agentboard status list
  agentboard status create --name "..." --color "#hex"
  agentboard status update <status> [--name "..."] [--color "#hex"] [--position <n>]
  agentboard status delete <status>

Notes:
  - Seeded statuses are core and permanent.
  - Core statuses can be reordered and recolored, but not renamed or deleted.
  - Additional statuses can be added, updated, and deleted normally.`
      );

    case "epic":
      return section(
        "agentboard epic",
        `Usage:
  agentboard epic list
  agentboard epic create --title "..." [--description "..."] [--status <status>] [--workflow <workflow>]
  agentboard epic update <epic> [--title ...] [--description ...] [--status ...] [--workflow ...]
  agentboard epic delete <epic>
  agentboard epic commits <epic> --repo <repo>
  agentboard epic commit <epic> <hash> --repo <repo>`
      );

    case "feature":
      return section(
        "agentboard feature",
        `Usage:
  agentboard feature list [--epic <epic>] [--agent <id>]
  agentboard feature create --epic <epic> --title "..." [--description "..."] [--status <status>] [--repo <repo>] [--branch <branch>]
  agentboard feature update <feature> [--title ...] [--description ...] [--status ...] [--epic ...] [--repo ...] [--branch ...]
  agentboard feature delete <feature>
  agentboard feature commits <feature>
  agentboard feature commit <feature> <hash>
  agentboard feature build <feature>           triggers async build
  agentboard feature build-status <feature>    returns current build status (call repeatedly to poll)`
      );

    case "repo":
      return section(
        "agentboard repo",
        `Usage:
  agentboard repo list
  agentboard repo create --name "..." --path "..." [--base <branch>] [--build "..."]
  agentboard repo update <repo> [--name ...] [--path ...] [--base ...] [--build ...]
  agentboard repo delete <repo>`
      );

    case "workflow":
      return section(
        "agentboard workflow",
        `Usage:
  agentboard workflow list
  agentboard workflow statuses <workflow>
  agentboard workflow add-status <workflow> --status <status> [--triggers-merge]
  agentboard workflow remove-status <workflow> <workflowStatusId>
  agentboard workflow set-position <workflow> <workflowStatusId> <position>
  agentboard workflow set-merge <workflow> <workflowStatusId> <true|false>`
      );

    case "worktree":
      return section(
        "agentboard worktree",
        `Usage:
  agentboard worktree create --card <card> --repo <repo> [--agent <id>] [--branch <branch>] [--base <branch>]
  agentboard worktree remove --branch <branch> --repo <repo>
  agentboard worktree remove --card <card> --repo <repo>

Branch selection order for create:
  1. Explicit --branch
  2. Existing card.branchName
  3. Generated per-card branch: wt/<agent>/<card-ref>-<slug>

Base branch selection order:
  1. Explicit --base
  2. Currently checked-out branch at the repo path
  3. Repo's configured baseBranch

Create output:
  - Returns the card branch path plus the actual base branch used when this command created the branch.
  - If an existing branch is reused, the command reports that the original base branch was not determined here.

Board-agent policy:
  If acting as board-agent, always request explicit user input for base branch before creating a worktree:
    agentboard input request --card <card> --type text --timeout 300 --prompt "Which base branch should I use?"
  Treat that request as blocking. Only fall back to the default order above after a timeout.

Parallel worktree guidance:
  - One card maps to one worktree branch. Do not share implementation branches between agents.
  - Multiple agents working on the same feature should each claim a different card
    and create a different worktree branch.
  - The feature branch is the integration base for per-card worktree branches.`
      );
  }
}
