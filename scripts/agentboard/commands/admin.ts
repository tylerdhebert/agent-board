import { boolValue, parseBooleanString, parseFlags, requireString } from "../core/args";
import { CliError } from "../core/errors";
import { buildGeneratedBranchName, normalizeString, toQueryString } from "../core/helpers";
import {
  getCard,
  loadCards,
  loadEpics,
  loadFeatures,
  resolveCardId,
  resolveEpicId,
  resolveFeatureId,
  resolveRepoId,
  resolveStatusId,
  resolveWorkflowId,
  resolveAgentId,
} from "../core/resolvers";
import { adminHelp } from "../help";
import type { CommandState, Feature } from "../core/types";

export async function handleStatus(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return adminHelp("status");
  }

  switch (action) {
    case "list":
      return state.client.request("GET", "/statuses");
    case "create": {
      const parsed = parseFlags(rest, {
        name: { type: "string" },
        color: { type: "string" },
      });
      return state.client.request("POST", "/statuses", {
        name: requireString(parsed.values, "name"),
        color: requireString(parsed.values, "color"),
      });
    }
    case "update": {
      const [statusRef, ...tail] = rest;
      if (!statusRef) throw new CliError("Usage: agentboard status update <status> [--name ...] [--color ...] [--position ...]");
      const parsed = parseFlags(tail, {
        name: { type: "string" },
        color: { type: "string" },
        position: { type: "number" },
      });
      const statusId = await resolveStatusId(state, statusRef);
      const body: Record<string, unknown> = {};
      if (typeof parsed.values.name === "string") body.name = parsed.values.name;
      if (typeof parsed.values.color === "string") body.color = parsed.values.color;
      if (typeof parsed.values.position === "number") body.position = parsed.values.position;
      return state.client.request("PATCH", `/statuses/${encodeURIComponent(statusId)}`, body);
    }
    case "delete": {
      const statusId = await resolveStatusId(state, rest[0]);
      return state.client.request("DELETE", `/statuses/${encodeURIComponent(statusId)}`);
    }
    default:
      throw new CliError(`Unknown status command "${action}". Run "agentboard status help" for usage.`);
  }
}

export async function handleEpic(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return adminHelp("epic");
  }

  switch (action) {
    case "list":
      return state.client.request("GET", "/epics");
    case "create": {
      const parsed = parseFlags(rest, {
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        workflow: { type: "string" },
      });
      return state.client.request("POST", "/epics", {
        title: requireString(parsed.values, "title"),
        description: (parsed.values.description as string | undefined) ?? "",
        statusId:
          typeof parsed.values.status === "string"
            ? await resolveStatusId(state, parsed.values.status)
            : undefined,
        workflowId:
          typeof parsed.values.workflow === "string"
            ? await resolveWorkflowId(state, parsed.values.workflow)
            : undefined,
      });
    }
    case "update": {
      const [epicRef, ...tail] = rest;
      if (!epicRef) throw new CliError("Usage: agentboard epic update <epic> [--title ...] [--description ...] [--status ...] [--workflow ...]");
      const parsed = parseFlags(tail, {
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        workflow: { type: "string" },
      });
      const epicId = await resolveEpicId(state, epicRef);
      const body: Record<string, unknown> = {};
      if (typeof parsed.values.title === "string") body.title = parsed.values.title;
      if (typeof parsed.values.description === "string") body.description = parsed.values.description;
      if (typeof parsed.values.status === "string") body.statusId = await resolveStatusId(state, parsed.values.status);
      if (typeof parsed.values.workflow === "string") body.workflowId = await resolveWorkflowId(state, parsed.values.workflow);
      return state.client.request("PATCH", `/epics/${encodeURIComponent(epicId)}`, body);
    }
    case "delete": {
      const epicId = await resolveEpicId(state, rest[0]);
      return state.client.request("DELETE", `/epics/${encodeURIComponent(epicId)}`);
    }
    case "commits": {
      const [epicRef, ...tail] = rest;
      if (!epicRef) throw new CliError("Usage: agentboard epic commits <epic> --repo <repo>");
      const parsed = parseFlags(tail, { repo: { type: "string" } });
      const epicId = await resolveEpicId(state, epicRef);
      const repoId = await resolveRepoId(state, requireString(parsed.values, "repo"));
      return state.client.request("GET", `/epics/${encodeURIComponent(epicId)}/commits${toQueryString({ repoId })}`);
    }
    case "commit": {
      const [epicRef, hash, ...tail] = rest;
      if (!epicRef || !hash) throw new CliError("Usage: agentboard epic commit <epic> <hash> --repo <repo>");
      const parsed = parseFlags(tail, { repo: { type: "string" } });
      const epicId = await resolveEpicId(state, epicRef);
      const repoId = await resolveRepoId(state, requireString(parsed.values, "repo"));
      return state.client.request(
        "GET",
        `/epics/${encodeURIComponent(epicId)}/commits/${encodeURIComponent(hash)}${toQueryString({ repoId })}`
      );
    }
    default:
      throw new CliError(`Unknown epic command "${action}". Run "agentboard epic help" for usage.`);
  }
}

