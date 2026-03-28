import Elysia, { t } from "elysia";
import { readdirSync } from "fs";
import { resolve, sep } from "path";
import { homedir } from "os";

export const fsRoutes = new Elysia({ prefix: "/fs" })
  .get(
    "/browse",
    ({ query, set }) => {
      try {
        const raw = query.path || homedir();
        // Expand ~ to home dir
        const expanded = raw.startsWith("~") ? homedir() + raw.slice(1) : raw;
        const dir = resolve(expanded);

        const entries = readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.isDirectory() && !e.name.startsWith("."))
          .map((e) => e.name)
          .sort((a, b) => a.localeCompare(b));

        return { path: dir, sep, entries };
      } catch {
        set.status = 400;
        return { error: "Cannot read directory" };
      }
    },
    { query: t.Object({ path: t.Optional(t.String()) }) }
  );
