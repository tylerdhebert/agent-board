# agent-board

A full-stack local task board for monitoring and coordinating AI agents. Agents can create cards, post progress updates, move work through statuses, and — most importantly — pause and ask you a question directly in the UI when they need human input.

---

## Setup

```bash
# Install dependencies (server + client)
cd server && bun install
cd ../client && bun install

# Start both
cd server && bun run dev
cd ../client && bun run dev
```

- **API** — `http://localhost:31377`
- **UI** — `http://localhost:5173`

The database is created automatically at `data/agent-board.db` on first run. Default statuses (To Do, In Progress, In Review, Needs Revision, Blocked, Done) are seeded on first startup.

---

## What it does

### For you
- A Kanban board showing all active agent work in real time
- Audio + browser notifications when an agent needs your input
- An input modal where you answer agent questions (yes/no, multiple choice, free text)
- A hierarchy sidebar to filter cards by epic or feature
- A daily summary bar showing what was completed today
- An admin panel to manage statuses, epics, features, cards, and transition rules

### For agents
- Create and update cards to represent their work
- Post comments to narrate progress
- Claim cards to take ownership
- Check which status transitions are permitted before moving a card
- Block execution and request user input — the HTTP call long-polls until you answer

---

## Integrating agents

### The fast way — include AGENT_API.md in agent instructions

`AGENT_API.md` at the repo root is a concise HTTP reference written specifically for agents. Include it in any agent's system prompt or base instructions:

```
You have access to a task board at http://localhost:31377.
See the API reference below for how to use it.

<agent_api>
[contents of AGENT_API.md]
</agent_api>
```

That's all an agent needs. It can then create cards, post comments, update statuses, and request input from you using plain HTTP calls.

### Claude Code agents — use the slash command skills

`.claude/commands/` contains Claude Code slash command skills. In any Claude Code session:

```
/board-create-card    Build the login page — task, assign to frontend-agent
/board-update-card    abc-123 set status to In Review
/board-complete-card  abc-123 All tests passing, PR merged
/board-block-card     abc-123 Waiting for API keys from the infra team
/board-request-input  abc-123 Should I overwrite the existing config?
/board-add-comment    abc-123 Found 3 failing tests, investigating now
/board-list-cards     Blocked
/board-get-card       abc-123
/board-create-epic    Authentication Overhaul — replace session tokens with JWTs
/board-create-feature epic-456 JWT Issuance — token signing and refresh flow
```

### TypeScript agents — use the agent-client

`agent-client/index.ts` is a typed HTTP wrapper for agents running as Bun/Node processes:

```ts
import { createCard, requestInput, addComment, updateCard } from "../agent-client/index.ts";

const card = await createCard({ title: "Refactor auth module", agentId: "my-agent" });

const answers = await requestInput(card.id, [
  { id: "confirm", type: "yesno", prompt: "Proceed with the breaking migration?" },
  { id: "strategy", type: "choice", prompt: "Which strategy?", options: ["rolling", "big-bang"] },
]);

await addComment(card.id, `Using strategy: ${answers.strategy}`);
await updateCard(card.id, { status: "Done" });
```

Set `AGENT_BOARD_URL` to point to a non-localhost board:
```bash
AGENT_BOARD_URL=http://192.168.1.10:31377 bun run my-agent.ts
```

---

## Requesting user input

This is the most valuable feature. When an agent hits a decision it can't make alone, it calls `POST /api/input` with a list of questions. The HTTP request **blocks** — it stays open until you answer in the UI. Your card moves to Blocked automatically while waiting.

The UI surfaces an audio alert and a floating notification. You click it, answer the questions, and the agent's execution resumes with your answers.

**Always include `AGENT_API.md` in agent instructions.** The more agents use this endpoint, the more useful the board becomes as a coordination layer.

---

## Transition rules

The admin panel has a **Rules** tab where you configure which agents can move cards to which statuses. Rules match agents by pattern (e.g. `implementer*`) and optionally restrict which status a card must be in before the move is allowed.

If no rules are configured, all moves are permitted. Rules only apply when a card is moved with an `agentId` — admin moves through the UI are always allowed.

Agents should call `GET /api/cards/:id/allowed-statuses?agentId=<id>` before patching status to know what moves are available to them.

---

## Project structure

```
agent-board/
├── server/                  # Bun + Elysia API
│   └── src/
│       ├── index.ts         # Server entry, route mounting, WebSocket
│       ├── db/
│       │   ├── index.ts     # DB init, migrations, seeding
│       │   └── schema.ts    # Drizzle table definitions + inferred types
│       ├── routes/          # One file per resource
│       │   ├── cards.ts
│       │   ├── statuses.ts
│       │   ├── epics.ts
│       │   ├── features.ts
│       │   ├── input.ts
│       │   └── transitionRules.ts
│       ├── wsManager.ts     # WebSocket client registry + broadcast
│       └── pollRegistry.ts  # Long-poll promise parking
│
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── admin/       # Admin panel sections (one file each)
│       │   └── ...          # Board, cards, modals, sidebar, etc.
│       ├── hooks/
│       │   └── useWebSocket.ts
│       ├── store/
│       │   └── index.ts     # Zustand store
│       └── api/
│           ├── client.ts    # Base URL + Eden treaty setup
│           └── types.ts     # Shared TypeScript types
│
├── agent-client/
│   └── index.ts             # Typed HTTP client for TS/Bun agents
│
├── data/                    # SQLite database (gitignored)
├── docs/                    # Stack explainers
│   ├── BUN.md
│   ├── ELYSIA.md
│   ├── DRIZZLE.md
│   ├── TANSTACK_QUERY.md
│   └── ZUSTAND.md
│
├── .claude/commands/        # Claude Code slash command skills
├── AGENT_API.md             # HTTP reference for agents
└── README.md
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](docs/BUN.md) |
| API framework | [Elysia](docs/ELYSIA.md) |
| Database | SQLite via `bun:sqlite`, WAL mode |
| ORM | [Drizzle](docs/DRIZZLE.md) |
| Frontend | React 19 + TypeScript + Vite + Tailwind v4 |
| Server state | [TanStack Query v5](docs/TANSTACK_QUERY.md) |
| UI state | [Zustand](docs/ZUSTAND.md) |
| Real-time | Native WebSocket (Elysia WS) |

See `docs/` for plain-English explainers on each piece.

---

## How it works — brief technical notes

**Real-time updates** — every mutation broadcasts a WebSocket event immediately after the DB write. The client's `useWebSocket` hook invalidates the relevant TanStack Query caches on each event, so the UI updates within milliseconds without polling.

**Long-poll input** — `POST /api/input` parks a Promise in `pollRegistry` (a `Map` of resolve/reject callbacks). The route handler `await`s it, suspending without blocking the event loop. When you submit answers, `POST /api/input/:id/answer` resolves the Promise and the original request returns. Timeout after 900 seconds by default.

**Migrations** — no migration runner. `initDb()` runs `CREATE TABLE IF NOT EXISTS` on every startup. New columns are added with `ALTER TABLE ... ADD COLUMN` in a try/catch (no-op if already present).
