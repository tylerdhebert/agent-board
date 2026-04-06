import { boolValue, parseFlags, parseJson, readJsonFile, requireString } from "../core/args";
import { CliError } from "../core/errors";
import { toQueryString } from "../core/helpers";
import { resolveAgentId, resolveCardId } from "../core/resolvers";
import { communicationHelp } from "../help";
import type { CommandState, InputQuestion, QueueMessage } from "../core/types";

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
      return state.client.request("GET", "/input/pending");
    case "request": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        timeout: { type: "number", default: 900 },
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
      return state.client.request("POST", "/input", {
        cardId,
        questions,
        timeoutSecs: parsed.values.timeout as number,
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
      const body = rest.join(" ").trim();
      if (!body) {
        throw new CliError('Usage: agentboard queue reply "Message text..."');
      }
      const agentId = resolveAgentId(state, undefined, true)!;
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
