import { parseFlags, parseJson, readJsonFile } from "../core/args";
import { CliError } from "../core/errors";
import { coreHelp } from "../help";
import type { CommandState } from "../core/types";

function parseQueryFlags(entries: string[] | undefined) {
  const params = new URLSearchParams();
  for (const entry of entries ?? []) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      throw new CliError(`Invalid --query "${entry}". Use key=value.`);
    }
    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!key) {
      throw new CliError(`Invalid --query "${entry}". Use key=value.`);
    }
    params.append(key, value);
  }
  return params;
}

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
    query: { type: "string[]" },
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

  const queryParams = parseQueryFlags(parsed.values.query as string[] | undefined);
  const queryString = queryParams.toString();
  const resolvedPath =
    queryString.length > 0
      ? `${requestPath}${requestPath.includes("?") ? "&" : "?"}${queryString}`
      : requestPath;

  return state.client.request(method.toUpperCase(), resolvedPath, body);
}
