import { CliError } from "./errors";
import { exactMatch, findByNormalizedName, toQueryString } from "./helpers";
import type { Card, CommandState, Epic, Feature, Repo, Status, Workflow } from "./types";

export async function loadStatuses(state: CommandState) {
  state.cache.statuses ??= await state.client.request<Status[]>("GET", "/statuses");
  return state.cache.statuses;
}

export async function loadEpics(state: CommandState) {
  state.cache.epics ??= await state.client.request<Epic[]>("GET", "/epics");
  return state.cache.epics;
}

export async function loadFeatures(state: CommandState) {
  state.cache.features ??= await state.client.request<Feature[]>("GET", "/features");
  return state.cache.features;
}

export async function loadCards(state: CommandState) {
  state.cache.cards ??= await state.client.request<Card[]>("GET", "/cards");
  return state.cache.cards;
}

export async function loadRepos(state: CommandState) {
  state.cache.repos ??= await state.client.request<Repo[]>("GET", "/repos");
  return state.cache.repos;
}

export async function loadWorkflows(state: CommandState) {
  state.cache.workflows ??= await state.client.request<Workflow[]>("GET", "/workflows");
  return state.cache.workflows;
}

export async function resolveStatusId(state: CommandState, value: string) {
  const statuses = await loadStatuses(state);
  return exactMatch(statuses, value, "status", [(item) => item.id, (item) => item.name]).id;
}

export async function maybeResolveStatusId(state: CommandState, value: string) {
  const statuses = await loadStatuses(state);
  return findByNormalizedName(statuses, value, [(item) => item.id, (item) => item.name])?.id ?? null;
}

export async function resolveEpicId(state: CommandState, value: string) {
  const epics = await loadEpics(state);
  return exactMatch(epics, value, "epic", [(item) => item.id, (item) => item.title]).id;
}

export async function resolveFeatureId(state: CommandState, value: string) {
  const features = await loadFeatures(state);
  return exactMatch(features, value, "feature", [(item) => item.id, (item) => item.title]).id;
}

export async function resolveCardRecord(state: CommandState, value: string) {
  const cards = await loadCards(state);
  return exactMatch(cards, value, "card", [(item) => item.id, (item) => item.title]);
}

export async function resolveCardId(state: CommandState, explicit?: string) {
  const candidate =
    explicit
    ?? state.global.card
    ?? process.env.AGENT_BOARD_CARD_ID
    ?? state.storedContext?.cardId;
  if (!candidate) {
    throw new CliError("No card specified. Pass --card, use a positional card argument, or set context.");
  }
  return (await resolveCardRecord(state, candidate)).id;
}

export async function resolveRepoId(state: CommandState, value: string) {
  const repos = await loadRepos(state);
  return exactMatch(repos, value, "repo", [(item) => item.id, (item) => item.name]).id;
}

export async function resolveWorkflowId(state: CommandState, value: string) {
  const workflows = await loadWorkflows(state);
  return exactMatch(workflows, value, "workflow", [(item) => item.id, (item) => item.name, (item) => item.type]).id;
}

export function resolveAgentId(state: CommandState, explicit?: string, required = true) {
  const agentId =
    explicit
    ?? state.global.agent
    ?? process.env.AGENT_BOARD_AGENT_ID
    ?? state.storedContext?.agentId;
  if (!agentId && required) {
    throw new CliError("No agent id specified. Pass --agent or set context.");
  }
  return agentId ?? null;
}

export async function getCard(state: CommandState, explicit?: string) {
  const cardId = await resolveCardId(state, explicit);
  return state.client.request<Card & { comments?: unknown[] }>("GET", `/cards/${encodeURIComponent(cardId)}`);
}

export async function maybeEnsureAllowedStatus(
  state: CommandState,
  cardId: string,
  statusId: string,
  agentId: string | null
) {
  if (!agentId) return;
  const allowed = await state.client.request<Status[]>(
    "GET",
    `/cards/${encodeURIComponent(cardId)}/allowed-statuses${toQueryString({ agentId })}`
  );
  if (allowed.some((status) => status.id === statusId)) return;
  const targetStatus = (await loadStatuses(state)).find((status) => status.id === statusId)?.name ?? statusId;
  const allowedNames = allowed.map((status) => status.name).join(", ") || "(none)";
  throw new CliError(`Agent "${agentId}" cannot move this card to "${targetStatus}". Allowed statuses: ${allowedNames}`);
}

export async function postAgentComment(state: CommandState, cardId: string, body: string) {
  return state.client.request("POST", `/cards/${encodeURIComponent(cardId)}/comments`, {
    body,
    author: "agent",
  });
}
