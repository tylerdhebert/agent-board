import Elysia, { t } from "elysia";
import { db } from "../db";
import { keyboardShortcuts } from "../db/schema";
import { eq } from "drizzle-orm";

export const shortcutRoutes = new Elysia({ prefix: "/shortcuts" })
  .get("/", () => db.select().from(keyboardShortcuts).all())
  .patch(
    "/:id",
    ({ params, body }) => {
      const updated = db
        .update(keyboardShortcuts)
        .set({ shortcut: body.shortcut })
        .where(eq(keyboardShortcuts.id, params.id))
        .returning()
        .get();
      return updated;
    },
    { body: t.Object({ shortcut: t.Nullable(t.String()) }) }
  )
  .post("/reset", () => {
    const all = db.select().from(keyboardShortcuts).all();
    for (const s of all) {
      db.update(keyboardShortcuts)
        .set({ shortcut: s.defaultShortcut })
        .where(eq(keyboardShortcuts.id, s.id))
        .run();
    }
    return db.select().from(keyboardShortcuts).all();
  });
