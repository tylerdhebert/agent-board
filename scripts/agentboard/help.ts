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

Global options:
  --url <url>       Override board URL (default: ${DEFAULT_BASE_URL})
  --json            Reserved for machine-readable flows (objects already print as JSON)

Top-level commands:
  help
  health
  raw <METHOD> <path> [--body-json <json> | --body-file <path>]
  start --agent <id> --card <card> [--plan "..."]
  checkpoint --body "..."
  finish [--summary "..."] [--status "Done|Ready to Merge"]
  bootstrap --epic "..." --feature "..." --title "..." [--agent <id>]
  inbox [--agent <id>] [--status pending|read] [--all] [--mark-read]

Resource commands:
  cards help
  dep help
  input help
  queue help
  status help
  epic help
  feature help
  repo help
  workflow help
  rule help
  worktree help

Fallback:
  agentboard <command> help
  agentboard <command> --help`;
}

export function coreHelp(topic?: string) {
  if (topic === "raw") {
    return section(
      "agentboard raw",
      `Usage:
  agentboard raw <GET|POST|PATCH|DELETE> <path> [--query key=value]... [--body-json <json> | --body-file <path>]

Examples:
  agentboard raw GET /health
  agentboard raw GET /queue --query agentId=implementer-1 --query status=pending
  agentboard raw POST /queue --body-file request.json
  agentboard raw POST /queue --body-json '{"agentId":"orchestrator","body":"Need input","author":"user"}'`
    );
  }

  return section(
    "agentboard core",
    `Commands:
  health
  raw help`
  );
}

export function taskflowHelp(command: "start" | "checkpoint" | "finish" | "bootstrap") {
  switch (command) {
    case "start":
      return section(
        "agentboard start",
        `Usage:
  agentboard start --agent <id> --card <card> [--plan "..."] [--skip-inbox] [--no-auto-advance]

Starts work on a card, claims it for the agent, optionally posts a plan, and returns pending inbox messages for that agent.`
      );
    case "checkpoint":
      return section(
        "agentboard checkpoint",
        `Usage:
  agentboard checkpoint --card <card> --body "..."

Posts a progress comment on the specified card.`
      );
    case "finish":
      return section(
        "agentboard finish",
        `Usage:
  agentboard finish --card <card> --agent <id> [--summary "..."] [--status "Done"] [--no-comment]

Completes the specified card, choosing "Ready to Merge" automatically for branch-backed cards when available.`
      );
    case "bootstrap":
      return section(
        "agentboard bootstrap",
        `Usage:
  agentboard bootstrap --epic "..." --feature "..." --title "..." [--description "..."] [--repo <repo>] [--branch <branch>] [--agent <id>] [--claim|--no-claim]

Creates missing epic/feature scaffolding, then creates a card and can immediately claim it.`
      );
  }
}

export function cardsHelp(topic?: "cards" | "dependencies") {
  if (topic === "dependencies") {
    return section(
      "agentboard dep",
      `Usage:
  agentboard dep board
  agentboard dep list <card>
  agentboard dep add <card> --blocker <card>
  agentboard dep remove <card> --blocker <card>

Aliases:
  agentboard cards deps ...
  agentboard cards dependencies ...`
    );
  }

  return section(
    "agentboard cards",
    `Usage:
  agentboard cards list [--status <status>] [--epic <epic>] [--feature <feature>] [--agent <id> | --mine]
  agentboard cards get <card>
  agentboard cards create --title "..." --feature <feature> [--status <status>] [--agent <id>] [--claim]
  agentboard cards claim <card> [--agent <id>] [--no-auto-advance]
  agentboard cards allowed <card> [--agent <id>]
  agentboard cards move <card> --to "<status>" [--agent <id>]
  agentboard cards update <card> [--title ...] [--description ...] [--status ...] [--feature ...] [--epic ...] [--type ...]
  agentboard cards comment <card> [--agent <id>] --body "..." [--author agent|user]
  agentboard cards diff <card>
  agentboard cards merge <card> [--strategy <strategy>] [--target <branch>]
  agentboard cards recheck-conflicts <card>
  agentboard cards delete <card>
  agentboard cards completed-today
  agentboard cards deps help`
  );
}

export function communicationHelp(topic: "input" | "queue") {
  if (topic === "input") {
    return section(
      "agentboard input",
      `Usage:
  agentboard input list [--status pending|answered|timed_out] [--card <card>]
  agentboard input get <requestId>
  agentboard input wait <requestId> [--timeout <secs>] [--poll-interval <secs>] [--heartbeat <secs>]
  agentboard input request <card> --prompt "..." [--type text|yesno|choice] [--option "..."] [--default "..."] [--timeout <secs>] [--poll-interval <secs>] [--heartbeat <secs>]
  agentboard input request <card> --file questions.json
  agentboard input answer <requestId> --answers-json '{"q1":"yes"}'
  agentboard input answer <requestId> --answer q1=yes --answer q2=no`
    );
  }

  return section(
    "agentboard queue",
    `Usage:
  agentboard queue conversations
  agentboard queue inbox [--agent <id>] [--status pending|read] [--all] [--mark-read]
  agentboard queue send --agent <id> --body "..." [--author <id|user>]
  agentboard queue reply --agent <id> "..."
  agentboard queue read <messageId>
  agentboard queue read-all [--agent <id>]
  agentboard queue delete <messageId>
  agentboard queue clear-conversation --agent <id>`
  );
}

export function adminHelp(topic: "status" | "epic" | "feature" | "repo" | "workflow" | "rule" | "worktree") {
  switch (topic) {
    case "status":
      return section(
        "agentboard status",
        `Usage:
  agentboard status list
  agentboard status create --name "..." --color "#hex"
  agentboard status update <status> [--name "..."] [--color "#hex"] [--position <n>]
  agentboard status delete <status>`
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
  agentboard feature build <feature>
  agentboard feature build-status <feature>`
      );
    case "repo":
      return section(
        "agentboard repo",
        `Usage:
  agentboard repo list
  agentboard repo create --name "..." --path "..." [--base <branch>] [--compare-base <branch>] [--build "..."]
  agentboard repo update <repo> [--name ...] [--path ...] [--base ...] [--compare-base ...] [--build ...]
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
    case "rule":
      return section(
        "agentboard rule",
        `Usage:
  agentboard rule list
  agentboard rule create --to <status> [--from <status>] [--agent-pattern <pattern>]
  agentboard rule delete <ruleId>`
      );
    case "worktree":
      return section(
        "agentboard worktree",
        `Usage:
  agentboard worktree create <card> --repo <repo> [--branch <branch>] [--base <branch>]
  agentboard worktree remove <branch> --repo <repo>
  agentboard worktree remove --card <card> --repo <repo>

Branch names can be inferred from the card or feature when available.`
      );
  }
}
