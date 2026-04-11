import { boolValue, parseBooleanString, parseFlags, requireString } from "../core/args";
import { CliError } from "../core/errors";
import { buildGeneratedBranchName, normalizeString, toQueryString } from "../core/helpers";
import {
  getCard,
  loadCards,
  loadEpics,
  loadFeatures,
  loadRepos,
  loadStatuses,
  resolveCardId,
  resolveEpicId,
  resolveFeatureId,
  resolveRepoId,
  resolveStatusId,
  resolveWorkflowId,
  resolveAgentId,
} from "../core/resolvers";
import { adminHelp } from "../help";
import type { CommandState, Epic, Feature } from "../core/types";

export async function handleStatus(state: CommandState, args: string[]) {
  const [action, ...rest] = args;
  if (!action || action === "help" || action === "--help" || action === "-h") {
    return adminHelp("status");
  }

  switch (action) {
    case "list": {
      const data = await state.client.request("GET", "/statuses");
      return { __render: "status-list", data };
    }
    case "create": {
      const parsed = parseFlags(rest, {
        name: { type: "string" },
        color: { type: "string" },
      });
      const data = await state.client.request("POST", "/statuses", {
        name: requireString(parsed.values, "name"),
        color: requireString(parsed.values, "color"),
      });
      return { __render: "record", data };
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
      const data = await state.client.request("PATCH", `/statuses/${encodeURIComponent(statusId)}`, body);
      return { __render: "record", data };
    }
    case "delete": {
      const statusId = await resolveStatusId(state, rest[0]);
      await state.client.request("DELETE", `/statuses/${encodeURIComponent(statusId)}`);
      return { __render: "action", data: { message: `Deleted status "${rest[0]}"` } };
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
    case "list": {
      const [rawEpics, statuses] = await Promise.all([
        state.client.request<Epic[]>("GET", "/epics"),
        loadStatuses(state),
      ]);
      return {
        __render: "epic-list",
        data: rawEpics.map((epic) => ({
          ...epic,
          statusName: statuses.find((s) => s.id === epic.statusId)?.name ?? "-",
        })),
      };
    }
    case "create": {
      const parsed = parseFlags(rest, {
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        workflow: { type: "string" },
      });
      const data = await state.client.request("POST", "/epics", {
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
      return { __render: "record", data };
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
      const data = await state.client.request("PATCH", `/epics/${encodeURIComponent(epicId)}`, body);
      return { __render: "record", data };
    }
    case "delete": {
      const epicId = await resolveEpicId(state, rest[0]);
      await state.client.request("DELETE", `/epics/${encodeURIComponent(epicId)}`);
      return { __render: "action", data: { message: `Deleted epic "${rest[0]}"` } };
    }
    case "commits": {
      const [epicRef, ...tail] = rest;
      if (!epicRef) throw new CliError("Usage: agentboard epic commits <epic> --repo <repo>");
      const parsed = parseFlags(tail, { repo: { type: "string" } });
      const epicId = await resolveEpicId(state, epicRef);
      const repoId = await resolveRepoId(state, requireString(parsed.values, "repo"));
      const data = await state.client.request("GET", `/epics/${encodeURIComponent(epicId)}/commits${toQueryString({ repoId })}`);
      return { __render: "commit-list", data };
    }
    case "commit": {
      const [epicRef, hash, ...tail] = rest;
      if (!epicRef || !hash) throw new CliError("Usage: agentboard epic commit <epic> <hash> --repo <repo>");
      const parsed = parseFlags(tail, { repo: { type: "string" } });
      const epicId = await resolveEpicId(state, epicRef);
      const repoId = await resolveRepoId(state, requireString(parsed.values, "repo"));
      const data = await state.client.request(
        "GET",
        `/epics/${encodeURIComponent(epicId)}/commits/${encodeURIComponent(hash)}${toQueryString({ repoId })}`
      );
      return { __render: "commit-detail", data };
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
      const filtered = features.filter((feature) => {
        if (epicId && feature.epicId !== epicId) return false;
        if (!agentId || !cards) return true;
        return cards.some((card) => card.featureId === feature.id && card.agentId === agentId);
      });
      const repos = await loadRepos(state);
      return {
        __render: "feature-list",
        data: filtered.map((feature) => ({
          ...feature,
          repoName: repos.find((repo) => repo.id === feature.repoId)?.name ?? null,
        })),
      };
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
      const data = await state.client.request("POST", "/features", {
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
      return { __render: "record", data };
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
      const data = await state.client.request("PATCH", `/features/${encodeURIComponent(featureId)}`, body);
      return { __render: "record", data };
    }
    case "delete": {
      const featureId = await resolveFeatureId(state, rest[0]);
      await state.client.request("DELETE", `/features/${encodeURIComponent(featureId)}`);
      return { __render: "action", data: { message: `Deleted feature ${rest[0]}` } };
    }
    case "commits": {
      const featureId = await resolveFeatureId(state, rest[0]);
      const data = await state.client.request("GET", `/features/${encodeURIComponent(featureId)}/commits`);
      return { __render: "commit-list", data };
    }
    case "commit": {
      const [featureRef, hash] = rest;
      if (!featureRef || !hash) throw new CliError("Usage: agentboard feature commit <feature> <hash>");
      const featureId = await resolveFeatureId(state, featureRef);
      const data = await state.client.request("GET", `/features/${encodeURIComponent(featureId)}/commits/${encodeURIComponent(hash)}`);
      return { __render: "commit-detail", data };
    }
    case "build": {
      const featureId = await resolveFeatureId(state, rest[0]);
      await state.client.request("POST", `/features/${encodeURIComponent(featureId)}/build`);
      return { __render: "action", data: { message: `Build triggered for ${rest[0]}` } };
    }
    case "build-status": {
      const featureId = await resolveFeatureId(state, rest[0]);
      const data = await state.client.request("GET", `/features/${encodeURIComponent(featureId)}/build`);
      return { __render: "record", data };
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
    case "list": {
      const data = await state.client.request("GET", "/repos");
      return { __render: "repo-list", data };
    }
    case "create": {
      const parsed = parseFlags(rest, {
        name: { type: "string" },
        path: { type: "string" },
        base: { type: "string" },
        build: { type: "string" },
      });
      const data = await state.client.request("POST", "/repos", {
        name: requireString(parsed.values, "name"),
        path: requireString(parsed.values, "path"),
        baseBranch: parsed.values.base as string | undefined,
        buildCommand: parsed.values.build as string | undefined,
      });
      return { __render: "record", data };
    }
    case "update": {
      const [repoRef, ...tail] = rest;
      if (!repoRef) throw new CliError("Usage: agentboard repo update <repo> [--name ...] [--path ...] [--base ...] [--build ...]");
      const parsed = parseFlags(tail, {
        name: { type: "string" },
        path: { type: "string" },
        base: { type: "string" },
        build: { type: "string" },
      });
      const repoId = await resolveRepoId(state, repoRef);
      const body: Record<string, unknown> = {};
      if (typeof parsed.values.name === "string") body.name = parsed.values.name;
      if (typeof parsed.values.path === "string") body.path = parsed.values.path;
      if (typeof parsed.values.base === "string") body.baseBranch = parsed.values.base;
      if (typeof parsed.values.build === "string") body.buildCommand = parsed.values.build;
      const data = await state.client.request("PATCH", `/repos/${encodeURIComponent(repoId)}`, body);
      return { __render: "record", data };
    }
    case "delete": {
      const repoId = await resolveRepoId(state, rest[0]);
      await state.client.request("DELETE", `/repos/${encodeURIComponent(repoId)}`);
      return { __render: "action", data: { message: `Deleted repo "${rest[0]}"` } };
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
    case "list": {
      const data = await state.client.request("GET", "/workflows");
      return { __render: "workflow-list", data };
    }
    case "statuses": {
      const workflowId = await resolveWorkflowId(state, rest[0]);
      const [rawStatuses, statuses] = await Promise.all([
        state.client.request<Array<Record<string, unknown>>>("GET", `/workflows/${encodeURIComponent(workflowId)}/statuses`),
        loadStatuses(state),
      ]);
      return {
        __render: "workflow-statuses",
        data: rawStatuses.map((ws) => ({
          ...ws,
          statusName: statuses.find((s) => s.id === ws.statusId)?.name ?? ws.statusId,
        })),
      };
    }
    case "add-status": {
      const [workflowRef, ...tail] = rest;
      if (!workflowRef) throw new CliError("Usage: agentboard workflow add-status <workflow> --status <status> [--triggers-merge]");
      const parsed = parseFlags(tail, {
        status: { type: "string" },
        triggersMerge: { type: "boolean" },
      });
      const workflowId = await resolveWorkflowId(state, workflowRef);
      const statusName = requireString(parsed.values, "status");
      await state.client.request("POST", `/workflows/${encodeURIComponent(workflowId)}/statuses`, {
        statusId: await resolveStatusId(state, statusName),
        triggersMerge: boolValue(parsed.values, "triggersMerge"),
      });
      return { __render: "action", data: { message: `Added status "${statusName}" to workflow "${workflowRef}"` } };
    }
    case "remove-status": {
      const [workflowRef, wsId] = rest;
      if (!workflowRef || !wsId) throw new CliError("Usage: agentboard workflow remove-status <workflow> <workflowStatusId>");
      const workflowId = await resolveWorkflowId(state, workflowRef);
      await state.client.request("DELETE", `/workflows/${encodeURIComponent(workflowId)}/statuses/${encodeURIComponent(wsId)}`);
      return { __render: "action", data: { message: `Removed status entry ${wsId} from workflow "${workflowRef}"` } };
    }
    case "set-position": {
      const [workflowRef, wsId, positionRaw] = rest;
      if (!workflowRef || !wsId || !positionRaw) {
        throw new CliError("Usage: agentboard workflow set-position <workflow> <workflowStatusId> <position>");
      }
      const position = Number(positionRaw);
      if (Number.isNaN(position)) throw new CliError("Position must be a number");
      const workflowId = await resolveWorkflowId(state, workflowRef);
      await state.client.request("PATCH", `/workflows/${encodeURIComponent(workflowId)}/statuses/${encodeURIComponent(wsId)}/position`, { position });
      return { __render: "action", data: { message: `Position set to ${position} for ${wsId}` } };
    }
    case "set-merge": {
      const [workflowRef, wsId, valueRaw] = rest;
      if (!workflowRef || !wsId || !valueRaw) {
        throw new CliError("Usage: agentboard workflow set-merge <workflow> <workflowStatusId> <true|false>");
      }
      const workflowId = await resolveWorkflowId(state, workflowRef);
      await state.client.request("PATCH", `/workflows/${encodeURIComponent(workflowId)}/statuses/${encodeURIComponent(wsId)}/merge`, {
        triggersMerge: parseBooleanString(valueRaw),
      });
      return { __render: "action", data: { message: `Merge trigger set to ${valueRaw} for ${wsId}` } };
    }
    default:
      throw new CliError(`Unknown workflow command "${action}". Run "agentboard workflow help" for usage.`);
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
        agent: { type: "string" },
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
      const agentId = resolveAgentId(state, parsed.values.agent as string | undefined, false) ?? card.agentId ?? null;
      const branchName =
        (parsed.values.branch as string | undefined)
        ?? card.branchName
        ?? buildGeneratedBranchName(agentId, card);
      const created = await state.client.request<{ path: string; branchName: string; cardId: string }>("POST", "/worktrees", {
        cardId,
        repoId,
        branchName,
        baseBranch: parsed.values.base as string | undefined,
      });
      return {
        __render: "worktree",
        data: {
          ...created,
          cardRef: card.ref,
          baseBranch: parsed.values.base as string | undefined,
          note:
            !(parsed.values.base as string | undefined)
              ? "Base branch defaults to the repo's currently checked-out branch."
              : undefined,
        },
      };
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
      await state.client.request(
        "DELETE",
        `/worktrees/${encodeURIComponent(branchName)}${toQueryString({ repoId })}`
      );
      return { __render: "action", data: { message: `Worktree removed: ${branchName}` } };
    }
    default:
      throw new CliError(`Unknown worktree command "${action}". Run "agentboard worktree help" for usage.`);
  }
}
