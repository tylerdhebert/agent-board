import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import type { StoredContextFile, StoredContextRecord } from "./types";

export const CONTEXT_FILE = path.join(homedir(), ".agentboard", "context.json");

function nowIso(): string {
  return new Date().toISOString();
}

export function cwdKey(): string {
  const resolved = path.resolve(process.cwd());
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function ensureContextDir() {
  mkdirSync(path.dirname(CONTEXT_FILE), { recursive: true });
}

function readContextFile(): StoredContextFile {
  if (!existsSync(CONTEXT_FILE)) {
    return { version: 1, contexts: {} };
  }

  try {
    const parsed = JSON.parse(readFileSync(CONTEXT_FILE, "utf8")) as StoredContextFile;
    if (parsed.version === 1 && typeof parsed.contexts === "object") {
      return parsed;
    }
  } catch {
    // Fall through to reset the store.
  }

  return { version: 1, contexts: {} };
}

function writeContextFile(next: StoredContextFile) {
  ensureContextDir();
  writeFileSync(CONTEXT_FILE, JSON.stringify(next, null, 2));
}

export function getStoredContext(currentKey: string, useContext: boolean): StoredContextRecord | null {
  if (!useContext) return null;
  const file = readContextFile();
  return file.contexts[currentKey] ?? null;
}

export function updateStoredContext(
  currentKey: string,
  patch: Partial<StoredContextRecord>,
  useContext: boolean
) {
  if (!useContext) return;
  const file = readContextFile();
  const previous = file.contexts[currentKey] ?? { updatedAt: nowIso() };
  const next: StoredContextRecord = {
    ...previous,
    ...patch,
    updatedAt: nowIso(),
  };
  file.contexts[currentKey] = next;
  writeContextFile(file);
}

export function clearStoredContext(
  currentKey: string,
  keys: Array<keyof StoredContextRecord> | null,
  useContext: boolean
) {
  if (!useContext) return;
  const file = readContextFile();
  if (!file.contexts[currentKey]) return;

  if (keys === null) {
    delete file.contexts[currentKey];
  } else {
    const next = { ...file.contexts[currentKey] };
    for (const key of keys) {
      delete next[key];
    }
    if (Object.keys(next).filter((key) => key !== "updatedAt").length === 0) {
      delete file.contexts[currentKey];
    } else {
      next.updatedAt = nowIso();
      file.contexts[currentKey] = next;
    }
  }

  writeContextFile(file);
}
