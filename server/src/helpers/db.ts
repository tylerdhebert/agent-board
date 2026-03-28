import { db } from "../db";
import { wsManager, WsEvent } from "../wsManager";
import { eq } from "drizzle-orm";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";

/**
 * Returns the current time as an ISO 8601 string.
 * Use instead of repeating `new Date().toISOString()` inline.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Performs the standard update-then-refetch-then-broadcast triple that
 * appears across many PATCH handlers.
 *
 * @param table   - Drizzle table reference (e.g. `epics`, `features`)
 * @param id      - Primary key value of the row to update
 * @param patch   - Object of column values to set (updatedAt is merged in automatically)
 * @param event   - WebSocket event name to broadcast after the update
 * @returns The re-fetched updated row, or throws if the row no longer exists.
 */
export function updateAndBroadcast<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TTable extends SQLiteTableWithColumns<any>,
>(
  table: TTable,
  id: string,
  patch: Record<string, unknown>,
  event: WsEvent
): TTable["$inferSelect"] {
  const now = nowIso();

  // Merge updatedAt if the table has that column
  const hasUpdatedAt = "updatedAt" in table;
  const fullPatch = hasUpdatedAt ? { ...patch, updatedAt: now } : patch;

  db.update(table).set(fullPatch).where(eq(table.id, id)).run();

  const updated = db.select().from(table).where(eq(table.id, id)).get();
  if (!updated) throw new Error("Not found");

  wsManager.broadcast(event, updated);
  return updated;
}
