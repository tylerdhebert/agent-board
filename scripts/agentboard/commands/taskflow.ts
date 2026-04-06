import { boolValue, parseFlags, requireString } from "../core/args";
import { clearStoredContext, updateStoredContext } from "../core/context";
import { normalizeString, toQueryString } from "../core/helpers";
import {
  getCard,
  loadEpics,
  loadFeatures,
  maybeEnsureAllowedStatus,
  maybeResolveStatusId,
  postAgentComment,
  resolveAgentId,
  resolveCardId,
  resolveRepoId,
  resolveStatusId,
  resolveWorkflowId,
} from "../core/resolvers";
import type { Card, CommandState, Epic, Feature, QueueMessage } from "../core/types";
import { CliError } from "../core/errors";
import { taskflowHelp, wantsScopedHelp } from "../help";

export async function handleStart(state: CommandState, args: string[]) {
  if (wantsScopedHelp(args)) {
    return taskflowHelp("start");
  }

  const parsed = parseFlags(args, {
    card: { type: "string" },
    agent: { type: "string" },
    noAutoAdvance: { type: "boolean" },
    plan: { type: "string" },
    skipInbox: { type: "boolean" },
  });
  const cardId = await resolveCardId(state, parsed.values.card as string | undefined);
  const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true)!;
  const claimed = await state.client.request<Card>("POST", `/cards/${encodeURIComponent(cardId)}/claim`, {
    agentId,
    autoAdvance: !boolValue(parsed.values, "noAutoAdvance"),
  });

  if (typeof parsed.values.plan === "string") {
    await postAgentComment(state, cardId, parsed.values.plan);
  }

  const inbox = boolValue(parsed.values, "skipInbox")
    ? []
    : await state.client.request<QueueMessage[]>(
        "GET",
        `/queue${toQueryString({ agentId, status: "pending" })}`
      );

  updateStoredContext(state.cwdKey, { url: state.client.baseUrl, agentId, cardId }, !state.global.noContext);

  return { claimed, inbox };
}

export async function handleCheckpoint(state: CommandState, args: string[]) {
  if (wantsScopedHelp(args)) {
    return taskflowHelp("checkpoint");
  }

  const parsed = parseFlags(args, {
    card: { type: "string" },
    body: { type: "string" },
  });
  const cardId = await resolveCardId(state, parsed.values.card as string | undefined);
  const body = requireString(parsed.values, "body");
  return postAgentComment(state, cardId, body);
}

export async function handleFinish(state: CommandState, args: string[]) {
  if (wantsScopedHelp(args)) {
    return taskflowHelp("finish");
  }

  const parsed = parseFlags(args, {
    card: { type: "string" },
    agent: { type: "string" },
    summary: { type: "string" },
    status: { type: "string" },
    noComment: { type: "boolean" },
  });
  const card = await getCard(state, parsed.values.card as string | undefined);
  const cardId = card.id;
  const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true)!;

  if (!boolValue(parsed.values, "noComment") && typeof parsed.values.summary === "string") {
    await postAgentComment(state, cardId, parsed.values.summary);
  }

  const explicitStatus = parsed.values.status as string | undefined;
  const defaultBranchStatus =
    card.branchName && card.repoId
      ? await maybeResolveStatusId(state, "Ready to Merge")
      : null;
  const statusId =
    explicitStatus
      ? await resolveStatusId(state, explicitStatus)
      : defaultBranchStatus ?? await resolveStatusId(state, "Done");
  await maybeEnsureAllowedStatus(state, cardId, statusId, agentId);

  const updated = await state.client.request<Card>("PATCH", `/cards/${encodeURIComponent(cardId)}`, {
    statusId,
    agentId,
  });
  const inbox = await state.client.request<QueueMessage[]>(
    "GET",
    `/queue${toQueryString({ agentId, status: "pending" })}`
  );

  clearStoredContext(state.cwdKey, ["cardId"], !state.global.noContext);

  return { card: updated, inbox };
}

export async function handleBootstrap(state: CommandState, args: string[]) {
  if (wantsScopedHelp(args)) {
    return taskflowHelp("bootstrap");
  }

  const parsed = parseFlags(args, {
    epic: { type: "string" },
    epicDescription: { type: "string" },
    feature: { type: "string" },
    featureDescription: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    status: { type: "string" },
    workflow: { type: "string" },
    repo: { type: "string" },
    branch: { type: "string" },
    type: { type: "string", default: "task" },
    agent: { type: "string" },
    claim: { type: "boolean" },
    noClaim: { type: "boolean" },
    plan: { type: "string" },
    noAutoAdvance: { type: "boolean" },
  });

  const epicTitle = requireString(parsed.values, "epic");
  const featureTitle = requireString(parsed.values, "feature");
  const cardTitle = requireString(parsed.values, "title");
  const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, false);

  const statusName = (parsed.values.status as string | undefined) ?? "To Do";
  const statusId = await resolveStatusId(state, statusName);

  const workflowHint = parsed.values.workflow as string | undefined;
  const workflowId =
    workflowHint
      ? await resolveWorkflowId(state, workflowHint)
      : (parsed.values.repo || parsed.values.branch ? await resolveWorkflowId(state, "worktree") : undefined);

  const repoId =
    typeof parsed.values.repo === "string"
      ? await resolveRepoId(state, parsed.values.repo)
      : undefined;

  const epics = await loadEpics(state);
  let epic = epics.find((item) => normalizeString(item.title) === normalizeString(epicTitle));
  if (!epic) {
    epic = await state.client.request<Epic>("POST", "/epics", {
      title: epicTitle,
      description: (parsed.values.epicDescription as string | undefined) ?? "",
      statusId,
      workflowId,
    });
    state.cache.epics = undefined;
  }

  const features = await loadFeatures(state);
  let feature = features.find(
    (item) =>
      item.epicId === epic!.id
      && normalizeString(item.title) === normalizeString(featureTitle)
  );
  if (!feature) {
    feature = await state.client.request<Feature>("POST", "/features", {
      epicId: epic.id,
      title: featureTitle,
      description: (parsed.values.featureDescription as string | undefined) ?? "",
      statusId,
      repoId,
      branchName: parsed.values.branch as string | undefined,
    });
    state.cache.features = undefined;
  }

  let card = await state.client.request<Card>("POST", "/cards", {
    title: cardTitle,
    featureId: feature.id,
    statusId,
    type: parsed.values.type as string,
    description: (parsed.values.description as string | undefined) ?? "",
    agentId: agentId ?? undefined,
  });
  state.cache.cards = undefined;

  const shouldClaim = boolValue(parsed.values, "noClaim") ? false : parsed.values.claim !== false;

  if (shouldClaim) {
    if (!agentId) {
      throw new CliError("bootstrap needs an agent id to claim the new card. Pass --agent or --no-claim.");
    }
    card = await state.client.request<Card>("POST", `/cards/${encodeURIComponent(card.id)}/claim`, {
      agentId,
      autoAdvance: !boolValue(parsed.values, "noAutoAdvance"),
    });
    if (typeof parsed.values.plan === "string") {
      await postAgentComment(state, card.id, parsed.values.plan);
    }
    updateStoredContext(state.cwdKey, { url: state.client.baseUrl, agentId, cardId: card.id }, !state.global.noContext);
  }

  return { epic, feature, card };
}