export async function handleFeature(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return adminHelp("feature");
  }

  switch (action) {
    case "list": {
      const parsed = parseFlags(rest, {
        epic: { type: "string" },
        agent: { type: "string" },
      });
      const features = await state.client.request<Feature[]>("GET", "/features");
      const epicId =
        typeof parsed.values.epic === "string"
          ? await resolveEpicId(state, parsed.values.epic)
          : undefined;
      const agentId =
        typeof parsed.values.agent === "string"
          ? resolveAgentId(state, parsed.values.agent, true)
          : null;
      const cards = agentId ? await loadCards(state) : null;

      return features.filter((feature) => {
        if (epicId && feature.epicId !== epicId) return false;
        if (!agentId || !cards) return true;
        return cards.some((card) => card.featureId === feature.id && card.agentId === agentId);
      });
    }
    case "create": {
      const parsed = parseFlags(rest, {
        epic: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string" },
      });
      return state.client.request("POST", "/features", {
        epicId: await resolveEpicId(state, requireString(parsed.values, "epic")),
        title: requireString(parsed.values, "title"),
        description: (parsed.values.description as string | undefined) ?? "",
        statusId:
          typeof parsed.values.status === "string"
            ? await resolveStatusId(state, parsed.values.status)
            : undefined,
        repoId:
          typeof parsed.values.repo === "string"
            ? await resolveRepoId(state, parsed.values.repo)
            : undefined,
        branchName: parsed.values.branch as string | undefined,
      });
    }
    case "update": {
      const [featureRef, ...tail] = rest;
      if (!featureRef) throw new CliError("Usage: agentboard feature update <feature> [--title ...] [--description ...] [--status ...] [--epic ...] [--repo ...] [--branch ...]");
      const parsed = parseFlags(tail, {
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        epic: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string" },
      });
      const featureId = await resolveFeatureId(state, featureRef);
      const body: Record<string, unknown> = {};
      if (typeof parsed.values.title === "string") body.title = parsed.values.title;
      if (typeof parsed.values.description === "string") body.description = parsed.values.description;
      if (typeof parsed.values.status === "string") body.statusId = await resolveStatusId(state, parsed.values.status);
      if (typeof parsed.values.epic === "string") body.epicId = await resolveEpicId(state, parsed.values.epic);
      if (typeof parsed.values.repo === "string") body.repoId = await resolveRepoId(state, parsed.values.repo);
      if (typeof parsed.values.branch === "string") body.branchName = parsed.values.branch;
      return state.client.request("PATCH", `/features/${encodeURIComponent(featureId)}`, body);
    }
    case "delete": {
      const featureId = await resolveFeatureId(state, rest[0]);
      return state.client.request("DELETE", `/features/${encodeURIComponent(featureId)}`);
    }
    case "commits": {
      const featureId = await resolveFeatureId(state, rest[0]);
      return state.client.request("GET", `/features/${encodeURIComponent(featureId)}/commits`);
    }
    case "commit": {
      const [featureRef, hash] = rest;
      if (!featureRef || !hash) throw new CliError("Usage: agentboard feature commit <feature> <hash>");
      const featureId = await resolveFeatureId(state, featureRef);
      return state.client.request("GET", `/features/${encodeURIComponent(featureId)}/commits/${encodeURIComponent(hash)}`);
    }
    case "build": {
      const featureId = await resolveFeatureId(state, rest[0]);
      return state.client.request("POST", `/features/${encodeURIComponent(featureId)}/build`);
    }
    case "build-status": {
      const featureId = await resolveFeatureId(state, rest[0]);
      return state.client.request("GET", `/features/${encodeURIComponent(featureId)}/build`);
    }
    default:
      throw new CliError(`Unknown feature command "${action}". Run "agentboard feature help" for usage.`);
  }
}

