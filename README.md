# agent-board

A full-stack local task board for monitoring and coordinating AI agents. Agents create cards, post progress, move work through statuses, pause to ask you questions, and get blocked on dependency cards — all surfaced in real time. You can message agents between turns via the built-in chat system.

---

## Setup

```bash
bun install          # from root, installs all workspaces
bun run dev          # starts both server and client
```

Or individually:
```bash
cd server && bun run dev   # API on port 31377
cd client && bun run dev   # UI on port 5173
```

The database is created automatically at `data/agent-board.db` on first run. Default statuses and two seeded workflows (Default and Worktree) are created on first startup.

---

## What it does

### For you
- **Kanban board** — real-time card tracking via WebSocket, grouped by epic/feature
- **Input modal** — audio + browser notification when an agent needs your answer; supports yes/no, multiple choice, and free text questions
- **Chat widget** — docked bar (bottom-left) with per-agent thread windows, unread badges, and reply support
- **Hierarchy sidebar** — filter cards by epic or feature; cycling auto-expands/collapses
- **Daily summary bar** — completed cards for today with day navigation to browse past sessions
- **Diff viewer** — view a card's branch diff directly from the card modal
- **Commit panel** — right-side panel showing commits ahead of base for each feature branch, with per-commit diff viewer
- **Build status** — per-feature build trigger with live status badge and expandable output in the commit panel
- **Card dependencies** — link cards as blockers; blocked cards show a lock icon on the board
- **Merge conflict detection** — auto-runs `git merge-tree` when a card reaches a merge-trigger status; shows conflict details per file in a diff-style viewer
- **Admin panel** — manage statuses, workflows, repos, epics, features, cards, and keyboard shortcuts

### For agents
- Create and update cards to represent their work
- Post attributed comments to narrate progress
- Claim cards to take ownership and auto-advance to In Progress
- Request user input — the HTTP call long-polls until you answer
- Check for and reply to user messages via the queue API
- Declare blockers on cards; the server emits `card:unblocked` when all blockers are cleared
- Signal merge readiness by moving a card to a `triggersMerge` status — the server auto-checks for conflicts and marks the card with `conflictedAt` if found
- Clear a conflict after rebasing by patching `conflictedAt: null`

---

## Integrating agents

### Include CLI-first agent docs in agent instructions

For normal operation, provide these docs first:

- `agent/AGENT_CLI.md`
- `agent/AGENT_MANDATE.md`

Use `agent/AGENT_API.md` only as the raw HTTP fallback when the CLI does not expose what is needed.

### Reuse the agent docs with symlink scripts

The reusable agent instruction docs now live in `agent/`:

- `agent/AGENT_CLI.md`
- `agent/AGENT_MANDATE.md`
- `agent/AGENT_API.md`
- `agent/ORCHESTRATOR.md`

Useful defaults:

- Prefer card refs like `card-142` and feature refs like `feat-12` in CLI workflows.
- The CLI now defaults to readable output for common commands. Add `--json` when you want raw machine-friendly output.
- The normal card path is `To Do -> In Progress -> In Review -> Needs Revision -> Done`, with `Blocked` reserved for real pauses.
- For parallel work on one feature, use separate card worktree branches per agent. Treat the feature branch as the integration base, not the shared implementation branch.
- `Ready to Merge` is the merge-ready status for worktree workflows.

To symlink those agent docs into another directory, run one of:

```bash
bash agent/scripts/link-agent-docs.sh /path/to/destination
```

```powershell
powershell -ExecutionPolicy Bypass -File .\agent\scripts\link-agent-docs.ps1 -Destination C:\path\to\destination
```

On Windows, creating file symlinks may require an elevated shell or Developer Mode.

---

## Requesting user input

When an agent hits a decision it can't make alone, it calls `POST /api/input` with a list of questions. The raw HTTP request **blocks** by default — it stays open until you answer in the UI. The card moves to Blocked automatically while waiting.

