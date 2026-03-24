import { treaty } from "@elysiajs/eden";
import type { App } from "@server";

// Eden treaty client — fully typed from the server's App type
export const api = treaty<App>("localhost:31377");

// Raw base URL for cases where Eden doesn't cover (e.g. long-poll POSTs)
export const API_BASE = "http://localhost:31377/api";
export const WS_URL = "ws://localhost:31377/ws";
