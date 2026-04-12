import { extractGlobalArgsAnywhere, extractLeadingGlobalArgs, parseFlags } from "./core/args";
import { AgentBoardClient } from "./core/client";
import { DEFAULT_BASE_URL } from "./core/constants";
import { ApiError, CliError } from "./core/errors";
import { print } from "./core/helpers";
import { runCommand } from "./run";
import type { CommandState, GlobalOptions } from "./core/types";

export async function main(argv = process.argv.slice(2)) {
  let global: GlobalOptions = {};
  try {
    const { globalArgs: leadingGlobalArgs, remaining: argsAfterLeadingGlobals } = extractLeadingGlobalArgs(argv);
    const { globalArgs: anyPositionGlobalArgs, remaining } = extractGlobalArgsAnywhere(argsAfterLeadingGlobals, {
      url: { type: "string" },
      json: { type: "boolean" },
    });
    const parsedGlobal = parseFlags([...leadingGlobalArgs, ...anyPositionGlobalArgs], {
      url: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", alias: ["h"] },
    });

    global = {
      url: parsedGlobal.values.url as string | undefined,
      json: parsedGlobal.values.json as boolean | undefined,
      help: parsedGlobal.values.help as boolean | undefined,
    };
    const baseUrl =
      global.url
      ?? process.env.AGENT_BOARD_URL
      ?? DEFAULT_BASE_URL;

    const state: CommandState = {
      client: new AgentBoardClient(baseUrl),
      global,
      cache: {},
    };

    const result = await runCommand(state, remaining);
    print(result, { json: global.json });
  } catch (error) {
    if (error instanceof ApiError) {
      print({
        error: error.message,
        status: error.status,
        method: error.method,
        path: error.requestPath,
        responseBody: error.responseBody,
      }, { json: global.json });
      process.exit(error.exitCode);
    }

    if (error instanceof CliError) {
      print({ error: error.message }, { json: global.json });
      process.exit(error.exitCode);
    }

    print({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { json: global.json });
    process.exit(1);
  }
}