The UI surfaces an audio alert and a floating notification. You click it, answer the questions, and the agent's execution resumes with your answers immediately.

The repo CLI also supports a resilient blocking workflow for terminal agents:

```bash
agentboard input request --card card-142 --prompt "Proceed?" --type yesno
agentboard input list --status pending --card card-142
agentboard input get <request-id>
agentboard input wait <request-id>
```

`input request` now creates the request first and then waits by request id with a 5-second heartbeat, so terminal agents can often keep the same turn alive while preserving a recovery path if the runtime interrupts the wait. Agents are expected to wait for an answer or for timeout after issuing the request, and they should prefer `choice` questions whenever the valid answers can be enumerated up front instead of falling back to free text. Use `--heartbeat 0` if a shell job or wrapper needs a quiet wait.

---

## Agent chat

The chat widget (bottom-left) lets you exchange messages with any agent between turns.

- **Exact match** — `GET /queue?agentId=implementer-1` delivers only messages addressed to exactly `implementer-1`. Agent IDs must match precisely.
- **Unread badges** — the bar glows and shows a badge count when you have unread agent replies. Clicking into an open thread window clears its badge.
- **Thread windows** — clicking a conversation opens a floating thread window. Up to 3 visible simultaneously; overflow threads appear in a `+N more` bar.
- **Agents should poll** `GET /api/queue?agentId=<id>&status=pending` at the start of each turn.

---

## Card dependencies

Cards can declare blockers — other cards that must be Done before this one can proceed.

- Blocked cards show a **lock icon** on the Kanban tile.
- When the last blocker reaches Done, the server emits a `card:unblocked` WebSocket event.
- Cascade delete: removing a card automatically removes all dependency rows it participates in.
- Manage dependencies in the card modal's **Blockers** section.

---

## Merge conflict detection

When a card moves to a status marked `triggersMerge: true` and has a `branchName` set, the server automatically runs `git merge-tree` against the target branch (feature branch, or repo base branch if no feature branch). No actual merge is performed.

- If conflicts are found: `conflictedAt` is stamped on the card and the `card:conflicted` WS event fires. An amber warning badge appears on the card tile.
- If clean: any previous conflict state is cleared.
- The card modal shows a **View Conflicts** button that opens a per-file conflict diff viewer with conflict-marker highlighting.
- **Resolver agents** rebase their branch, then clear the conflict by patching `conflictedAt: null`. Moving the card back to the `triggersMerge` status re-runs the check.

---

## Build status

Repos can have a `buildCommand` configured. For any feature with a repo and branch set:

- The **Branch Commits** panel shows a **Run Build** button.
- Triggering a build creates a temporary worktree, runs the command in it, and streams the result back via WebSocket (`build:started`, `build:completed`).
- A status badge (running / passed / failed) appears next to the button, with an expandable output panel.
- Builds are **manual only** — they do not trigger automatically on status changes.

---

## Project structure

