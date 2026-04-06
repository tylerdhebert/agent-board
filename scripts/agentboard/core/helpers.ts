import { CliError } from "./errors";
import type { Card } from "./types";

export function print(value: unknown) {
  if (value === undefined) return;
  if (typeof value === "string") {
    console.log(value);
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

export function toQueryString(values: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function normalizeString(value: string) {
  return value.trim().toLowerCase();
}

export function findByNormalizedName<T>(
  items: T[],
  input: string,
  selectors: Array<(item: T) => string | null | undefined>
) {
  const needle = normalizeString(input);
  return items.find((item) =>
    selectors.some((selector) => {
      const raw = selector(item);
      return raw ? normalizeString(raw) === needle : false;
    })
  );
}

export function sanitizeBranchSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^-+|-+$/g, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/(^|\/)-+/g, "$1")
    .replace(/-+(\/|$)/g, "$1");
}

export function shortCardId(cardId: string) {
  return cardId.split("-")[0] ?? cardId;
}

export function buildGeneratedBranchName(agentId: string | null, card: Card) {
  const agentSegment = sanitizeBranchSegment(agentId ?? card.agentId ?? "agent").replace(/\//g, "-") || "agent";
  const titleSegment = sanitizeBranchSegment(card.title).replace(/\//g, "-").slice(0, 40) || "task";
  return `wt/${agentSegment}/${shortCardId(card.id)}-${titleSegment}`;
}

export function exactMatch<T>(
  items: T[],
  input: string,
  label: string,
  selectors: Array<(item: T) => string | null | undefined>
): T {
  const needle = normalizeString(input);
  const matches = items.filter((item) =>
    selectors.some((selector) => {
      const raw = selector(item);
      return raw ? normalizeString(raw) === needle : false;
    })
  );

  if (matches.length === 1) return matches[0];

  if (matches.length > 1) {
    throw new CliError(`Ambiguous ${label} "${input}". Use the id instead.`);
  }

  throw new CliError(`Unknown ${label} "${input}"`);
}