export async function handleRepo(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return adminHelp("repo");
  }

  switch (action) {
    case "list":
      return state.client.request("GET", "/repos");
    case "create": {
      const parsed = parseFlags(rest, {
        name: { type: "string" },
        path: { type: "string" },
        base: { type: "string" },
        compareBase: { type: "string" },
        build: { type: "string" },
      });
      return state.client.request("POST", "/repos", {
        name: requireString(parsed.values, "name"),
        path: requireString(parsed.values, "path"),
        baseBranch: parsed.values.base as string | undefined,
        compareBase: parsed.values.compareBase as string | undefined,
        buildCommand: parsed.values.build as string | undefined,
      });
    }
    case "update": {
      const [repoRef, ...tail] = rest;
      if (!repoRef) throw new CliError("Usage: agentboard repo update <repo> [--name ...] [--path ...] [--base ...] [--compare-base ...] [--build ...]");
      const parsed = parseFlags(tail, {
        name: { type: "string" },
        path: { type: "string" },
        base: { type: "string" },
        compareBase: { type: "string" },
        build: { type: "string" },
      });
      const repoId = await resolveRepoId(state, repoRef);
      const body: Record<string, unknown> = {};
      if (typeof parsed.values.name === "string") body.name = parsed.values.name;
      if (typeof parsed.values.path === "string") body.path = parsed.values.path;
      if (typeof parsed.values.base === "string") body.baseBranch = parsed.values.base;
      if (typeof parsed.values.compareBase === "string") body.compareBase = parsed.values.compareBase;
      if (typeof parsed.values.build === "string") body.buildCommand = parsed.values.build;
      return state.client.request("PATCH", `/repos/${encodeURIComponent(repoId)}`, body);
    }
    case "delete": {
      const repoId = await resolveRepoId(state, rest[0]);
      return state.client.request("DELETE", `/repos/${encodeURIComponent(repoId)}`);
    }
    default:
      throw new CliError(`Unknown repo command "${action}". Run "agentboard repo help" for usage.`);
  }
}

export async function handleWorkflow(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return adminHelp("workflow");
  }

  switch (action) {
    case "list":
      return state.client.request("GET", "/workflows");
    case "statuses": {
      const workflowId = await resolveWorkflowId(state, rest[0]);
      return state.client.request("GET", `/workflows/${encodeURIComponent(workflowId)}/statuses`);
    }
    case "add-status": {
      const [workflowRef, ...tail] = rest;
      if (!workflowRef) throw new CliError("Usage: agentboard workflow add-status <workflow> --status <status> [--triggers-merge]");
      const parsed = parseFlags(tail, {
        status: { type: "string" },
        triggersMerge: { type: "boolean" },
      });
      const workflowId = await resolveWorkflowId(state, workflowRef);
      return state.client.request("POST", `/workflows/${encodeURIComponent(workflowId)}/statuses`, {
        statusId: await resolveStatusId(state, requireString(parsed.values, "status")),
        triggersMerge: boolValue(parsed.values, "triggersMerge"),
      });
    }
    case "remove-status": {
      const [workflowRef, wsId] = rest;
      if (!workflowRef || !wsId) throw new CliError("Usage: agentboard workflow remove-status <workflow> <workflowStatusId>");
      const workflowId = await resolveWorkflowId(state, workflowRef);
      return state.client.request("DELETE", `/workflows/${encodeURIComponent(workflowId)}/statuses/${encodeURIComponent(wsId)}`);
    }
    case "set-position": {
      const [workflowRef, wsId, positionRaw] = rest;
      if (!workflowRef || !wsId || !positionRaw) {
        throw new CliError("Usage: agentboard workflow set-position <workflow> <workflowStatusId> <position>");
      }
      const position = Number(positionRaw);
      if (Number.isNaN(position)) throw new CliError("Position must be a number");
      const workflowId = await resolveWorkflowId(state, workflowRef);
      return state.client.request("PATCH", `/workflows/${encodeURIComponent(workflowId)}/statuses/${encodeURIComponent(wsId)}/position`, {
        position,
      });
    }
    case "set-merge": {
      const [workflowRef, wsId, valueRaw] = rest;
      if (!workflowRef || !wsId || !valueRaw) {
        throw new CliError("Usage: agentboard workflow set-merge <workflow> <workflowStatusId> <true|false>");
      }
      const workflowId = await resolveWorkflowId(state, workflowRef);
      return state.client.request("PATCH", `/workflows/${encodeURIComponent(workflowId)}/statuses/${encodeURIComponent(wsId)}/merge`, {
        triggersMerge: parseBooleanString(valueRaw),
      });
    }
    default:
      throw new CliError(`Unknown workflow command "${action}". Run "agentboard workflow help" for usage.`);
  }
}

