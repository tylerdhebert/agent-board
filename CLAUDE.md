# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run both server and client
bun run dev

# Run individually
cd server && bun run dev   # server only, port 31377
cd client && bun run dev   # client only, port 5173

# Build
bun run build              # both workspaces
cd client && bun run build # tsc -b && vite build (type-checks first)

# Install
bun install                # from root, installs all workspaces
```

No linter or test suite is configured.

## Architecture

Bun monorepo with two workspaces: `server/` and `client/`. The server and client share types via an Eden treaty path alias (`@server` → `server/src/index.ts`), giving the client full type-safety over API calls without code generation.

### Server (`server/src/`)

**Elysia** HTTP + WebSocket server on port **31377**. Entry: `src/index.ts` → `src/app.ts`.

- `app.ts` — bootstraps DB (`initDb()`), mounts CORS, Swagger (`/docs`), WebSocket (`/ws`), and all route groups under `/api`
- `routes/` — one file per resource: `cards`, `statuses`, `epics`, `features`, `input`, `queue`, `transitionRules`, `shortcuts`, `workflows`, `repos`, `worktrees`, `fs`
- `wsManager.ts` — module-level `Set<WsClient>`; every mutation route calls `wsManager.broadcast(event, data)` after writing to DB
- `pollRegistry.ts` — input long-poll: `POST /api/input` parks a `Promise` here; `POST /api/input/:id/answer` resolves it, unblocking the waiting agent
- `db/schema.ts` — Drizzle ORM table definitions (SQLite)
- `db/index.ts` — opens DB, runs `initDb()` (CREATE TABLE IF NOT EXISTS for all tables + seeds statuses and keyboard shortcuts with INSERT OR IGNORE)

**Key API behaviors:**
- `PATCH /api/cards/:id` enforces transition rules (agent_pattern glob + from/to status constraints) when `agentId` is provided
- `POST /api/cards/:id/claim` sets agentId and optionally auto-advances "To Do" → "In Progress"
- `GET /api/cards/:id/allowed-statuses?agentId=` returns statuses the agent can move the card to
- `POST /api/input` blocks until answered or timeout (default 900s); auto-sets card status to "Blocked" while pending
- `GET /api/queue` — exact match on `agentId` (no fuzzy); `GET /api/queue/conversations` groups by agentId with unread counts

### Database Schema

SQLite at `data/agent-board.db`. All IDs are UUID text. Timestamps are ISO 8601 strings.

```
statuses       — id, name (unique), color (hex), position (int)
workflows      — id, name, type ("default"|"worktree")
workflow_statuses — id, workflow_id → workflows, status_id → statuses, position (int), triggers_merge (bool)
repos          — id, name, path, base_branch, compare_base
epics          — id, title, description, status_id → statuses, workflow_id → workflows
features       — id, epic_id → epics (required), title, description, status_id → statuses,
                 repo_id → repos, branch_name
cards          — id, epic_id → epics, feature_id → features, repo_id → repos,
                 status_id → statuses (required), type (story|bug|task), title, description,
                 agent_id, branch_name, completed_at
comments       — id, card_id → cards (cascade), author (agent|user), body
input_requests — id, card_id → cards (cascade), questions (JSON), answers (JSON),
                 status (pending|answered|timed_out), timeout_secs
transition_rules — id, agent_pattern (glob, nullable), from_status_id (nullable = any), to_status_id
queue_messages — id, agent_id, author (default 'user'), body, status (pending|read), read_at
keyboard_shortcuts — id (= action), action (unique), label, group, shortcut (nullable), default_shortcut
```

No migration runner — new columns added to `CREATE TABLE IF NOT EXISTS` directly. For existing DBs, add columns via `try { sqlite.run('ALTER TABLE t ADD COLUMN ...') } catch {}` in `db/index.ts`. Delete the DB to reset fully.

### Client (`client/src/`)

**React 19 + Vite + Tailwind v4** on port **5173**.

- `api/client.ts` — Eden treaty client (`api`), plus `API_BASE` and `WS_URL` constants
- `store/index.ts` — single Zustand store (`useBoardStore`) for: selected card, open modal, pending input requests, WS status, pulsing card IDs, hierarchy filter, admin panel open, chat open, summary expanded, ctrl key held, unseen comment card IDs
- `App.tsx` — mounts `useKeyboardShortcuts()`, WebSocket listener (invalidates React Query cache on WS events), and renders all top-level components

**Real-time flow:** Server broadcasts WS event → `App.tsx` listener calls `queryClient.invalidateQueries(...)` → components re-fetch automatically.

**Keyboard shortcuts system:**
- `hooks/useKeyboardShortcuts.ts` — global keydown/keyup listener; fetches shortcuts from `/api/shortcuts`; dispatches Zustand actions or `window.dispatchEvent(new CustomEvent("kb:..."))` for local component state
- `hooks/useEscapeStack.ts` — module-level LIFO stack; modals call `useEscapeToClose(fn)` on mount; `close-modal` shortcut calls `escapeStack.trigger()`
- `hooks/useShortcutHint.ts` — returns shortcut string for an action when `ctrlHeld` is true (reads TanStack Query cache, no fetch)
- `components/ShortcutBadge.tsx` — renders `<kbd>` badge; shown inline next to UI elements when ctrl is held

**Hierarchy sidebar filter:** `hierarchyFilter` in store (type: `all | epic | feature`). Board filters cards by this value. Sidebar cycling (`kb:sidebar-prev/next`) auto-expands the destination epic and collapses the one being left (unless moving into its own features).

**Chat widget:** Thread windows render at `left: 450 + index * 330`. Max 3 visible; overflow threads shown in a `+N more` bar at slot 4 that pulses on unread. Clicking swaps oldest visible thread with selected overflow thread.

**Admin panel:** Fixed `h-[50vh]` modal with sidenav (statuses, workflows, repos, epics, features, cards, move, rules, shortcuts, danger). Sections are in `components/admin/`.

**BaseBranchPanel:** Right-side commit history panel. Driven by features — shows commit log for each feature that has `repoId` + `branchName` set. Query key: `["feature-commits", feature.id]`. Narrows to one feature when `hierarchyFilter.type === "feature"`. Git range: `repo.baseBranch..feature.branchName`.

**PathPicker:** Component for filesystem path input with server-side directory browser. Fetches `GET /api/fs/browse?path=` which returns `{ path, sep, entries }`. Drill-down navigation with ↑ parent and Select current directory.

## IMPORTANT: API Calls

**Every API call in the client must go through the Eden treaty client (`api` from `api/client.ts`). Never use bare `fetch()` calls.** Eden treaty gives full type-safety from server routes to client without code generation. Hyphenated path segments use bracket notation: `(api.api.cards({ id }) as any)["recheck-conflicts"].post()`.

## Key Conventions

- All UUIDs generated with `randomUUID()` from Node `crypto`
- Colors stored as hex strings (e.g. `#6366f1`)
- The `author` field on comments and queue_messages is `"user"` or the agent's ID string
- Shortcut strings use the format `ctrl+,`, `escape`, `[` — built by `eventToKey()` in `useKeyboardShortcuts.ts`
- Never add `Co-Authored-By` trailers to commits
- Never commit without checking with the user first
- `AGENT_API.md` — full REST API reference for agents; `AGENT_MANDATE.md` — mandatory usage directive for agents (include in agent system prompts)
