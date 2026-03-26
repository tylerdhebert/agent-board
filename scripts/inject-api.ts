#!/usr/bin/env bun
/// <reference types="bun-types" />
/**
 * inject-api.ts
 *
 * Interpolates AGENT_API.md into agent files that contain the placeholder:
 *   <agent-board-api></agent-board-api>
 *
 * Usage:
 *   bun scripts/inject-api.ts <file-or-dir>
 *
 * If given a directory, processes all *.agent.md files in it.
 * Runs are idempotent — re-running updates existing injected content.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname } from "path";

const PLACEHOLDER = /<agent-board-api>[\s\S]*?<\/agent-board-api>/;
const OPEN_TAG = "<agent-board-api>";
const CLOSE_TAG = "</agent-board-api>";

const apiMdPath = join(dirname(import.meta.path), "..", "AGENT_API.md");
const apiContent = readFileSync(apiMdPath, "utf8").trimEnd();

function processFile(filePath: string) {
  const src = readFileSync(filePath, "utf8");

  if (!src.includes(OPEN_TAG)) {
    console.log(`skip   ${filePath} (no placeholder)`);
    return;
  }

  const injected = `${OPEN_TAG}\n${apiContent}\n${CLOSE_TAG}`;
  const result = src.replace(PLACEHOLDER, injected);

  if (result === src) {
    console.log(`skip   ${filePath} (already up to date)`);
    return;
  }

  writeFileSync(filePath, result, "utf8");
  console.log(`inject ${filePath}`);
}

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: bun scripts/inject-api.ts <file-or-dir>");
  process.exit(1);
}

const target = resolve(arg);
const stat = statSync(target);

if (stat.isDirectory()) {
  const files = readdirSync(target).filter((f) => f.endsWith(".agent.md"));
  if (files.length === 0) {
    console.log(`No *.agent.md files found in ${target}`);
  } else {
    for (const f of files) processFile(join(target, f));
  }
} else {
  processFile(target);
}