export async function handleRule(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return adminHelp("rule");
  }

  switch (action) {
    case "list":
      return state.client.request("GET", "/transition-rules");
    case "create": {
      const parsed = parseFlags(rest, {
        to: { type: "string" },
        from: { type: "string" },
        agentPattern: { type: "string" },
      });
      return state.client.request("POST", "/transition-rules", {
        toStatusId: await resolveStatusId(state, requireString(parsed.values, "to")),
        fromStatusId:
          typeof parsed.values.from === "string"
            ? await resolveStatusId(state, parsed.values.from)
            : undefined,
        agentPattern: parsed.values.agentPattern as string | undefined,
      });
    }
    case "delete": {
      const ruleId = rest[0];
      if (!ruleId) throw new CliError("Usage: agentboard rule delete <ruleId>");
      return state.client.request("DELETE", `/transition-rules/${encodeURIComponent(ruleId)}`);
    }
    default:
      throw new CliError(`Unknown rule command "${action}". Run "agentboard rule help" for usage.`);
  }
}

export async function handleWorktree(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return adminHelp("worktree");
  }

  switch (action) {
    case "create": {
      const parsed = parseFlags(rest, {
        card: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string" },
        base: { type: "string" },
      });
      const cardId = await resolveCardId(
        state,
        (parsed.values.card as string | undefined) ?? parsed.positionals[0]
      );
      const repoId = await resolveRepoId(state, requireString(parsed.values, "repo"));
      const card = await getCard(state, cardId);
      const feature =
        card.featureId
          ? (await loadFeatures(state)).find((item) => item.id === card.featureId)
          : undefined;
      const branchName =
        (parsed.values.branch as string | undefined)
        ?? card.branchName
        ?? feature?.branchName
        ?? buildGeneratedBranchName(resolveAgentId(state, undefined, false), card);
      return state.client.request("POST", "/worktrees", {
        cardId,
        repoId,
        branchName,
        baseBranch: parsed.values.base as string | undefined,
      });
    }
    case "delete":
    case "remove": {
      const parsed = parseFlags(rest, {
        repo: { type: "string" },
        branch: { type: "string" },
        card: { type: "string" },
      });
      const branchName =
        (parsed.values.branch as string | undefined)
        ?? parsed.positionals[0]
        ?? (await getCard(state, parsed.values.card as string | undefined).catch(() => null))?.branchName
        ?? null;
      if (!branchName) {
        throw new CliError("Usage: agentboard worktree remove <branchName> --repo <repo> or use --branch / --card with a branch-backed card.");
      }
      const repoId = await resolveRepoId(state, requireString(parsed.values, "repo"));
      return state.client.request(
        "DELETE",
        `/worktrees/${encodeURIComponent(branchName)}${toQueryString({ repoId })}`
      );
    }
    default:
      throw new CliError(`Unknown worktree command "${action}". Run "agentboard worktree help" for usage.`);
  }
}
