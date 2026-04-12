import { boolValue, parseFlags, requireString } from "../core/args";
import { CliError } from "../core/errors";
import { buildGeneratedBranchName, toQueryString } from "../core/helpers";
import {
  getCard,
  loadEpics,
  loadFeatures,
  loadRepos,
  loadStatuses,
  postAgentComment,
  resolveAgentId,
  resolveCardId,
  resolveCardRecord,
  resolveEpicId,
  resolveFeatureId,
  resolveStatusId,
} from "../core/resolvers";
import type {
  Card,
  CardContextData,
  CardDependencies,
  CommandState,
  Comment,
  Epic,
  Feature,
  Status,
} from "../core/types";
import { cardsHelp } from "../help";

function summarizeCard(card: Card, statuses: Status[], features: Feature[], epics: Epic[]) {
  const feature = features.find((item) => item.id === card.featureId);
  const epic = epics.find((item) => item.id === card.epicId);
  return {
    ...card,
    statusName: statuses.find((status) => status.id === card.statusId)?.name ?? card.statusId,
    featureTitle: feature?.title ?? null,
    featureRef: feature?.ref ?? null,
    epicTitle: epic?.title ?? null,
  };
}

async function buildCardContext(state: CommandState, cardRef: string, agentId: string | null): Promise<CardContextData> {
  const cardId = await resolveCardId(state, cardRef);
  const [card, statuses, features, epics, repos, deps, pendingRequests] = await Promise.all([
    getCard(state, cardRef),
    loadStatuses(state),
    loadFeatures(state),
    loadEpics(state),
    loadRepos(state),
    state.client.request<CardDependencies>("GET", `/cards/${encodeURIComponent(cardId)}/dependencies`),
    state.client.request("GET", `/input${toQueryString({ status: "pending", cardId })}`) as Promise<Array<{ questions: Array<{ prompt: string }> }>>,
  ]);

  const feature = features.find((item) => item.id === card.featureId);
  const epic = epics.find((item) => item.id === card.epicId);
  const repoId = card.repoId ?? feature?.repoId ?? null;
  const repo = repoId ? repos.find((item) => item.id === repoId) ?? null : null;
  const statusName = statuses.find((status) => status.id === card.statusId)?.name ?? card.statusId;
  const blocked =
    statusName.toLowerCase() === "blocked"
    || deps.blockers.some((blocker) => blocker.statusName.toLowerCase() !== "done")
    || pendingRequests.length > 0
    || Boolean(card.blockedReason);

  return {
    card,
    statusName,
    featureTitle: feature?.title ?? null,
    featureRef: feature?.ref ?? null,
    epicTitle: epic?.title ?? null,
    blocked,
    waitingOnInput: pendingRequests.length > 0,
    pendingInputPrompts: pendingRequests.flatMap((request) => request.questions.map((question) => question.prompt)),
    blockers: deps.blockers,
    blocking: deps.blocking,
    repoName: repo?.name ?? null,
    repoPath: repo?.path ?? null,
    repoBaseBranch: repo?.baseBranch ?? null,
    featureBranchName: feature?.branchName ?? null,
    suggestedBranchName: repo ? (card.branchName ?? buildGeneratedBranchName(agentId, card)) : null,
    recentComments: ((card.comments as Comment[] | undefined) ?? []).slice(-3),
  };
}

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
        ? resolveAgentId(state, parsed.values.agent as string | undefined, true)
        : (parsed.values.agent as string | undefined);
      const featureId =
        typeof parsed.values.feature === "string"
          ? await resolveFeatureId(state, parsed.values.feature)
          : undefined;
      const epicId =
        typeof parsed.values.epic === "string"
          ? await resolveEpicId(state, parsed.values.epic)
          : undefined;
      const filtered = cards.filter((card) => {
        if (featureId && card.featureId !== featureId) return false;
        if (epicId && card.epicId !== epicId) return false;
        if (agentFilter && card.agentId !== agentFilter) return false;
        if (parsed.values.type && card.type !== parsed.values.type) return false;
        return true;
      });
      const [statuses, features, epics] = await Promise.all([
        loadStatuses(state),
        loadFeatures(state),
        loadEpics(state),
      ]);

      return {
        __render: "card-list",
        data: filtered.map((card) => summarizeCard(card, statuses, features, epics)),
      };
    }
    case "get": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        agent: { type: "string" },
      });
      const cardRef = (parsed.values.card as string | undefined) ?? parsed.positionals[0];
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, false);
      return {
        __render: "card-detail",
        data: await buildCardContext(state, requireString({ card: cardRef }, "card"), agentId),
      };
    }
    case "context": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        agent: { type: "string" },
      });
      const cardRef = (parsed.values.card as string | undefined) ?? parsed.positionals[0];
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, false);
      return {
        __render: "card-context",
        data: await buildCardContext(state, requireString({ card: cardRef }, "card"), agentId),
      };
    }
    case "completed-today": {
      const [cards, statuses, features, epics] = await Promise.all([
        state.client.request<Card[]>("GET", "/cards/completed-today"),
        loadStatuses(state),
        loadFeatures(state),
        loadEpics(state),
      ]);
      return {
        __render: "card-list",
        data: cards.map((card) => summarizeCard(card, statuses, features, epics)),
      };
    }
    case "create": {
      const parsed = parseFlags(rest, {
        title: { type: "string" },
        feature: { type: "string" },
        status: { type: "string" },
        type: { type: "string", default: "task" },
        description: { type: "string" },
        agent: { type: "string" },
        claim: { type: "boolean" },
        plan: { type: "string" },
        latestUpdate: { type: "string" },
        blockedReason: { type: "string" },
        noAutoAdvance: { type: "boolean" },
      });
      const featureId = await resolveFeatureId(state, requireString(parsed.values, "feature"));
      const statusId = await resolveStatusId(state, (parsed.values.status as string | undefined) ?? "To Do");
      const requestedAgentId =
        typeof parsed.values.agent === "string"
          ? resolveAgentId(state, parsed.values.agent as string, false)
          : null;
      let card = await state.client.request<Card>("POST", "/cards", {
        title: requireString(parsed.values, "title"),
        featureId,
        statusId,
        type: parsed.values.type as string,
        description: (parsed.values.description as string | undefined) ?? "",
        agentId: requestedAgentId ?? undefined,
        plan: parsed.values.plan as string | undefined,
        latestUpdate: parsed.values.latestUpdate as string | undefined,
        blockedReason: parsed.values.blockedReason as string | undefined,
      });

      if (boolValue(parsed.values, "claim")) {
        const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true)!;
        card = await state.client.request<Card>("POST", `/cards/${encodeURIComponent(card.id)}/claim`, {
          agentId,
          autoAdvance: !boolValue(parsed.values, "noAutoAdvance"),
        });
      }

      if (typeof parsed.values.plan === "string" && card.agentId) {
        await postAgentComment(state, card.id, card.agentId, parsed.values.plan);
      }

      const [statuses, features, epics] = await Promise.all([
        loadStatuses(state),
        loadFeatures(state),
        loadEpics(state),
      ]);
      const summary = summarizeCard(card, statuses, features, epics);
      return {
        __render: "taskflow",
        data: {
          action: "Created",
          card,
          statusName: statuses.find((status) => status.id === card.statusId)?.name ?? card.statusId,
          note: `Feature: ${summary.featureRef ? `${summary.featureRef} / ` : ""}${summary.featureTitle ?? "-"}`,
        },
      };
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
      const statuses = await loadStatuses(state);
      return {
        __render: "taskflow",
        data: {
          action: "Claimed",
          card: claimed,
          statusName: statuses.find((status) => status.id === claimed.statusId)?.name ?? claimed.statusId,
        },
      };
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
      const updated = await state.client.request<Card>("PATCH", `/cards/${encodeURIComponent(cardId)}`, {
        statusId,
        agentId,
      });
      const statuses = await loadStatuses(state);
      return {
        __render: "taskflow",
        data: {
          action: "Moved",
          card: updated,
          statusName: statuses.find((status) => status.id === updated.statusId)?.name ?? updated.statusId,
        },
      };
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
        plan: { type: "string" },
        latestUpdate: { type: "string" },
        handoffSummary: { type: "string" },
        blockedReason: { type: "string" },
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
      if (typeof parsed.values.plan === "string") body.plan = parsed.values.plan;
      if (typeof parsed.values.latestUpdate === "string") body.latestUpdate = parsed.values.latestUpdate;
      if (typeof parsed.values.handoffSummary === "string") body.handoffSummary = parsed.values.handoffSummary;
      if (typeof parsed.values.blockedReason === "string") body.blockedReason = parsed.values.blockedReason;
      if (boolValue(parsed.values, "clearConflict")) {
        body.conflictedAt = null;
        body.conflictDetails = null;
      }
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, false);
      if (agentId) body.agentId = agentId;
      if (Object.keys(body).length === 0) {
        throw new CliError("card update requires at least one patch field");
      }
      const updated = await state.client.request<Card>("PATCH", `/cards/${encodeURIComponent(cardId)}`, body);
      return {
        __render: "card-detail",
        data: await buildCardContext(state, updated.id, agentId ?? updated.agentId ?? null),
      };
    }
    case "comment": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        body: { type: "string" },
        agent: { type: "string" },
      });
      const cardRef = (parsed.values.card as string | undefined) ?? parsed.positionals[0];
      const cardId = await resolveCardId(state, cardRef);
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true);
      await state.client.request("POST", `/cards/${encodeURIComponent(cardId)}/comments`, {
        body: requireString(parsed.values, "body"),
        author: "agent",
        agentId: agentId ?? undefined,
      });
      return { __render: "action", data: { message: `Comment posted on ${cardRef ?? cardId}` } };
    }
    case "diff": {
      const cardId = await resolveCardId(state, rest[0]);
      const data = await state.client.request("GET", `/cards/${encodeURIComponent(cardId)}/diff`);
      return { __render: "card-diff", data };
    }
    case "merge": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        strategy: { type: "string" },
        target: { type: "string" },
      });
      const cardRef = (parsed.values.card as string | undefined) ?? rest[0];
      const cardId = await resolveCardId(state, cardRef);
      const result = await state.client.request<Record<string, unknown>>("POST", `/cards/${encodeURIComponent(cardId)}/merge`, {
        strategy: (parsed.values.strategy as string | undefined) ?? undefined,
        targetBranch: (parsed.values.target as string | undefined) ?? undefined,
      });
      const strategy = (parsed.values.strategy as string | undefined) ?? "merge";
      const target = (parsed.values.target as string | undefined) ?? String(result.targetBranch ?? "target");
      return { __render: "action", data: { message: `Merged ${cardRef ?? cardId} into ${target} (${strategy})` } };
    }
    case "recheck-conflicts": {
      const cardId = await resolveCardId(state, rest[0]);
      const result = await state.client.request<Record<string, unknown>>("POST", `/cards/${encodeURIComponent(cardId)}/recheck-conflicts`);
      const hasConflict = result.conflictedAt ?? result.hasConflict;
      return {
        __render: "action",
        data: { message: hasConflict ? `Conflicts detected on ${rest[0]}` : `No conflicts on ${rest[0]}` },
      };
    }
    case "delete": {
      const cardId = await resolveCardId(state, rest[0]);
      await state.client.request("DELETE", `/cards/${encodeURIComponent(cardId)}`);
      return { __render: "action", data: { message: `Deleted ${rest[0]}` } };
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
    case "board": {
      const data = await state.client.request("GET", "/cards/dependencies");
      return { __render: "dep-board", data };
    }
    case "list": {
      const cardId = await resolveCardId(state, rest[0]);
      const data = await state.client.request("GET", `/cards/${encodeURIComponent(cardId)}/dependencies`);
      return { __render: "dep-list", data };
    }
    case "add": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        blocker: { type: "string" },
      });
      const cardRef = (parsed.values.card as string | undefined) ?? parsed.positionals[0];
      const cardId = await resolveCardId(state, cardRef);
      const blockerRef = requireString(parsed.values, "blocker");
      const blockerId = (await resolveCardRecord(state, blockerRef)).id;
      await state.client.request("POST", `/cards/${encodeURIComponent(cardId)}/dependencies`, {
        blockerCardId: blockerId,
      });
      return { __render: "action", data: { message: `Dependency added: ${blockerRef} blocks ${cardRef ?? cardId}` } };
    }
    case "remove": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        blocker: { type: "string" },
      });
      const cardRef = (parsed.values.card as string | undefined) ?? parsed.positionals[0];
      const cardId = await resolveCardId(state, cardRef);
      const blockerRef = requireString(parsed.values, "blocker");
      const blockerId = (await resolveCardRecord(state, blockerRef)).id;
      await state.client.request(
        "DELETE",
        `/cards/${encodeURIComponent(cardId)}/dependencies/${encodeURIComponent(blockerId)}`
      );
      return { __render: "action", data: { message: `Dependency removed: ${blockerRef} → ${cardRef ?? cardId}` } };
    }
    default:
      throw new CliError(`Unknown dependency command "${action}". Run "agentboard dep help" for usage.`);
  }
}
