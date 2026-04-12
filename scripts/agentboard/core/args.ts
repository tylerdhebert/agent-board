import { readFileSync } from "node:fs";
import path from "node:path";

import { CliError } from "./errors";
import type { OptionSpec, ParsedArgs } from "./types";

export function parseBooleanString(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  throw new CliError(`Expected a boolean value but received "${value}"`);
}

function toCamelOptionName(value: string) {
  return value.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

function resolveOptionName(rawName: string, spec: Record<string, OptionSpec>) {
  if (spec[rawName]) return rawName;
  const camelName = toCamelOptionName(rawName);
  if (spec[camelName]) return camelName;
  return null;
}

export function parseFlags(args: string[], spec: Record<string, OptionSpec>): ParsedArgs {
  const aliasMap = new Map<string, string>();
  for (const [name, definition] of Object.entries(spec)) {
    for (const alias of definition.alias ?? []) {
      aliasMap.set(alias, name);
    }
  }

  const values: Record<string, unknown> = {};
  const positionals: string[] = [];

  const setValue = (name: string, rawValue: string | boolean) => {
    const definition = spec[name];
    if (!definition) throw new CliError(`Unknown option "${name}"`);

    if (definition.type === "boolean") {
      values[name] =
        typeof rawValue === "boolean" ? rawValue : parseBooleanString(rawValue);
      return;
    }

    if (typeof rawValue === "boolean") {
      throw new CliError(`Option "--${name}" requires a value`);
    }

    if (definition.type === "string") {
      values[name] = rawValue;
      return;
    }

    if (definition.type === "number") {
      const parsed = Number(rawValue);
      if (Number.isNaN(parsed)) {
        throw new CliError(`Option "--${name}" requires a number`);
      }
      values[name] = parsed;
      return;
    }

    if (definition.type === "string[]") {
      const current = (values[name] as string[] | undefined) ?? [];
      current.push(rawValue);
      values[name] = current;
    }
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--") {
      positionals.push(...args.slice(i + 1));
      break;
    }

    if (arg.startsWith("--no-")) {
      const name = resolveOptionName(arg.slice(5), spec);
      if (!name || spec[name].type !== "boolean") {
        throw new CliError(`Unknown boolean option "${arg}"`);
      }
      values[name] = false;
      continue;
    }

    if (arg.startsWith("--")) {
      const withoutPrefix = arg.slice(2);
      const eqIndex = withoutPrefix.indexOf("=");
      const rawName = eqIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, eqIndex);
      const name = resolveOptionName(rawName, spec);
      if (!name) throw new CliError(`Unknown option "--${rawName}"`);
      const definition = spec[name];

      if (definition.type === "boolean") {
        const inlineValue = eqIndex === -1 ? true : withoutPrefix.slice(eqIndex + 1);
        setValue(name, inlineValue);
        continue;
      }

      const inlineValue = eqIndex === -1 ? undefined : withoutPrefix.slice(eqIndex + 1);
      const rawValue = inlineValue ?? args[i + 1];
      if (rawValue === undefined) {
        throw new CliError(`Option "--${name}" requires a value`);
      }
      if (inlineValue === undefined) i += 1;
      setValue(name, rawValue);
      continue;
    }

    if (arg.startsWith("-") && arg !== "-") {
      const alias = arg.slice(1);
      const name = aliasMap.get(alias);
      if (!name) throw new CliError(`Unknown option "${arg}"`);
      const definition = spec[name];
      if (definition.type === "boolean") {
        setValue(name, true);
        continue;
      }
      const rawValue = args[i + 1];
      if (rawValue === undefined) {
        throw new CliError(`Option "${arg}" requires a value`);
      }
      i += 1;
      setValue(name, rawValue);
      continue;
    }

    positionals.push(arg);
  }

  for (const [name, definition] of Object.entries(spec)) {
    if (!(name in values) && definition.default !== undefined) {
      values[name] = definition.default;
    }
  }

  return { values, positionals };
}

export function extractLeadingGlobalArgs(args: string[]): { globalArgs: string[]; remaining: string[] } {
  const spec: Record<string, OptionSpec> = {
    url: { type: "string" },
    json: { type: "boolean" },
    help: { type: "boolean", alias: ["h"] },
  };

  const aliasMap = new Map<string, string>();
  for (const [name, definition] of Object.entries(spec)) {
    for (const alias of definition.alias ?? []) aliasMap.set(alias, name);
  }

  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (!arg.startsWith("-")) break;
    if (arg === "--") {
      index += 1;
      break;
    }

    const token = arg.startsWith("--no-")
      ? resolveOptionName(arg.slice(5), spec)
      : arg.startsWith("--")
        ? resolveOptionName(arg.slice(2).split("=")[0], spec)
        : aliasMap.get(arg.slice(1));
    if (!token || !spec[token]) break;

    const definition = spec[token];
    index += 1;
    if (definition.type !== "boolean" && !arg.includes("=")) {
      if (index >= args.length) {
        throw new CliError(`Option "${arg}" requires a value`);
      }
      index += 1;
    }
  }

  return { globalArgs: args.slice(0, index), remaining: args.slice(index) };
}

export function extractGlobalArgsAnywhere(
  args: string[],
  spec: Record<string, OptionSpec>
): { globalArgs: string[]; remaining: string[] } {
  const aliasMap = new Map<string, string>();
  for (const [name, definition] of Object.entries(spec)) {
    for (const alias of definition.alias ?? []) aliasMap.set(alias, name);
  }

  const globalArgs: string[] = [];
  const remaining: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") {
      remaining.push(...args.slice(i));
      break;
    }

    if (arg.startsWith("--no-")) {
      const name = resolveOptionName(arg.slice(5), spec);
      if (!name || spec[name].type !== "boolean") {
        remaining.push(arg);
        continue;
      }
      globalArgs.push(arg);
      continue;
    }

    if (arg.startsWith("--")) {
      const withoutPrefix = arg.slice(2);
      const eqIndex = withoutPrefix.indexOf("=");
      const rawName = eqIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, eqIndex);
      const name = resolveOptionName(rawName, spec);
      if (!name) {
        remaining.push(arg);
        continue;
      }
      const definition = spec[name];
      if (definition.type === "boolean") {
        globalArgs.push(arg);
        continue;
      }
      if (eqIndex !== -1) {
        globalArgs.push(arg);
        continue;
      }
      const next = args[i + 1];
      if (next === undefined) {
        throw new CliError(`Option "--${name}" requires a value`);
      }
      globalArgs.push(arg, next);
      i += 1;
      continue;
    }

    if (arg.startsWith("-") && arg !== "-") {
      const name = aliasMap.get(arg.slice(1));
      if (!name) {
        remaining.push(arg);
        continue;
      }
      const definition = spec[name];
      if (definition.type === "boolean") {
        globalArgs.push(arg);
        continue;
      }
      const next = args[i + 1];
      if (next === undefined) {
        throw new CliError(`Option "${arg}" requires a value`);
      }
      globalArgs.push(arg, next);
      i += 1;
      continue;
    }

    remaining.push(arg);
  }

  return { globalArgs, remaining };
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(path.resolve(filePath), "utf8")) as T;
}

export function parseJson<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new CliError(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function requireString(values: Record<string, unknown>, key: string) {
  const value = values[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new CliError(`Missing required option "--${key}"`);
  }
  return value.trim();
}

export function boolValue(values: Record<string, unknown>, key: string) {
  return values[key] === true;
}