```
agent-board/
├── server/src/
│   ├── app.ts               # Elysia app builder, route mounting, exports App type
│   ├── index.ts             # Entry point — calls app.listen()
│   ├── db/
│   │   ├── index.ts         # DB init, migrations, seeding
│   │   └── schema.ts        # Drizzle table definitions + inferred types
│   ├── routes/
│   │   ├── cards.ts         # CRUD, claim, comments, dependencies, diff, merge
│   │   ├── statuses.ts
│   │   ├── epics.ts
│   │   ├── features.ts      # Commits, build trigger, build result
│   │   ├── workflows.ts     # Workflow + workflow status management
│   │   ├── repos.ts
│   │   ├── worktrees.ts
│   │   ├── input.ts         # Long-poll user input
│   │   ├── queue.ts         # Agent chat / message queue
│   │   ├── shortcuts.ts
│   │   └── fs.ts            # Filesystem browser for path picker
│   ├── types.ts             # Re-exports App + WorkflowType for client path alias
│   ├── wsManager.ts         # WebSocket client registry + broadcast
│   ├── pollRegistry.ts      # Long-poll promise parking
│   └── git.ts               # git() helper + worktree path util
│
├── client/src/
│   ├── components/
│   │   ├── Board.tsx                # Kanban board, blocked card detection
│   │   ├── KanbanColumn.tsx
│   │   ├── CardTile.tsx             # Blocked + conflict badges
│   │   ├── CardModal.tsx            # Full card detail, blockers, conflict banner
│   │   ├── ConflictDetailsModal.tsx # Per-file conflict diff viewer
│   │   ├── DiffModal.tsx            # Branch diff viewer
│   │   ├── CommitDiffModal.tsx      # Commit diff viewer
│   │   ├── BaseBranchPanel.tsx      # Commit panel + build status
│   │   ├── ChatWidget.tsx           # Docked chat bar + thread windows
│   │   ├── InputModal.tsx
│   │   ├── InputNotificationBanner.tsx
│   │   ├── HierarchySidebar.tsx
│   │   ├── DailySummaryBar.tsx
│   │   ├── EpicPicker.tsx
│   │   ├── PathPicker.tsx
│   │   ├── AdminPanel.tsx
│   │   └── admin/                   # Admin panel sections
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useEscapeStack.ts
│   │   └── useShortcutHint.ts
│   ├── store/index.ts               # Zustand store
│   └── api/
│       ├── client.ts                # Eden treaty typed client + base URLs
│       └── types.ts                 # Shared TypeScript types (imports WorkflowType from @server)
│
├── data/                    # SQLite database (gitignored)
├── agent/
│   ├── AGENT_API.md         # HTTP reference for agents
│   ├── AGENT_CLI.md         # CLI guide for agents
│   ├── AGENT_MANDATE.md     # Mandatory protocol for agents
│   └── scripts/
│       ├── link-agent-docs.ps1
│       └── link-agent-docs.sh
└── CLAUDE.md                # Guidance for Claude Code
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| API framework | Elysia |
| Typed API client | Eden Treaty (`@elysiajs/eden`) |
| Database | SQLite via `bun:sqlite`, WAL mode |
| ORM | Drizzle ORM |
| Frontend | React 19 + TypeScript + Vite + Tailwind v4 |
| Server state | TanStack Query v5 |
| UI state | Zustand |
| Real-time | Native WebSocket (Elysia WS) |

---

## How it works

**Eden Treaty** — the client uses `treaty<App>("localhost:31377")` which derives a fully typed API client directly from Elysia's `App` type. All HTTP calls go through the typed client rather than raw fetch, giving end-to-end type safety from the database schema to the UI. Drizzle enum columns (`text("col", { enum: [...] as const })`) flow through to the client as narrow union types.

**Real-time updates** — every mutation broadcasts a WebSocket event after the DB write. The client's `useWebSocket` hook invalidates the relevant TanStack Query caches on each event, so the UI updates within milliseconds without polling.

**Long-poll input** — `POST /api/input` parks a Promise in `pollRegistry`. The route handler `await`s it, suspending without blocking the event loop. When you submit answers, `POST /api/input/:id/answer` resolves the Promise and the original request returns.

**Conflict detection** — when a card moves to a `triggersMerge` status, the server runs `git merge-base` then `git merge-tree <base> <target> <card-branch>` entirely in-memory. No working tree is touched. The full output is stored as `conflictDetails` on the card for display.

**Migrations** — no migration runner. `initDb()` runs `CREATE TABLE IF NOT EXISTS` on every startup. New columns are added with `ALTER TABLE ... ADD COLUMN` in a try/catch (no-op if already present).

**Server split** — `app.ts` builds and exports the Elysia app (and the `App` type). `index.ts` calls `.listen()`. This split lets the client import `App` via the `@server` path alias without pulling in Bun's native runtime modules.

