import { app } from "./app";

try {
  app.listen(31377);
} catch (err: any) {
  if (err?.code === "EADDRINUSE") {
    console.error("[server] ERROR: Port 31377 is already in use.");
    console.error("[server] Another process (possibly a stale server) is holding the port.");
    console.error("[server] Find and kill it: netstat -ano | findstr :31377  (Windows)");
    console.error("[server]                   lsof -i :31377 | grep LISTEN   (Mac/Linux)");
    process.exit(1);
  }
  throw err;
}

console.log(`[server] agent-board API running at http://localhost:${app.server?.port}`);
console.log(`[server] Swagger docs at http://localhost:31377/docs`);
console.log(`[server] WebSocket at ws://localhost:31377/ws`);
