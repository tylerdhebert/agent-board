import { boolValue, parseFlags, parseJson, readJsonFile, requireString } from "../core/args";
import { CliError } from "../core/errors";
import { toQueryString } from "../core/helpers";
import { resolveAgentId, resolveCardId } from "../core/resolvers";
import { communicationHelp, wantsScopedHelp } from "../help";
import type { CommandState, InputQuestion, InputRequestRecord, QueueMessage } from "../core/types";

const DEFAULT_POLL_INTERVAL_SECS = 2;
const DEFAULT_HEARTBEAT_SECS = 5;
const TRANSIENT_WAIT_RETRY_SECS = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function waitForInputRequest(
  state: CommandState,
  requestId: string,
  options?: {
    pollIntervalSecs?: number;
    heartbeatSecs?: number;
    timeoutSecs?: number;
  }
) {
  const pollIntervalSecs = options?.pollIntervalSecs ?? DEFAULT_POLL_INTERVAL_SECS;
  const heartbeatSecs = options?.heartbeatSecs ?? DEFAULT_HEARTBEAT_SECS;
  const startedAt = Date.now();
  const deadlineAt =
    typeof options?.timeoutSecs === "number"
      ? startedAt + (options.timeoutSecs * 1000)
      : null;
  let nextHeartbeatAt =
    heartbeatSecs > 0
      ? startedAt + (heartbeatSecs * 1000)
      : Number.POSITIVE_INFINITY;

  for (;;) {
    if (deadlineAt !== null && Date.now() > deadlineAt) {
      throw new CliError(`Timed out waiting for input request "${requestId}" after ${options!.timeoutSecs}s.`);
    }

    try {
      const request = await state.client.request<InputRequestRecord>("GET", `/input/${encodeURIComponent(requestId)}`);
      if (request.status === "answered") {
        if (!request.answers) {
          throw new CliError(`Input request "${requestId}" is answered but has no answer payload.`);
        }
        return {
          requestId,
          status: request.status,
          answers: request.answers,
          request,
        };
      }
      if (request.status === "timed_out") {
        throw new CliError(`Input request "${requestId}" timed out after ${request.timeoutSecs}s.`);
      }
    } catch (error) {
      if (error instanceof CliError) throw error;
      console.error(
        `[agentboard] waiting for input request ${requestId}; transient error: ${error instanceof Error ? error.message : String(error)}`
      );
      await sleep(TRANSIENT_WAIT_RETRY_SECS * 1000);
      continue;
    }

    const now = Date.now();
    if (heartbeatSecs > 0 && now >= nextHeartbeatAt) {
      console.error(
        `[agentboard] waiting for input request ${requestId} (${formatElapsed(now - startedAt)} elapsed)`
      );
      nextHeartbeatAt = now + (heartbeatSecs * 1000);
    }
    await sleep(pollIntervalSecs * 1000);
  }
}

function parseQuestionsFromArgs(values: Record<string, unknown>) {
  const hasStructuredQuestions =
    typeof values.file === "string"
    || (Array.isArray(values.questionJson) && values.questionJson.length > 0);
  const hasSingleQuestion = typeof values.prompt === "string";

  if (hasStructuredQuestions && hasSingleQuestion) {
    throw new CliError("Use either structured question input (--file/--question-json) or single-question flags (--prompt/--type), not both.");
  }
  if (typeof values.file === "string") {
    return readJsonFile<InputQuestion[]>(values.file);
  }
  if (Array.isArray(values.questionJson) && values.questionJson.length > 0) {
    return values.questionJson.map((entry) => parseJson<InputQuestion>(entry));
  }
  if (typeof values.prompt === "string") {
    const type = ((values.type as string | undefined) ?? "text") as InputQuestion["type"];
    if (!["text", "yesno", "choice"].includes(type)) {
      throw new CliError('Single-question input requests only support --type "text", "yesno", or "choice".');
    }
    const options = (values.option as string[] | undefined) ?? [];
    if (type === "choice" && options.length === 0) {
      throw new CliError('Choice questions require one or more --option "value" flags.');
    }
    if (type !== "choice" && options.length > 0) {
      throw new CliError("--option is only valid for choice questions.");
    }
    return [
      {
        id: (values.questionId as string | undefined) ?? "q1",
        type,
        prompt: values.prompt,
        default: values.default as string | undefined,
        options: options.length > 0 ? options : undefined,
      } satisfies InputQuestion,
    ];
  }
  throw new CliError("Provide questions with --file <json>, --question-json '<json>', or single-question flags like --prompt and --type.");
}

