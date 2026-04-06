import { boolValue, parseFlags, requireString } from "../core/args";
import { updateStoredContext } from "../core/context";
import { CliError } from "../core/errors";
import { toQueryString } from "../core/helpers";
import {
  getCard,
  maybeEnsureAllowedStatus,
  postAgentComment,
  resolveAgentId,
  resolveCardId,
  resolveCardRecord,
  resolveEpicId,
  resolveFeatureId,
  resolveStatusId,
} from "../core/resolvers";
import type { Card, CommandState } from "../core/types";
import { cardsHelp } from "../help";

export async function handleCard(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return cardsHelp("cards");
  }

  switch (action) {
    case "list": {
      const parsed = parseFlags(rest, {
        status: { type: "string" },
        unblocked: { type: "boolean" },
        feature: { type: "string" },
        epic: { type: "string" },
        agent: { type: "string" },
        mine: { type: "boolean" },
        type: { type: "string" },
      });
      const statusId =
        typeof parsed.values.status === "string"
          ? await resolveStatusId(state, parsed.values.status)
          : undefined;
      const cards = await state.client.request<Card[]>(
        "GET",
        `/cards${toQueryString({
          status: statusId,
          unblocked: boolValue(parsed.values, "unblocked") ? true : undefined,
        })}`
      );
      const agentFilter = boolValue(parsed.values, "mine")
        ? resolveAgentId(state, undefined, true)
        : (parsed.values.agent as string | undefined);
      const featureId =
        typeof parsed.values.feature === "string"
          ? await resolveFeatureId(state, parsed.values.feature)
          : undefined;
      const epicId =
        typeof parsed.values.epic === "string"
          ? await resolveEpicId(state, parsed.values.epic)
          : undefined;

      return cards.filter((card) => {
        if (featureId && card.featureId !== featureId) return false;
        if (epicId && card.epicId !== epicId) return false;
        if (agentFilter && card.agentId !== agentFilter) return false;
        if (parsed.values.type && card.type !== parsed.values.type) return false;
        return true;
      });
    }
    case "get":
      return getCard(state, rest[0]);
    case "completed-today":
      return state.client.request("GET", "/cards/completed-today");
    case "create": {
      const parsed = parseFlags(rest, {
        title: { type: "string" },
        feature: { type: "string" },
        status: { type: "string" },
        type: { type: "string", default: "task" },
        description: { type: "string" },
        agent: { type: "string" },
        claim: { type: "boolean" },
        use: { type: "boolean" },
        plan: { type: "string" },
        noAutoAdvance: { type: "boolean" },
      });
      const featureId = await resolveFeatureId(state, requireString(parsed.values, "feature"));
      const statusId = await resolveStatusId(state, (parsed.values.status as string | undefined) ?? "To Do");
      const explicitAgentId = resolveAgentId(state, parsed.values.agent as string | undefined, false);
      let card = await state.client.request<Card>("POST", "/cards", {
        title: requireString(parsed.values, "title"),
        featureId,
        statusId,
        type: parsed.values.type as string,
        description: (parsed.values.description as string | undefined) ?? "",
        agentId: explicitAgentId ?? undefined,
      });

      if (boolValue(parsed.values, "claim")) {
        const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true)!;
        card = await state.client.request<Card>("POST", `/cards/${encodeURIComponent(card.id)}/claim`, {
          agentId,
          autoAdvance: !boolValue(parsed.values, "noAutoAdvance"),
        });
      }

      if (typeof parsed.values.plan === "string") {
        await postAgentComment(state, card.id, parsed.values.plan);
      }

      if (boolValue(parsed.values, "use") || boolValue(parsed.values, "claim")) {
        updateStoredContext(
          state.cwdKey,
          {
            url: state.client.baseUrl,
            agentId: resolveAgentId(state, parsed.values.agent as string | undefined, false) ?? undefined,
            cardId: card.id,
          },
          !state.global.noContext
        );
      }

      return card;
    }
    case "claim": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        agent: { type: "string" },
        noAutoAdvance: { type: "boolean" },
      });
      const cardId = await resolveCardId(
        state,
        (parsed.values.card as string | undefined) ?? parsed.positionals[0]
      );
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true)!;
      const claimed = await state.client.request<Card>("POST", `/cards/${encodeURIComponent(cardId)}/claim`, {
        agentId,
        autoAdvance: !boolValue(parsed.values, "noAutoAdvance"),
      });
      updateStoredContext(state.cwdKey, { url: state.client.baseUrl, agentId, cardId }, !state.global.noContext);
      return claimed;
    }
    case "allowed": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        agent: { type: "string" },
      });
      const cardId = await resolveCardId(
        state,
        (parsed.values.card as string | undefined) ?? parsed.positionals[0]
      );
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, false);
      return state.client.request(
        "GET",
        `/cards/${encodeURIComponent(cardId)}/allowed-statuses${toQueryString({ agentId: agentId ?? undefined })}`
      );
    }
    case "move": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        to: { type: "string" },
        status: { type: "string" },
        agent: { type: "string" },
      });
      const cardId = await resolveCardId(
        state,
        (parsed.values.card as string | undefined) ?? parsed.positionals[0]
      );
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true)!;
      const destination =
        (parsed.values.to as string | undefined)
        ?? (parsed.values.status as string | undefined);
      if (!destination) {
        throw new CliError('card move requires --to "<status>" or --status "<status>"');
      }
      const statusId = await resolveStatusId(state, destination);
      await maybeEnsureAllowedStatus(state, cardId, statusId, agentId);
      return state.client.request("PATCH", `/cards/${encodeURIComponent(cardId)}`, {
        statusId,
        agentId,
      });
    }
    case "update": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        feature: { type: "string" },
        epic: { type: "string" },
        type: { type: "string" },
        agent: { type: "string" },
        clearConflict: { type: "boolean" },
      });
      const cardId = await resolveCardId(
        state,
        (parsed.values.card as string | undefined) ?? parsed.positionals[0]
      );
      const body: Record<string, unknown> = {};
      if (typeof parsed.values.title === "string") body.title = parsed.values.title;
      if (typeof parsed.values.description === "string") body.description = parsed.values.description;
      if (typeof parsed.values.status === "string") {
        body.statusId = await resolveStatusId(state, parsed.values.status);
      }
      if (typeof parsed.values.feature === "string") {
        body.featureId = await resolveFeatureId(state, parsed.values.feature);
      }
      if (typeof parsed.values.epic === "string") {
        body.epicId = await resolveEpicId(state, parsed.values.epic);
      }
      if (typeof parsed.values.type === "string") body.type = parsed.values.type;
      if (boolValue(parsed.values, "clearConflict")) {
        body.conflictedAt = null;
        body.conflictDetails = null;
      }
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, false);
      if (agentId) body.agentId = agentId;
      if (Object.keys(body).length === 0) {
        throw new CliError("card update requires at least one patch field");
      }
      if (body.statusId && agentId) {
        await maybeEnsureAllowedStatus(state, cardId, body.statusId as string, agentId);
      }
      return state.client.request("PATCH", `/cards/${encodeURIComponent(cardId)}`, body);
    }
    case "comment": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        body: { type: "string" },
        author: { type: "string" },
      });
      const cardId = await resolveCardId(
        state,
        (parsed.values.card as string | undefined) ?? parsed.positionals[0]
      );
      const author =
        (parsed.values.author as string | undefined)
        ?? (resolveAgentId(state, undefined, false) ? "agent" : "user");
      if (author !== "agent" && author !== "user") {
        throw new CliError('Card comments only support authors "agent" and "user"');
      }
      return state.client.request("POST", `/cards/${encodeURIComponent(cardId)}/comments`, {
        body: requireString(parsed.values, "body"),
        author,
      });
    }
    case "diff": {
      const cardId = await resolveCardId(state, rest[0]);
      return state.client.request("GET", `/cards/${encodeURIComponent(cardId)}/diff`);
    }
    case "merge": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        strategy: { type: "string" },
        target: { type: "string" },
      });
      const cardId = await resolveCardId(state, (parsed.values.card as string | undefined) ?? rest[0]);
      return state.client.request("POST", `/cards/${encodeURIComponent(cardId)}/merge`, {
        strategy: (parsed.values.strategy as string | undefined) ?? undefined,
        targetBranch: (parsed.values.target as string | undefined) ?? undefined,
      });
    }
    case "recheck-conflicts": {
      const cardId = await resolveCardId(state, rest[0]);
      return state.client.request("POST", `/cards/${encodeURIComponent(cardId)}/recheck-conflicts`);
    }
    case "delete": {
      const cardId = await resolveCardId(state, rest[0]);
      return state.client.request("DELETE", `/cards/${encodeURIComponent(cardId)}`);
    }
    case "deps":
    case "dependencies":
      return handleDependencies(state, rest);
    default:
      throw new CliError(`Unknown card command "${action}". Run "agentboard cards help" for usage.`);
  }
}

