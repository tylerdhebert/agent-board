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
      compare_base TEXT,
      build_command TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Migration: add compare_base to existing repos table
  try { sqlite.run(`ALTER TABLE repos ADD COLUMN compare_base TEXT`); } catch {};
  // Migration: add build_command to existing repos table
  try { sqlite.run(`ALTER TABLE repos ADD COLUMN build_command TEXT`); } catch {};

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
  // Migrations: add repo/branch to existing features table
  try { sqlite.run(`ALTER TABLE features ADD COLUMN repo_id TEXT REFERENCES repos(id)`); } catch {}
  try { sqlite.run(`ALTER TABLE features ADD COLUMN branch_name TEXT`); } catch {}

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
      epic_id TEXT REFERENCES epics(id),
      repo_id TEXT REFERENCES repos(id),
      type TEXT NOT NULL DEFAULT 'task' CHECK(type IN ('story','bug','task')),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status_id TEXT NOT NULL REFERENCES statuses(id),
      agent_id TEXT,
      branch_name TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migrations: add conflict detection columns to cards
  try { sqlite.run(`ALTER TABLE cards ADD COLUMN conflicted_at TEXT`); } catch {}
  try { sqlite.run(`ALTER TABLE cards ADD COLUMN conflict_details TEXT`); } catch {}

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

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS transition_rules (
      id TEXT PRIMARY KEY,
      agent_pattern TEXT,
      from_status_id TEXT REFERENCES statuses(id) ON DELETE CASCADE,
      to_status_id TEXT NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

  // Upsert shortcuts — INSERT OR IGNORE so existing user customizations are preserved
  // but new actions added in future releases still appear
  const shortcutSeed = [
    { id: "toggle-admin",      action: "toggle-admin",      label: "Toggle admin panel",   group: "Navigation",    shortcut: "ctrl+,", defaultShortcut: "ctrl+," },
    { id: "close-modal",       action: "close-modal",       label: "Close / dismiss",       group: "Navigation",    shortcut: "escape", defaultShortcut: "escape" },
    { id: "filter-all",        action: "filter-all",        label: "Show all cards",        group: "Board",         shortcut: null,     defaultShortcut: null },
    { id: "filter-unassigned", action: "filter-unassigned", label: "Show unassigned cards", group: "Board",         shortcut: null,     defaultShortcut: null },
    { id: "sidebar-prev",      action: "sidebar-prev",      label: "Previous epic / feature", group: "Board",       shortcut: null,     defaultShortcut: null },
    { id: "sidebar-next",      action: "sidebar-next",      label: "Next epic / feature",   group: "Board",         shortcut: null,     defaultShortcut: null },
    { id: "sidebar-toggle",    action: "sidebar-toggle",    label: "Expand / collapse epic", group: "Board",         shortcut: null,     defaultShortcut: null },
    { id: "toggle-chat",       action: "toggle-chat",       label: "Toggle agent chat",     group: "Chat",          shortcut: "ctrl+/", defaultShortcut: "ctrl+/" },
    { id: "chat-new",          action: "chat-new",          label: "New conversation",      group: "Chat",          shortcut: null,     defaultShortcut: null },
    { id: "toggle-summary",    action: "toggle-summary",    label: "Toggle daily summary",  group: "Daily Summary", shortcut: null,     defaultShortcut: null },
    { id: "summary-prev",      action: "summary-prev",      label: "Previous day",          group: "Daily Summary", shortcut: "[",      defaultShortcut: "[" },
    { id: "summary-next",      action: "summary-next",      label: "Next day",              group: "Daily Summary", shortcut: "]",      defaultShortcut: "]" },
  ];
  for (const s of shortcutSeed) {
    sqlite.run(
      `INSERT OR IGNORE INTO keyboard_shortcuts (id, action, label, "group", shortcut, default_shortcut) VALUES (?, ?, ?, ?, ?, ?)`,
      [s.id, s.action, s.label, s.group, s.shortcut ?? null, s.defaultShortcut ?? null]
    );
  }

  // Seed statuses if empty (6 statuses; Ready to Merge lives in workflow_statuses only)
  const existing = db.select().from(statuses).all();
  if (existing.length === 0) {
    const seed = [
      { id: randomUUID(), name: "To Do",          color: "#64748b", position: 0 },
      { id: randomUUID(), name: "In Progress",    color: "#3b82f6", position: 1 },
      { id: randomUUID(), name: "In Review",      color: "#a855f7", position: 2 },
      { id: randomUUID(), name: "Needs Revision", color: "#f59e0b", position: 3 },
      { id: randomUUID(), name: "Blocked",        color: "#ef4444", position: 4 },
      { id: randomUUID(), name: "Done",           color: "#22c55e", position: 5 },
      // Ready to Merge is seeded here so it exists globally but assigned to workflow_statuses for worktree workflow only
      { id: randomUUID(), name: "Ready to Merge", color: "#f97316", position: 6 },
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

  // Seed workflow_statuses for Default and Worktree workflows
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

  // Add Ready to Merge to worktree workflow only
  const readyStatus = statusByName["Ready to Merge"];
  if (readyStatus) {
    sqlite.run(
      `INSERT OR IGNORE INTO workflow_statuses (id, workflow_id, status_id, position, triggers_merge, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [`ws-worktree-${readyStatus.id}`, worktreeWorkflowId, readyStatus.id, defaultStatusNames.length, 1, now]
    );
  }

  // Migration: assign all existing epics without a workflow_id to the Default workflow
  sqlite.run(
    `UPDATE epics SET workflow_id = ? WHERE workflow_id IS NULL`,
    [defaultWorkflowId]
  );

  // Migration: create a "General" epic for parentless cards if any exist
  const parentlessCards = sqlite.query(`SELECT id FROM cards WHERE epic_id IS NULL`).all();
  if (parentlessCards.length > 0) {
    const generalEpicId = randomUUID();
    const generalStatusId = allStatuses[0]?.id;
    if (generalStatusId) {
      sqlite.run(
        `INSERT OR IGNORE INTO epics (id, title, description, status_id, workflow_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [generalEpicId, "General", "Auto-created for parentless cards", generalStatusId, defaultWorkflowId, now, now]
      );
      sqlite.run(
        `UPDATE cards SET epic_id = ? WHERE epic_id IS NULL`,
        [generalEpicId]
      );
      console.log(`[db] Migrated ${parentlessCards.length} parentless cards to General epic`);
    }
  }

  // Demo seed — only runs if the DB has no epics yet
  const epicCount = (sqlite.query(`SELECT COUNT(*) as n FROM epics`).get() as { n: number }).n;
  if (epicCount === 0) {
    const toDoId = statusByName["To Do"]?.id;
    const inProgressId = statusByName["In Progress"]?.id;
    const inReviewId = statusByName["In Review"]?.id;
    const blockedId = statusByName["Blocked"]?.id;
    const doneId = statusByName["Done"]?.id;
    if (!toDoId || !inProgressId || !doneId) {
      console.log("[db] Skipping demo seed — statuses not ready");
      return;
    }

    // Epic 1 — default workflow (API backend)
    const epic1Id = randomUUID();
    sqlite.run(
      `INSERT INTO epics (id, title, description, status_id, workflow_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [epic1Id, "API v2", "REST API redesign with improved auth and rate limiting", toDoId, defaultWorkflowId, now, now]
    );

    const f1aId = randomUUID();
    sqlite.run(
      `INSERT INTO features (id, epic_id, title, description, status_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [f1aId, epic1Id, "Authentication", "JWT-based auth with refresh token rotation", inProgressId, now, now]
    );

    const f1bId = randomUUID();
    sqlite.run(
      `INSERT INTO features (id, epic_id, title, description, status_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [f1bId, epic1Id, "Rate Limiting", "Per-client rate limits with Redis backing", toDoId, now, now]
    );

    const cards1 = [
      { featureId: f1aId, type: "task",  title: "Design JWT token schema",         statusId: doneId,       agentId: "agent-auth" },
      { featureId: f1aId, type: "task",  title: "Implement token issuance endpoint", statusId: inProgressId, agentId: "agent-auth" },
      { featureId: f1aId, type: "bug",   title: "Refresh token not invalidated on logout", statusId: inReviewId ?? inProgressId, agentId: "agent-auth" },
      { featureId: f1aId, type: "task",  title: "Add token rotation tests",         statusId: toDoId,       agentId: null },
      { featureId: f1bId, type: "story", title: "Define rate limit policy",         statusId: toDoId,       agentId: null },
      { featureId: f1bId, type: "task",  title: "Integrate Redis for limit counters", statusId: blockedId ?? toDoId, agentId: "agent-infra" },
    ];

    for (const c of cards1) {
      const cardId = randomUUID();
      sqlite.run(
        `INSERT INTO cards (id, epic_id, feature_id, type, title, status_id, agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cardId, epic1Id, c.featureId, c.type, c.title, c.statusId, c.agentId ?? null, now, now]
      );
    }

    // Epic 2 — worktree workflow (frontend)
    const epic2Id = randomUUID();
    sqlite.run(
      `INSERT INTO epics (id, title, description, status_id, workflow_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [epic2Id, "Dashboard v3", "Full redesign of the analytics dashboard", toDoId, worktreeWorkflowId, now, now]
    );

    const f2aId = randomUUID();
    sqlite.run(
      `INSERT INTO features (id, epic_id, title, description, status_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [f2aId, epic2Id, "Charts", "Replace legacy chart library with Recharts", inProgressId, now, now]
    );

    const f2bId = randomUUID();
    sqlite.run(
      `INSERT INTO features (id, epic_id, title, description, status_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [f2bId, epic2Id, "Filters", "Date range and metric filter bar", toDoId, now, now]
    );

    const cards2 = [
      { featureId: f2aId, type: "story", title: "Audit current chart components",  statusId: doneId,       agentId: "agent-frontend" },
      { featureId: f2aId, type: "task",  title: "Migrate line charts to Recharts", statusId: inProgressId, agentId: "agent-frontend" },
      { featureId: f2aId, type: "task",  title: "Migrate bar charts to Recharts",  statusId: toDoId,       agentId: null },
      { featureId: f2bId, type: "task",  title: "Build date range picker",         statusId: toDoId,       agentId: null },
      { featureId: f2bId, type: "task",  title: "Wire filter state to query params", statusId: toDoId,     agentId: null },
      { featureId: f2bId, type: "bug",   title: "Filter resets on page navigation", statusId: inReviewId ?? toDoId, agentId: "agent-frontend" },
    ];

    for (const c of cards2) {
      const cardId = randomUUID();
      sqlite.run(
        `INSERT INTO cards (id, epic_id, feature_id, type, title, status_id, agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cardId, epic2Id, c.featureId, c.type, c.title, c.statusId, c.agentId ?? null, now, now]
      );
    }

    console.log("[db] Seeded demo epics, features, and cards");
  }
}

export { sqlite };
