import { helpText } from "./help";
import { handleCard, handleDependencies } from "./commands/cards";
import { handleInput, handleQueue } from "./commands/communication";
import { handleHealth, handleRaw } from "./commands/core";
import { handleEpic, handleFeature, handleRepo, handleStatus, handleWorkflow, handleWorktree } from "./commands/admin";
import { handleBootstrap, handleCheckpoint, handleFinish, handlePlan, handleStart } from "./commands/taskflow";
import { handleId } from "./commands/identity";
import { CliError } from "./core/errors";
import type { CommandState } from "./core/types";

export async function runCommand(state: CommandState, args: string[]) {
  const [command, ...rest] = args;

  if (!command || command === "help" || state.global.help) {
    return helpText();
  }

  switch (command) {
    case "health":
      return handleHealth(state);
    case "raw":
      return handleRaw(state, rest);
    case "start":
      return handleStart(state, rest);
    case "plan":
      return handlePlan(state, rest);
    case "checkpoint":
      return handleCheckpoint(state, rest);
    case "finish":
      return handleFinish(state, rest);
    case "bootstrap":
      return handleBootstrap(state, rest);
    case "cards":
    case "card":
      return handleCard(state, rest);
    case "dep":
    case "dependency":
    case "dependencies":
      return handleDependencies(state, rest);
    case "input":
      return handleInput(state, rest);
    case "queue":
      return handleQueue(state, rest);
    case "id":
      return handleId(state, rest);
    case "statuses":
    case "status":
      return handleStatus(state, rest);
    case "epics":
    case "epic":
      return handleEpic(state, rest);
    case "features":
    case "feature":
      return handleFeature(state, rest);
    case "repos":
    case "repo":
      return handleRepo(state, rest);
    case "workflows":
    case "workflow":
      return handleWorkflow(state, rest);
    case "worktrees":
    case "worktree":
      return handleWorktree(state, rest);
    case "inbox":
      return handleQueue(state, ["inbox", ...rest]);
    default:
      throw new CliError(`Unknown command "${command}". Run "agentboard help" for usage.`);
  }
}
