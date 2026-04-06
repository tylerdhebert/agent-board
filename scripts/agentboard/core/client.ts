import { ApiError } from "./errors";

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  let pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname || pathname === "") pathname = "/api";
  if (pathname === "/") pathname = "/api";
  url.pathname = pathname;
  return url.toString().replace(/\/$/, "");
}

function normalizeRequestPath(value: string): string {
  if (!value) return "/";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  let next = value.startsWith("/") ? value : `/${value}`;
  if (next.startsWith("/api/")) next = next.slice(4);
  else if (next === "/api") next = "/";
  return next;
}

function parseResponseText(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class AgentBoardClient {
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  async request<T = unknown>(method: string, requestPath: string, body?: unknown): Promise<T> {
    const normalizedPath = normalizeRequestPath(requestPath);
    const url = new URL(
      normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")
        ? normalizedPath
        : `${this.baseUrl}${normalizedPath}`
    );
    const response = await fetch(url.toString(), {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const payload = parseResponseText(text);

    if (!response.ok) {
      throw new ApiError(method, url.pathname + url.search, response.status, payload);
    }

    return payload as T;
  }
}
