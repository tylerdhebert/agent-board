# Bun

Bun is a JavaScript runtime, package manager, bundler, and test runner — all in one binary. It's a faster alternative to the Node.js + npm ecosystem.

## What it replaces

| Old | Bun equivalent |
|-----|---------------|
| `node` | `bun run` |
| `npm install` | `bun install` |
| `npx` | `bunx` |
| `ts-node` | `bun run` (TypeScript works natively, no compilation step) |

## Why it's fast

Bun is written in Zig and uses JavaScriptCore (Safari's JS engine) instead of V8. It skips a lot of overhead that Node.js carries for legacy compatibility reasons. Cold start times are noticeably faster, which matters for a server that restarts during development.

## How it's used here

The server runs directly with `bun run src/index.ts` — no TypeScript compilation, no separate build step. Bun reads `.ts` files natively.

SQLite is built into Bun's standard library (`bun:sqlite`), which is why there's no separate SQLite driver dependency — the database connection is just:

```ts
import { Database } from "bun:sqlite";
const db = new Database("data/agent-board.db");
```

## Key things to know

- `bun install` creates a `bun.lockb` (binary lockfile) instead of `package-lock.json`
- `import.meta.dir` is the Bun equivalent of Node's `__dirname`
- `bun:sqlite` is Bun-specific — this server won't run on Node without swapping the DB driver
- Hot reload during development: `bun --hot run src/index.ts`
