import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// statuses
// ---------------------------------------------------------------------------
export const statuses = sqliteTable("statuses", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(), // hex color string e.g. "#6366f1"
  position: integer("position").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// epics
// ---------------------------------------------------------------------------
export const epics = sqliteTable("epics", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  statusId: text("status_id").references(() => statuses.id),
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
  epicId: text("epic_id")
    .notNull()
    .references(() => epics.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  statusId: text("status_id").references(() => statuses.id),
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
  featureId: text("feature_id").references(() => features.id),
  epicId: text("epic_id").references(() => epics.id),
  type: text("type", { enum: ["story", "bug", "task"] })
    .notNull()
    .default("task"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  statusId: text("status_id")
    .notNull()
    .references(() => statuses.id),
  agentId: text("agent_id"),
  completedAt: text("completed_at"),
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
// transition_rules
// ---------------------------------------------------------------------------
export const transitionRules = sqliteTable("transition_rules", {
  id: text("id").primaryKey(),
  agentPattern: text("agent_pattern"), // null = applies to all agents; can use glob-like wildcard e.g. "implementer*"
  fromStatusId: text("from_status_id").references(() => statuses.id, { onDelete: "cascade" }), // null = from any status
  toStatusId: text("to_status_id").notNull().references(() => statuses.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export type TransitionRule = typeof transitionRules.$inferSelect;
export type InsertTransitionRule = typeof transitionRules.$inferInsert;

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type Status = typeof statuses.$inferSelect;
export type InsertStatus = typeof statuses.$inferInsert;

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
