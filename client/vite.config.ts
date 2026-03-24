import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

/**
 * Custom Vite plugin that stubs out bun-native imports so the server type
 * file can be resolved for Eden treaty types without executing Bun modules.
 */
function bunStubPlugin() {
  // Stub out bun-native modules and drizzle's bun adapter so Vite can resolve
  // the server index.ts for types only (Eden treaty) without executing Bun code.
  const stubPatterns = [
    "bun:sqlite",
    "bun:ffi",
    "bun:jsc",
    "bun:test",
    "bun:wrap",
    "drizzle-orm/bun-sqlite",
    "crypto", // node built-in — stub for browser context
  ];

  return {
    name: "bun-stub",
    enforce: "pre" as const,
    resolveId(id: string) {
      if (stubPatterns.some((p) => id === p || id.startsWith(p + "/"))) {
        return "\0bun-stub:" + id;
      }
    },
    load(id: string) {
      if (id.startsWith("\0bun-stub:")) {
        return [
          "export default {};",
          "export const Database = class {};",
          "export const drizzle = () => ({});",
          "export function randomUUID() { return crypto.randomUUID(); }",
        ].join("\n");
      }
    },
  };
}

export default defineConfig({
  plugins: [bunStubPlugin(), react(), tailwindcss()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@server": resolve(__dirname, "../server/src/index.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["bun:sqlite"],
  },
});
