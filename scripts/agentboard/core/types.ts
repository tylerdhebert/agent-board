import type { AgentBoardClient } from "./client";

export type OptionType = "string" | "boolean" | "number" | "string[]";

export interface OptionSpec {
  type: OptionType;
  alias?: string[];
  default?: unknown;
}

export interface ParsedArgs {
  values: Record<string, unknown>;
  positionals: string[];
}

export interface GlobalOptions {
  url?: string;
  json?: boolean;
  help?: boolean;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
  createdAt?: string;
}

export interface Workflow {
  id: string;
  name: string;
  type: string;
}

export interface Repo {
  id: string;
  name: string;
  path: string;
  baseBranch: string;
  buildCommand?: string | null;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  statusId?: string | null;
  workflowId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Feature {
  id: string;
  ref: string;
  refNum: number;
  epicId: string;
  title: string;
  description: string;
  statusId?: string | null;
  repoId?: string | null;
  branchName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Card {
  id: string;
  ref: string;
  refNum: number;
  featureId: string;
  epicId?: string | null;
  repoId?: string | null;
  type: "task" | "story" | "bug";
  title: string;
  description: string;
  statusId: string;
  agentId?: string | null;
  plan?: string | null;
  latestUpdate?: string | null;
  handoffSummary?: string | null;
  blockedReason?: string | null;
  branchName?: string | null;
  completedAt?: string | null;
  conflictedAt?: string | null;
  conflictDetails?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface QueueMessage {
  id: string;
  agentId: string;
  body: string;
  status: "pending" | "read";
  author: string;
  createdAt: string;
  readAt?: string | null;
}

export interface Comment {
  id: string;
  cardId: string;
  author: "agent" | "user";
  agentId?: string | null;
  body: string;
  createdAt: string;
}

export interface InputQuestion {
  id: string;
  type: "text" | "yesno" | "choice";
  prompt: string;
  default?: string;
  options?: string[];
}

export interface InputRequestRecord {
  id: string;
  cardId: string;
  previousStatusId?: string | null;
  questions: InputQuestion[];
  answers?: Record<string, string> | null;
  status: "pending" | "answered" | "timed_out";
  requestedAt: string;
  answeredAt?: string | null;
  timeoutSecs: number;
}

export interface CardDependencyEntry {
  id: string;
  ref: string | null;
  title: string;
  statusId: string;
  statusName: string;
}

export interface CardDependencies {
  blockers: CardDependencyEntry[];
  blocking: CardDependencyEntry[];
}

export interface CardContextData {
  card: Card;
  statusName: string;
  featureTitle: string | null;
  featureRef: string | null;
  epicTitle: string | null;
  blocked: boolean;
  waitingOnInput: boolean;
  pendingInputPrompts: string[];
  blockers: CardDependencyEntry[];
  blocking: CardDependencyEntry[];
  repoName: string | null;
  repoPath: string | null;
  repoBaseBranch: string | null;
  featureBranchName: string | null;
  suggestedBranchName: string | null;
  recentComments: Comment[];
}

export interface RenderEnvelope<T = unknown> {
  __render: string;
  data: T;
}

export interface CommandState {
  client: AgentBoardClient;
  global: GlobalOptions;
  cache: {
    statuses?: Status[];
    epics?: Epic[];
    features?: Feature[];
    cards?: Card[];
    repos?: Repo[];
    workflows?: Workflow[];
  };
}
