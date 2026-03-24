import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { initDb } from "./db";
import { wsManager } from "./wsManager";
import { statusRoutes } from "./routes/statuses";
import { epicRoutes } from "./routes/epics";
import { featureRoutes } from "./routes/features";
import { cardRoutes } from "./routes/cards";
import { inputRoutes } from "./routes/input";
import { transitionRuleRoutes } from "./routes/transitionRules";

// Bootstrap database on startup
initDb();

const app = new Elysia()
  .use(
    cors({
      origin: "http://localhost:5173",
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "agent-board API",
          version: "1.0.0",
          description: "API for monitoring and interacting with AI agent tasks",
        },
      },
      path: "/docs",
    })
  )
  // WebSocket endpoint
  .ws("/ws", {
    open(ws) {
      wsManager.add(ws);
      console.log(
        `[ws] Client connected. Total clients: ${wsManager.size}`
      );
    },
    close(ws) {
      wsManager.remove(ws);
      console.log(
        `[ws] Client disconnected. Total clients: ${wsManager.size}`
      );
    },
    message(ws, message) {
      // Clients can send pings; ignore other messages
      if (message === "ping") {
        ws.send("pong");
      }
    },
  })
  // REST API
  .group("/api", (app) =>
    app
      .use(statusRoutes)
      .use(epicRoutes)
      .use(featureRoutes)
      .use(cardRoutes)
      .use(inputRoutes)
      .use(transitionRuleRoutes)
  )
  .listen(31377);

console.log(
  `[server] agent-board API running at http://localhost:${app.server?.port}`
);
console.log(`[server] Swagger docs at http://localhost:31377/docs`);
console.log(`[server] WebSocket at ws://localhost:31377/ws`);

// Export the app type for Eden treaty on the client
export type App = typeof app;