function parseAnswersFromArgs(values: Record<string, unknown>) {
  const hasFile = typeof values.file === "string";
  const hasJson = typeof values.answersJson === "string";
  const hasPairs = Array.isArray(values.answer) && values.answer.length > 0;

  if ([hasFile, hasJson, hasPairs].filter(Boolean).length > 1) {
    throw new CliError("Use only one of --file, --answers-json, or repeated --answer key=value flags.");
  }
  if (hasFile) {
    return readJsonFile<Record<string, string>>(values.file as string);
  }
  if (hasJson) {
    return parseJson<Record<string, string>>(values.answersJson as string);
  }
  if (hasPairs) {
    const answers: Record<string, string> = {};
    for (const entry of values.answer as string[]) {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) {
        throw new CliError(`Invalid --answer "${entry}". Use key=value.`);
      }
      const key = entry.slice(0, separatorIndex).trim();
      const answer = entry.slice(separatorIndex + 1).trim();
      if (!key) {
        throw new CliError(`Invalid --answer "${entry}". Use key=value.`);
      }
      answers[key] = answer;
    }
    return answers;
  }
  throw new CliError("Provide answers with --file <json>, --answers-json '<json>', or repeated --answer key=value flags.");
}

export async function handleInput(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return communicationHelp("input");
  }

  switch (action) {
    case "pending":
      return state.client.request("GET", `/input${toQueryString({ status: "pending" })}`);
    case "list": {
      const parsed = parseFlags(rest, {
        status: { type: "string" },
        card: { type: "string" },
      });
      const cardId =
        typeof parsed.values.card === "string"
          ? await resolveCardId(state, parsed.values.card)
          : undefined;
      return state.client.request<InputRequestRecord[]>(
        "GET",
        `/input${toQueryString({
          status: parsed.values.status as string | undefined,
          cardId,
        })}`
      );
    }
    case "get": {
      const requestId = rest[0];
      if (!requestId) {
        throw new CliError('Usage: agentboard input get <requestId>');
      }
      return state.client.request<InputRequestRecord>("GET", `/input/${encodeURIComponent(requestId)}`);
    }
    case "wait": {
      const [requestId, ...tail] = rest;
      if (!requestId) {
        throw new CliError('Usage: agentboard input wait <requestId> [--timeout <secs>] [--poll-interval <secs>] [--heartbeat <secs>]');
      }
      const parsed = parseFlags(tail, {
        timeout: { type: "number" },
        pollInterval: { type: "number", default: DEFAULT_POLL_INTERVAL_SECS },
        heartbeat: { type: "number", default: DEFAULT_HEARTBEAT_SECS },
      });
      return waitForInputRequest(state, requestId, {
        timeoutSecs: parsed.values.timeout as number | undefined,
        pollIntervalSecs: parsed.values.pollInterval as number | undefined,
        heartbeatSecs: parsed.values.heartbeat as number | undefined,
      });
    }
    case "request": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        timeout: { type: "number", default: 900 },
        pollInterval: { type: "number", default: DEFAULT_POLL_INTERVAL_SECS },
        heartbeat: { type: "number", default: DEFAULT_HEARTBEAT_SECS },
        file: { type: "string" },
        questionJson: { type: "string[]" },
        questionId: { type: "string" },
        type: { type: "string" },
        prompt: { type: "string" },
        option: { type: "string[]" },
        default: { type: "string" },
      });
      const cardId = await resolveCardId(
        state,
        (parsed.values.card as string | undefined) ?? parsed.positionals[0]
      );
      const questions = parseQuestionsFromArgs(parsed.values);
      const request = await state.client.request<InputRequestRecord>("POST", "/input", {
        cardId,
        questions,
        timeoutSecs: parsed.values.timeout as number,
        detach: true,
      });
      return waitForInputRequest(state, request.id, {
        timeoutSecs: parsed.values.timeout as number,
        pollIntervalSecs: parsed.values.pollInterval as number | undefined,
        heartbeatSecs: parsed.values.heartbeat as number | undefined,
      });
    }
    case "answer": {
      const [requestId, ...tail] = rest;
      if (!requestId) {
        throw new CliError("Usage: agentboard input answer <requestId> (--file answers.json | --answers-json '{...}')");
      }
      const parsed = parseFlags(tail, {
        file: { type: "string" },
        answersJson: { type: "string" },
        answer: { type: "string[]" },
      });
      const answers = parseAnswersFromArgs(parsed.values);
      return state.client.request("POST", `/input/${encodeURIComponent(requestId)}/answer`, { answers });
    }
    default:
      throw new CliError(`Unknown input command "${action}". Run "agentboard input help" for usage.`);
  }
}

