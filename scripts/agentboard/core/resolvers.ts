import { CliError } from "./errors";
import { exactMatch } from "./helpers";
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
  return statuses.find((item) => item.id.toLowerCase() === value.toLowerCase() || item.name.toLowerCase() === value.toLowerCase())?.id ?? null;
}

export async function resolveEpicId(state: CommandState, value: string) {
  const epics = await loadEpics(state);
  return exactMatch(epics, value, "epic", [(item) => item.id, (item) => item.title]).id;
}

export async function resolveFeatureId(state: CommandState, value: string) {
  const features = await loadFeatures(state);
  return exactMatch(features, value, "feature", [(item) => item.id, (item) => item.ref, (item) => item.title]).id;
}

export async function resolveCardRecord(state: CommandState, value: string) {
  const cards = await loadCards(state);
  return exactMatch(cards, value, "card", [(item) => item.id, (item) => item.ref, (item) => item.title]);
}

export async function resolveCardId(state: CommandState, explicit?: string) {
  const candidate = explicit;
  if (!candidate) {
    throw new CliError("No card specified. Pass --card with a card ref or id, or use a positional card argument.");
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
  const agentId = explicit;
  if (!agentId && required) {
    throw new CliError("No agent id specified. Pass --agent explicitly.");
  }
  return agentId ?? null;
}

export async function getCard(state: CommandState, explicit?: string) {
  const cardId = await resolveCardId(state, explicit);
  return state.client.request<Card & { comments?: unknown[] }>("GET", `/cards/${encodeURIComponent(cardId)}`);
}

export async function postAgentComment(state: CommandState, cardId: string, agentId: string, body: string) {
  return state.client.request("POST", `/cards/${encodeURIComponent(cardId)}/comments`, {
    body,
    author: "agent",
    agentId,
  });
}
