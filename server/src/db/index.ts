import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { statuses } from "./schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { join } from "path";
import { mkdirSync } from "fs";

const DB_PATH = join(import.meta.dir, "../../../data/agent-board.db");

mkdirSync(join(import.meta.dir, "../../../data"), { recursive: true });

const sqlite = new Database(DB_PATH, { create: true });

// Enable WAL mode for better concurrent read performance
sqlite.run("PRAGMA journal_mode = WAL;");
sqlite.run("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });

// ---------------------------------------------------------------------------
// Bootstrap — create tables if they don't exist
// ---------------------------------------------------------------------------
export function initDb() {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS statuses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS epics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status_id TEXT REFERENCES statuses(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      epic_id TEXT NOT NULL REFERENCES epics(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status_id TEXT REFERENCES statuses(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      feature_id TEXT REFERENCES features(id),
      epic_id TEXT REFERENCES epics(id),
      type TEXT NOT NULL DEFAULT 'task' CHECK(type IN ('story','bug','task')),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status_id TEXT NOT NULL REFERENCES statuses(id),
      agent_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      author TEXT NOT NULL DEFAULT 'user' CHECK(author IN ('agent','user')),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS input_requests (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      questions TEXT NOT NULL,
      answers TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','answered','timed_out')),
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      answered_at TEXT,
      timeout_secs INTEGER NOT NULL DEFAULT 900
    )
  `);

  // Migrate: add completed_at if not present (safe to run repeatedly)
  try {
    sqlite.run(`ALTER TABLE cards ADD COLUMN completed_at TEXT`);
  } catch {
    // Column already exists — no-op
  }

  // Create transition_rules table if not present
  try {
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS transition_rules (
        id TEXT PRIMARY KEY,
        agent_pattern TEXT,
        from_status_id TEXT REFERENCES statuses(id) ON DELETE CASCADE,
        to_status_id TEXT NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // already exists
  }

  // Seed statuses if empty
  const existing = db.select().from(statuses).all();
  if (existing.length === 0) {
    const seed = [
      { id: randomUUID(), name: "To Do", color: "#64748b", position: 0 },
      { id: randomUUID(), name: "In Progress", color: "#3b82f6", position: 1 },
      { id: randomUUID(), name: "In Review", color: "#a855f7", position: 2 },
      { id: randomUUID(), name: "Needs Revision", color: "#f59e0b", position: 3 },
      { id: randomUUID(), name: "Blocked", color: "#ef4444", position: 4 },
      { id: randomUUID(), name: "Done", color: "#22c55e", position: 5 },
    ];
    for (const s of seed) {
      db.insert(statuses).values(s).run();
    }
    console.log("[db] Seeded statuses");
  }
}

export { sqlite };
