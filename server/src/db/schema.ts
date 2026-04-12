import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// statuses
// ---------------------------------------------------------------------------
export const statuses = sqliteTable("statuses", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(), // hex color string e.g. "#6366f1"
  position: integer("position").notNull().default(0),
  isCore: integer("is_core", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// workflows
// ---------------------------------------------------------------------------
export const workflowTypes = ["default", "worktree"] as const;
export type WorkflowType = (typeof workflowTypes)[number];

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: workflowTypes }).notNull().default("default"),
  createdAt: text("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// workflow_statuses
// ---------------------------------------------------------------------------
export const workflowStatuses = sqliteTable("workflow_statuses", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  statusId: text("status_id").notNull().references(() => statuses.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  triggersMerge: integer("triggers_merge", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// repos
// ---------------------------------------------------------------------------
export const repos = sqliteTable("repos", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  baseBranch: text("base_branch").notNull().default("main"),
  buildCommand: text("build_command"), // nullable - if null, build not configured
  createdAt: text("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// epics
// ---------------------------------------------------------------------------
export const epics = sqliteTable("epics", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  statusId: text("status_id").references(() => statuses.id),
  workflowId: text("workflow_id").references(() => workflows.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// features
// ---------------------------------------------------------------------------
export const features = sqliteTable("features", {
  id: text("id").primaryKey(),
  refNum: integer("ref_num").notNull(),
  epicId: text("epic_id")
    .notNull()
    .references(() => epics.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  statusId: text("status_id").references(() => statuses.id),
  repoId: text("repo_id").references(() => repos.id),
  branchName: text("branch_name"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// cards
// ---------------------------------------------------------------------------
export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  refNum: integer("ref_num").notNull(),
  featureId: text("feature_id").notNull().references(() => features.id, { onDelete: "cascade" }),
  epicId: text("epic_id").references(() => epics.id),
  repoId: text("repo_id").references(() => repos.id),
  type: text("type", { enum: ["story", "bug", "task"] })
    .notNull()
    .default("task"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  statusId: text("status_id")
    .notNull()
    .references(() => statuses.id),
  agentId: text("agent_id"),
  plan: text("plan"),
  latestUpdate: text("latest_update"),
  handoffSummary: text("handoff_summary"),
  blockedReason: text("blocked_reason"),
  branchName: text("branch_name"),
  completedAt: text("completed_at"),
  conflictedAt: text("conflicted_at"),
  conflictDetails: text("conflict_details"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  author: text("author", { enum: ["agent", "user"] })
    .notNull()
    .default("user"),
  agentId: text("agent_id"),
  body: text("body").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// input_requests
// ---------------------------------------------------------------------------
export const inputRequests = sqliteTable("input_requests", {
  id: text("id").primaryKey(),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  agentId: text("agent_id"),
  previousStatusId: text("previous_status_id"),
  questions: text("questions").notNull(), // JSON string
  answers: text("answers"), // JSON string, null until answered
  status: text("status", {
    enum: ["pending", "answered", "timed_out"],
  })
    .notNull()
    .default("pending"),
  requestedAt: text("requested_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  answeredAt: text("answered_at"),
  timeoutSecs: integer("timeout_secs").notNull().default(900),
});

// ---------------------------------------------------------------------------
// queue_messages
// ---------------------------------------------------------------------------
export const queueMessages = sqliteTable("queue_messages", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["pending", "read"] }).notNull().default("pending"),
  author: text("author").notNull().default("user"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  readAt: text("read_at"),
});

export type QueueMessage = typeof queueMessages.$inferSelect;
export type InsertQueueMessage = typeof queueMessages.$inferInsert;

// ---------------------------------------------------------------------------
// keyboard_shortcuts
// ---------------------------------------------------------------------------
export const keyboardShortcuts = sqliteTable("keyboard_shortcuts", {
  id: text("id").primaryKey(), // same as action id
  action: text("action").notNull().unique(),
  label: text("label").notNull(),
  group: text("group").notNull(),
  shortcut: text("shortcut"), // null = disabled
  defaultShortcut: text("default_shortcut"),
});

export type KeyboardShortcut = typeof keyboardShortcuts.$inferSelect;

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type Status = typeof statuses.$inferSelect;
export type InsertStatus = typeof statuses.$inferInsert;

export type Repo = typeof repos.$inferSelect;
export type InsertRepo = typeof repos.$inferInsert;

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = typeof workflows.$inferInsert;

export type WorkflowStatus = typeof workflowStatuses.$inferSelect;
export type InsertWorkflowStatus = typeof workflowStatuses.$inferInsert;

export type Epic = typeof epics.$inferSelect;
export type InsertEpic = typeof epics.$inferInsert;

export type Feature = typeof features.$inferSelect;
export type InsertFeature = typeof features.$inferInsert;

export type Card = typeof cards.$inferSelect;
export type InsertCard = typeof cards.$inferInsert;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

export type InputRequest = typeof inputRequests.$inferSelect;
export type InsertInputRequest = typeof inputRequests.$inferInsert;

// ---------------------------------------------------------------------------
// card_dependencies
// ---------------------------------------------------------------------------
export const cardDependencies = sqliteTable("card_dependencies", {
  id: text("id").primaryKey(),
  blockerCardId: text("blocker_card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  blockedCardId: text("blocked_card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export type CardDependency = typeof cardDependencies.$inferSelect;

// ---------------------------------------------------------------------------
// build_results
// ---------------------------------------------------------------------------
export const buildResults = sqliteTable("build_results", {
  id: text("id").primaryKey(),
  featureId: text("feature_id").notNull().references(() => features.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["running", "passed", "failed"] }).notNull().default("running"),
  output: text("output"),
  triggeredAt: text("triggered_at").notNull(),
  completedAt: text("completed_at"),
});

export type BuildResult = typeof buildResults.$inferSelect;
