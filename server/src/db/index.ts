import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { statuses } from "./schema";
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

function nextRefNum(tableName: "cards" | "features") {
  const row = sqlite
    .prepare(`SELECT COALESCE(MAX(ref_num), 0) + 1 as nextRefNum FROM ${tableName}`)
    .get() as { nextRefNum?: number } | undefined;
  return Number(row?.nextRefNum ?? 1);
}

function backfillRefNums(tableName: "cards" | "features") {
  const rows = sqlite
    .prepare(`SELECT id FROM ${tableName} WHERE ref_num IS NULL ORDER BY created_at, id`)
    .all() as Array<{ id: string }>;
  if (rows.length === 0) return;

  let next = nextRefNum(tableName);
  const stmt = sqlite.prepare(`UPDATE ${tableName} SET ref_num = ? WHERE id = ?`);
  for (const row of rows) {
    stmt.run(next, row.id);
    next += 1;
  }
}

export function nextCardRefNum() {
  return nextRefNum("cards");
}

export function nextFeatureRefNum() {
  return nextRefNum("features");
}

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
      is_core INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS workflow_statuses (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      status_id TEXT NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      triggers_merge INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS repos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      base_branch TEXT NOT NULL DEFAULT 'main',
      build_command TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS epics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status_id TEXT REFERENCES statuses(id),
      workflow_id TEXT REFERENCES workflows(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      ref_num INTEGER NOT NULL UNIQUE,
      epic_id TEXT NOT NULL REFERENCES epics(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status_id TEXT REFERENCES statuses(id),
      repo_id TEXT REFERENCES repos(id),
      branch_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      ref_num INTEGER NOT NULL UNIQUE,
      feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
      epic_id TEXT REFERENCES epics(id),
      repo_id TEXT REFERENCES repos(id),
      type TEXT NOT NULL DEFAULT 'task' CHECK(type IN ('story','bug','task')),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status_id TEXT NOT NULL REFERENCES statuses(id),
      agent_id TEXT,
      plan TEXT,
      latest_update TEXT,
      handoff_summary TEXT,
      blocked_reason TEXT,
      branch_name TEXT,
      completed_at TEXT,
      conflicted_at TEXT,
      conflict_details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      author TEXT NOT NULL DEFAULT 'user' CHECK(author IN ('agent','user')),
      agent_id TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS input_requests (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      agent_id TEXT,
      previous_status_id TEXT,
      questions TEXT NOT NULL,
      answers TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','answered','timed_out')),
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      answered_at TEXT,
      timeout_secs INTEGER NOT NULL DEFAULT 900
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS queue_messages (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'user',
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      read_at TEXT
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS card_dependencies (
      id TEXT PRIMARY KEY,
      blocker_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      blocked_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS build_results (
      id TEXT PRIMARY KEY,
      feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','passed','failed')),
      output TEXT,
      triggered_at TEXT NOT NULL,
      completed_at TEXT
    )
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS keyboard_shortcuts (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      "group" TEXT NOT NULL,
      shortcut TEXT,
      default_shortcut TEXT
    )
  `);

  sqlite.run(`DROP TABLE IF EXISTS transition_rules`);

  // Lightweight schema migration for existing databases.
  let addedStatusIsCore = false;
  try {
    sqlite.run(`ALTER TABLE statuses ADD COLUMN is_core INTEGER NOT NULL DEFAULT 0`);
    addedStatusIsCore = true;
  } catch {
    // Column already exists.
  }

  try {
    sqlite.run(`ALTER TABLE input_requests ADD COLUMN previous_status_id TEXT`);
  } catch {
    // Column already exists.
  }

  try {
    sqlite.run(`ALTER TABLE input_requests ADD COLUMN agent_id TEXT`);
  } catch {
    // Column already exists.
  }

  try {
    sqlite.run(`ALTER TABLE comments ADD COLUMN agent_id TEXT`);
  } catch {
    // Column already exists.
  }

  try {
    sqlite.run(`ALTER TABLE features ADD COLUMN ref_num INTEGER`);
  } catch {
    // Column already exists.
  }

  try {
    sqlite.run(`ALTER TABLE cards ADD COLUMN ref_num INTEGER`);
  } catch {
    // Column already exists.
  }

  try {
    sqlite.run(`ALTER TABLE cards ADD COLUMN plan TEXT`);
  } catch {
    // Column already exists.
  }

  try {
    sqlite.run(`ALTER TABLE cards ADD COLUMN latest_update TEXT`);
  } catch {
    // Column already exists.
  }

  try {
    sqlite.run(`ALTER TABLE cards ADD COLUMN handoff_summary TEXT`);
  } catch {
    // Column already exists.
  }

  try {
    sqlite.run(`ALTER TABLE cards ADD COLUMN blocked_reason TEXT`);
  } catch {
    // Column already exists.
  }

  if (addedStatusIsCore) {
    sqlite.run(`UPDATE statuses SET is_core = 1`);
  }

  try {
    sqlite.run(`ALTER TABLE repos DROP COLUMN compare_base`);
  } catch {
    // Column already removed or never existed.
  }

  sqlite.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_features_ref_num ON features(ref_num)`);
  sqlite.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_ref_num ON cards(ref_num)`);

  backfillRefNums("features");
  backfillRefNums("cards");

  // Upsert shortcuts — INSERT OR IGNORE so existing user customizations are preserved
  const shortcutSeed = [
    { id: "toggle-admin",      action: "toggle-admin",      label: "Toggle admin panel",      group: "Navigation",    shortcut: "ctrl+,", defaultShortcut: "ctrl+," },
    { id: "close-modal",       action: "close-modal",       label: "Close / dismiss",          group: "Navigation",    shortcut: "escape", defaultShortcut: "escape" },
    { id: "filter-all",        action: "filter-all",        label: "Show all cards",           group: "Board",         shortcut: null,     defaultShortcut: null },
    { id: "filter-unassigned", action: "filter-unassigned", label: "Show unassigned cards",    group: "Board",         shortcut: null,     defaultShortcut: null },
    { id: "sidebar-prev",      action: "sidebar-prev",      label: "Previous epic / feature",  group: "Board",         shortcut: null,     defaultShortcut: null },
    { id: "sidebar-next",      action: "sidebar-next",      label: "Next epic / feature",      group: "Board",         shortcut: null,     defaultShortcut: null },
    { id: "sidebar-toggle",    action: "sidebar-toggle",    label: "Expand / collapse epic",   group: "Board",         shortcut: null,     defaultShortcut: null },
    { id: "toggle-chat",       action: "toggle-chat",       label: "Toggle agent chat",        group: "Chat",          shortcut: "ctrl+/", defaultShortcut: "ctrl+/" },
    { id: "chat-new",          action: "chat-new",          label: "New conversation",         group: "Chat",          shortcut: null,     defaultShortcut: null },
    { id: "toggle-summary",    action: "toggle-summary",    label: "Toggle daily summary",     group: "Daily Summary", shortcut: null,     defaultShortcut: null },
    { id: "summary-prev",      action: "summary-prev",      label: "Previous day",             group: "Daily Summary", shortcut: "[",      defaultShortcut: "[" },
    { id: "summary-next",      action: "summary-next",      label: "Next day",                 group: "Daily Summary", shortcut: "]",      defaultShortcut: "]" },
  ];
  for (const s of shortcutSeed) {
    sqlite.run(
      `INSERT OR IGNORE INTO keyboard_shortcuts (id, action, label, "group", shortcut, default_shortcut) VALUES (?, ?, ?, ?, ?, ?)`,
      [s.id, s.action, s.label, s.group, s.shortcut ?? null, s.defaultShortcut ?? null]
    );
  }

  // Seed statuses if empty
  const existing = db.select().from(statuses).all();
  if (existing.length === 0) {
    const seed = [
      { id: randomUUID(), name: "To Do",          color: "#64748b", position: 0, isCore: true },
      { id: randomUUID(), name: "In Progress",    color: "#3b82f6", position: 1, isCore: true },
      { id: randomUUID(), name: "In Review",      color: "#a855f7", position: 2, isCore: true },
      { id: randomUUID(), name: "Needs Revision", color: "#f59e0b", position: 3, isCore: true },
      { id: randomUUID(), name: "Blocked",        color: "#ef4444", position: 4, isCore: true },
      { id: randomUUID(), name: "Done",           color: "#22c55e", position: 5, isCore: true },
      { id: randomUUID(), name: "Ready to Merge", color: "#f97316", position: 6, isCore: true },
    ];
    for (const s of seed) {
      db.insert(statuses).values(s).run();
    }
    console.log("[db] Seeded statuses");
  }

  // Seed workflows
  const defaultWorkflowId = "workflow-default";
  const worktreeWorkflowId = "workflow-worktree";
  const now = new Date().toISOString();

  sqlite.run(
    `INSERT OR IGNORE INTO workflows (id, name, type, created_at) VALUES (?, ?, ?, ?)`,
    [defaultWorkflowId, "Default", "default", now]
  );
  sqlite.run(
    `INSERT OR IGNORE INTO workflows (id, name, type, created_at) VALUES (?, ?, ?, ?)`,
    [worktreeWorkflowId, "Worktree", "worktree", now]
  );

  // Seed workflow_statuses
  const allStatuses = db.select().from(statuses).all();
  const statusByName = Object.fromEntries(allStatuses.map(s => [s.name, s]));

  const defaultStatusNames = ["To Do", "In Progress", "In Review", "Needs Revision", "Blocked", "Done"];
  for (let i = 0; i < defaultStatusNames.length; i++) {
    const s = statusByName[defaultStatusNames[i]];
    if (!s) continue;
    sqlite.run(
      `INSERT OR IGNORE INTO workflow_statuses (id, workflow_id, status_id, position, triggers_merge, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [`ws-default-${s.id}`, defaultWorkflowId, s.id, i, 0, now]
    );
    sqlite.run(
      `INSERT OR IGNORE INTO workflow_statuses (id, workflow_id, status_id, position, triggers_merge, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [`ws-worktree-${s.id}`, worktreeWorkflowId, s.id, i, 0, now]
    );
  }

  const readyStatus = statusByName["Ready to Merge"];
  if (readyStatus) {
    sqlite.run(
      `INSERT OR IGNORE INTO workflow_statuses (id, workflow_id, status_id, position, triggers_merge, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [`ws-worktree-${readyStatus.id}`, worktreeWorkflowId, readyStatus.id, defaultStatusNames.length, 1, now]
    );
  }

}

export { sqlite };
