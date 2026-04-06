import { extractLeadingGlobalArgs, parseFlags } from "./core/args";
import { AgentBoardClient } from "./core/client";
import { DEFAULT_BASE_URL } from "./core/constants";
import { cwdKey, getStoredContext } from "./core/context";
import { ApiError, CliError } from "./core/errors";
import { print } from "./core/helpers";
import { runCommand } from "./run";
import type { CommandState, GlobalOptions } from "./core/types";

export async function main(argv = process.argv.slice(2)) {
  try {
    const { globalArgs, remaining } = extractLeadingGlobalArgs(argv);
    const parsedGlobal = parseFlags(globalArgs, {
      url: { type: "string" },
      agent: { type: "string" },
      card: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", alias: ["h"] },
      noContext: { type: "boolean" },
    });

    const global: GlobalOptions = {
      url: parsedGlobal.values.url as string | undefined,
      agent: parsedGlobal.values.agent as string | undefined,
      card: parsedGlobal.values.card as string | undefined,
      json: parsedGlobal.values.json as boolean | undefined,
      help: parsedGlobal.values.help as boolean | undefined,
      noContext: parsedGlobal.values.noContext as boolean | undefined,
    };

    const currentKey = cwdKey();
    const stored = getStoredContext(currentKey, !global.noContext);
    const baseUrl =
      global.url
      ?? process.env.AGENT_BOARD_URL
      ?? stored?.url
      ?? DEFAULT_BASE_URL;

    const state: CommandState = {
      client: new AgentBoardClient(baseUrl),
      global,
      cwdKey: currentKey,
      storedContext: stored,
      cache: {},
    };

    const result = await runCommand(state, remaining);
    print(result);
  } catch (error) {
    if (error instanceof ApiError) {
      print({
        error: error.message,
        status: error.status,
        method: error.method,
        path: error.requestPath,
        responseBody: error.responseBody,
      });
      process.exit(error.exitCode);
    }

    if (error instanceof CliError) {
      print({ error: error.message });
      process.exit(error.exitCode);
    }

    print({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}