export async function handleQueue(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return communicationHelp("queue");
  }
  if ((action === "inbox" || action === "list") && wantsScopedHelp(rest)) {
    return communicationHelp("queue");
  }

  switch (action) {
    case "conversations":
      return state.client.request("GET", "/queue/conversations");
    case "list":
    case "inbox": {
      const parsed = parseFlags(rest, {
        agent: { type: "string" },
        status: { type: "string", default: "pending" },
        all: { type: "boolean" },
        markRead: { type: "boolean" },
      });
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true)!;
      const status = boolValue(parsed.values, "all") ? undefined : (parsed.values.status as string | undefined);
      const messages = await state.client.request<QueueMessage[]>(
        "GET",
        `/queue${toQueryString({ agentId, status })}`
      );
      if (boolValue(parsed.values, "markRead")) {
        for (const message of messages) {
          if (message.status === "pending") {
            await state.client.request("POST", `/queue/${encodeURIComponent(message.id)}/read`);
          }
        }
      }
      return messages;
    }
    case "reply": {
      const parsed = parseFlags(rest, {
        agent: { type: "string" },
      });
      const body = parsed.positionals.join(" ").trim();
      if (!body) {
        throw new CliError('Usage: agentboard queue reply "Message text..."');
      }
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true)!;
      return state.client.request("POST", "/queue", {
        agentId,
        body,
        author: agentId,
      });
    }
    case "send": {
      const parsed = parseFlags(rest, {
        agent: { type: "string" },
        body: { type: "string" },
        author: { type: "string" },
      });
      const targetAgentId = requireString(parsed.values, "agent");
      const author =
        (parsed.values.author as string | undefined)
        ?? resolveAgentId(state, undefined, false)
        ?? "user";
      return state.client.request("POST", "/queue", {
        agentId: targetAgentId,
        body: requireString(parsed.values, "body"),
        author,
      });
    }
    case "read": {
      const messageId = rest[0];
      if (!messageId) throw new CliError("Usage: agentboard queue read <messageId>");
      return state.client.request("POST", `/queue/${encodeURIComponent(messageId)}/read`);
    }
    case "read-all": {
      const parsed = parseFlags(rest, { agent: { type: "string" } });
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true)!;
      const messages = await state.client.request<QueueMessage[]>(
        "GET",
        `/queue${toQueryString({ agentId, status: "pending" })}`
      );
      for (const message of messages) {
        await state.client.request("POST", `/queue/${encodeURIComponent(message.id)}/read`);
      }
      return { agentId, markedRead: messages.length };
    }
    case "delete": {
      const messageId = rest[0];
      if (!messageId) throw new CliError("Usage: agentboard queue delete <messageId>");
      return state.client.request("DELETE", `/queue/${encodeURIComponent(messageId)}`);
    }
    case "clear":
    case "clear-conversation": {
      const parsed = parseFlags(rest, { agent: { type: "string" } });
      const agentId = requireString(parsed.values, "agent");
      return state.client.request("DELETE", `/queue/conversations/${encodeURIComponent(agentId)}`);
    }
    default:
      throw new CliError(`Unknown queue command "${action}". Run "agentboard queue help" for usage.`);
  }
}