export async function handleDependencies(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return cardsHelp("dependencies");
  }

  switch (action) {
    case "board":
      return state.client.request("GET", "/cards/dependencies");
    case "list": {
      const cardId = await resolveCardId(state, rest[0]);
      return state.client.request("GET", `/cards/${encodeURIComponent(cardId)}/dependencies`);
    }
    case "add": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        blocker: { type: "string" },
      });
      const cardId = await resolveCardId(
        state,
        (parsed.values.card as string | undefined) ?? parsed.positionals[0]
      );
      const blockerId = (await resolveCardRecord(state, requireString(parsed.values, "blocker"))).id;
      return state.client.request("POST", `/cards/${encodeURIComponent(cardId)}/dependencies`, {
        blockerCardId: blockerId,
      });
    }
    case "remove": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        blocker: { type: "string" },
      });
      const cardId = await resolveCardId(
        state,
        (parsed.values.card as string | undefined) ?? parsed.positionals[0]
      );
      const blockerId = (await resolveCardRecord(state, requireString(parsed.values, "blocker"))).id;
      return state.client.request(
        "DELETE",
        `/cards/${encodeURIComponent(cardId)}/dependencies/${encodeURIComponent(blockerId)}`
      );
    }
    default:
      throw new CliError(`Unknown dependency command "${action}". Run "agentboard dep help" for usage.`);
  }
}
