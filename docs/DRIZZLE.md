# Drizzle ORM

Drizzle is a TypeScript ORM for SQL databases. It lets you write database queries in TypeScript with full type safety, without hiding the SQL from you.

## How the schema works

Tables are defined in code using Drizzle's table builders. This definition is the source of truth for both TypeScript types and the database structure:

```ts
export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  statusId: text("status_id").notNull().references(() => statuses.id),
  completedAt: text("completed_at"), // nullable
});

// TypeScript types are inferred automatically
export type Card = typeof cards.$inferSelect;
export type InsertCard = typeof cards.$inferInsert;
```

## Querying

Drizzle queries read like SQL, but are fully typed:

```ts
// SELECT * FROM cards WHERE id = ?
const card = db.select().from(cards).where(eq(cards.id, id)).get();

// INSERT
db.insert(cards).values({ id, title, statusId }).run();

// UPDATE
db.update(cards).set({ statusId: newId }).where(eq(cards.id, id)).run();

// DELETE
db.delete(cards).where(eq(cards.id, id)).run();
```

`.get()` returns one row or undefined. `.all()` returns an array. `.run()` executes without returning rows (for inserts/updates/deletes).

## Migrations

This project uses manual migrations — raw SQL run at startup inside try/catch blocks in `server/src/db/index.ts`. New columns are added with `ALTER TABLE ... ADD COLUMN` wrapped in a try/catch so they're safe to run repeatedly:

```ts
try {
  sqlite.run(`ALTER TABLE cards ADD COLUMN completed_at TEXT`);
} catch {
  // Column already exists — no-op
}
```

This is intentionally simple. No migration files, no migration runner — just idempotent SQL on boot.

## Why Drizzle over Prisma

Prisma generates a separate runtime client and uses its own query language. Drizzle compiles away to plain SQL with no runtime overhead, and it works directly with `bun:sqlite` without needing a separate database server process or binary.
