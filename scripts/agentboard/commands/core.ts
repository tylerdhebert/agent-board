import { boolValue, parseFlags, parseJson, readJsonFile } from "../core/args";
import { CONTEXT_FILE, clearStoredContext, getStoredContext, updateStoredContext } from "../core/context";
import { CliError } from "../core/errors";
import { resolveAgentId } from "../core/resolvers";
import { coreHelp } from "../help";
import type { CommandState, StoredContextRecord } from "../core/types";

export async function handleHealth(state: CommandState) {
  return state.client.request("GET", "/health");
}

export async function handleRaw(state: CommandState, args: string[]) {
  if (args.includes("--help") || args.includes("-h") || args[0] === "help") {
    return coreHelp("raw");
  }

  const [method, requestPath, ...rest] = args;
  if (!method || !requestPath) {
    return coreHelp("raw");
  }

  const parsed = parseFlags(rest, {
    bodyJson: { type: "string" },
    bodyFile: { type: "string" },
  });

  let body: unknown;
  if (parsed.values.bodyJson && parsed.values.bodyFile) {
    throw new CliError("Use either --body-json or --body-file, not both.");
  }
  if (typeof parsed.values.bodyJson === "string") {
    body = parseJson<unknown>(parsed.values.bodyJson);
  }
  if (typeof parsed.values.bodyFile === "string") {
    body = readJsonFile<unknown>(parsed.values.bodyFile);
  }

  return state.client.request(method.toUpperCase(), requestPath, body);
}

export async function handleContext(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return coreHelp("context");
  }

  if (action === "show") {
    return {
      cwd: process.cwd(),
      stored: state.storedContext,
      effective: {
        url: state.client.baseUrl,
        agentId: resolveAgentId(state, undefined, false),
        cardId:
          (state.global.card as string | undefined)
          ?? process.env.AGENT_BOARD_CARD_ID
          ?? state.storedContext?.cardId
          ?? null,
      },
      contextFile: CONTEXT_FILE,
    };
  }

  if (action === "set") {
    const parsed = parseFlags(rest, {
      url: { type: "string" },
      agent: { type: "string" },
      card: { type: "string" },
    });
    if (!parsed.values.url && !parsed.values.agent && !parsed.values.card) {
      throw new CliError("context set requires at least one of --url, --agent, or --card");
    }
    updateStoredContext(
      state.cwdKey,
      {
        url: parsed.values.url as string | undefined,
        agentId: parsed.values.agent as string | undefined,
        cardId: parsed.values.card as string | undefined,
      },
      !state.global.noContext
    );
    return { ok: true, stored: getStoredContext(state.cwdKey, !state.global.noContext) };
  }

  if (action === "clear") {
    const parsed = parseFlags(rest, {
      url: { type: "boolean" },
      agent: { type: "boolean" },
      card: { type: "boolean" },
      all: { type: "boolean" },
    });
    if (boolValue(parsed.values, "all") || (!parsed.values.url && !parsed.values.agent && !parsed.values.card)) {
      clearStoredContext(state.cwdKey, null, !state.global.noContext);
    } else {
      const keys: Array<keyof StoredContextRecord> = [];
      if (boolValue(parsed.values, "url")) keys.push("url");
      if (boolValue(parsed.values, "agent")) keys.push("agentId");
      if (boolValue(parsed.values, "card")) keys.push("cardId");
      clearStoredContext(state.cwdKey, keys, !state.global.noContext);
    }
    return { ok: true, stored: getStoredContext(state.cwdKey, !state.global.noContext) };
  }

  throw new CliError(`Unknown context command "${action}". Run "agentboard context help" for usage.`);
}
