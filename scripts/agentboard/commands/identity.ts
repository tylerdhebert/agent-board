import { parseFlags, requireString } from "../core/args";
import { CliError } from "../core/errors";
import { loadCards, resolveCardRecord } from "../core/resolvers";
import { identityHelp } from "../help";
import type { CommandState } from "../core/types";

function slugifySegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "task";
}

async function loadKnownAgentIds(state: CommandState) {
  const known = new Set<string>();
  const [cards, conversations] = await Promise.all([
    loadCards(state),
    state.client.request<Array<Record<string, unknown>>>("GET", "/queue/conversations"),
  ]);

  for (const card of cards) {
    if (card.agentId) known.add(card.agentId);
  }

  for (const conversation of conversations) {
    const agentId = conversation.agentId;
    if (typeof agentId === "string" && agentId.trim()) known.add(agentId.trim());
  }

  return known;
}

export async function handleId(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return identityHelp();
  }

  if (action !== "suggest") {
    throw new CliError(`Unknown id command "${action}". Run "agentboard id help" for usage.`);
  }

  const parsed = parseFlags(rest, {
    role: { type: "string" },
    card: { type: "string" },
    task: { type: "string" },
    request: { type: "string" },
    control: { type: "boolean" },
  });

  const role = slugifySegment(requireString(parsed.values, "role"));
  const cardInput = parsed.values.card as string | undefined;
  const taskInput = parsed.values.task as string | undefined;
  const requestInput = parsed.values.request as string | undefined;
  const controlMode = parsed.values.control === true;

  if ((cardInput ? 1 : 0) + (taskInput ? 1 : 0) + (controlMode ? 1 : 0) !== 1) {
    throw new CliError('id suggest requires exactly one of --card "<card>", --task "<task description>", or --control.');
  }
  if (requestInput && !controlMode) {
    throw new CliError('Use --request only with --control.');
  }

  if (cardInput) {
    const card = await resolveCardRecord(state, cardInput);
    const ref = card.ref || `card-${card.refNum}`;
    return {
      __render: "action",
      data: { message: `${role}-${ref}` },
    };
  }

  const knownIds = await loadKnownAgentIds(state);

  if (controlMode) {
    const requestSlug = slugifySegment(requireString(parsed.values, "request"));
    const prefix = `${role}-${requestSlug}-`;
    let next = 1;
    for (const id of knownIds) {
      if (!id.startsWith(prefix)) continue;
      const suffix = id.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) continue;
      next = Math.max(next, Number(suffix) + 1);
    }

    let candidate = `${prefix}${next}`;
    while (knownIds.has(candidate)) {
      next += 1;
      candidate = `${prefix}${next}`;
    }

    return {
      __render: "action",
      data: { message: candidate },
    };
  }

  const taskSlug = slugifySegment(taskInput!);
  const prefix = `${role}-${taskSlug}-`;
  let next = 1;
  for (const id of knownIds) {
    if (!id.startsWith(prefix)) continue;
    const suffix = id.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    next = Math.max(next, Number(suffix) + 1);
  }

  let candidate = `${prefix}${next}`;
  while (knownIds.has(candidate)) {
    next += 1;
    candidate = `${prefix}${next}`;
  }

  return {
    __render: "action",
    data: { message: candidate },
  };
}
