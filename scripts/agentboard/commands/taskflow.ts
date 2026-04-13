import { boolValue, parseFlags, requireString } from "../core/args";
import { normalizeString, toQueryString } from "../core/helpers";
import {
  getCard,
  loadEpics,
  loadFeatures,
  loadStatuses,
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
    await state.client.request("PATCH", `/cards/${encodeURIComponent(cardId)}`, {
      plan: parsed.values.plan,
      latestUpdate: parsed.values.plan,
    });
    await postAgentComment(state, cardId, agentId, parsed.values.plan);
  }

  const inbox = boolValue(parsed.values, "skipInbox")
    ? []
    : await state.client.request<QueueMessage[]>(
        "GET",
        `/queue${toQueryString({ agentId, status: "pending", author: "user" })}`
      );

  const statuses = await loadStatuses(state);
  return {
    __render: "taskflow",
    data: {
      action: "Started",
      card: claimed,
      statusName: statuses.find((status) => status.id === claimed.statusId)?.name ?? claimed.statusId,
      inboxCount: inbox.length,
      inboxMessages: inbox,
    },
  };
}

export async function handleCheckpoint(state: CommandState, args: string[]) {
  if (wantsScopedHelp(args)) {
    return taskflowHelp("checkpoint");
  }

  const parsed = parseFlags(args, {
    card: { type: "string" },
    agent: { type: "string" },
    body: { type: "string" },
  });
  const cardId = await resolveCardId(state, parsed.values.card as string | undefined);
  const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true)!;
  const body = requireString(parsed.values, "body");
  await state.client.request("PATCH", `/cards/${encodeURIComponent(cardId)}`, {
    latestUpdate: body,
  });
  await postAgentComment(state, cardId, agentId, body);
  return { __render: "action", data: { message: `Checkpoint posted on ${parsed.values.card as string | undefined ?? cardId}` } };
}

export async function handlePlan(state: CommandState, args: string[]) {
  if (wantsScopedHelp(args)) {
    return taskflowHelp("plan");
  }

  const parsed = parseFlags(args, {
    card: { type: "string" },
    agent: { type: "string" },
    body: { type: "string" },
  });
  const cardId = await resolveCardId(state, parsed.values.card as string | undefined);
  const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, true)!;
  const body =
    typeof parsed.values.body === "string"
      ? parsed.values.body
      : parsed.positionals.join(" ").trim();
  if (!body) {
    throw new CliError('Usage: agentboard plan --card <card> "Plan text..."');
  }
  await state.client.request("PATCH", `/cards/${encodeURIComponent(cardId)}`, {
    plan: body,
    latestUpdate: body,
  });
  await postAgentComment(state, cardId, agentId, body);
  return { __render: "action", data: { message: `Plan set on ${parsed.values.card as string | undefined ?? cardId}` } };
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

  const patchBody: Record<string, string | null> = {};
  if (typeof parsed.values.summary === "string") {
    patchBody.handoffSummary = parsed.values.summary;
    patchBody.latestUpdate = parsed.values.summary;
  }
  if (Object.keys(patchBody).length > 0) {
    await state.client.request("PATCH", `/cards/${encodeURIComponent(cardId)}`, patchBody);
  }

  if (!boolValue(parsed.values, "noComment") && typeof parsed.values.summary === "string") {
    await postAgentComment(state, cardId, agentId, parsed.values.summary);
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

  const updated = await state.client.request<Card>("POST", `/cards/${encodeURIComponent(cardId)}/move`, {
    statusId,
    agentId,
  });
  const inbox = await state.client.request<QueueMessage[]>(
    "GET",
    `/queue${toQueryString({ agentId, status: "pending", author: "user" })}`
  );

  const statuses = await loadStatuses(state);
  return {
    __render: "taskflow",
    data: {
      action: "Finished",
      card: updated,
      statusName: statuses.find((status) => status.id === updated.statusId)?.name ?? updated.statusId,
      inboxCount: inbox.length,
      inboxMessages: inbox,
    },
  };
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
    plan: { type: "string" },
  });

  const epicTitle = requireString(parsed.values, "epic");
  const featureTitle = requireString(parsed.values, "feature");
  const cardTitle = requireString(parsed.values, "title");

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
  let epicCreated = false;
  let epic = epics.find((item) => normalizeString(item.title) === normalizeString(epicTitle));
  if (!epic) {
    epicCreated = true;
    epic = await state.client.request<Epic>("POST", "/epics", {
      title: epicTitle,
      description: (parsed.values.epicDescription as string | undefined) ?? "",
      statusId,
      workflowId,
    });
    state.cache.epics = undefined;
  }

  const features = await loadFeatures(state);
  let featureCreated = false;
  let feature = features.find(
    (item) =>
      item.epicId === epic!.id
      && normalizeString(item.title) === normalizeString(featureTitle)
  );
  if (!feature) {
    featureCreated = true;
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

  const card = await state.client.request<Card>("POST", "/cards", {
    title: cardTitle,
    featureId: feature.id,
    statusId,
    type: parsed.values.type as string,
    description: (parsed.values.description as string | undefined) ?? "",
    plan: typeof parsed.values.plan === "string" ? parsed.values.plan : undefined,
    latestUpdate: typeof parsed.values.plan === "string" ? parsed.values.plan : undefined,
  });
  state.cache.cards = undefined;

  const statuses = await loadStatuses(state);
  return {
    __render: "bootstrap",
    data: {
      epic,
      epicCreated,
      feature,
      featureCreated,
      card,
      statusName: statuses.find((s) => s.id === card.statusId)?.name ?? statusName,
    },
  };
}
