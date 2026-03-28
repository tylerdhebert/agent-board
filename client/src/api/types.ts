// Shared types mirroring the server schema — used on the client side
import type { WorkflowType } from "@server";

export interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
  createdAt: string;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  statusId: string | null;
  workflowId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Feature {
  id: string;
  epicId: string;
  title: string;
  description: string;
  statusId: string | null;
  repoId: string | null;
  branchName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  featureId: string | null;
  epicId: string | null;
  repoId?: string | null;
  type: "story" | "bug" | "task";
  title: string;
  description: string;
  statusId: string;
  agentId: string | null;
  branchName?: string | null;
  completedAt: string | null;
  conflictedAt: string | null;
  conflictDetails: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CardWithComments extends Card {
  comments: Comment[];
}

export interface Comment {
  id: string;
  cardId: string;
  author: "agent" | "user";
  body: string;
  createdAt: string;
}

export type QuestionType = "text" | "yesno" | "choice";

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  default?: string;
  options?: string[];
}

export interface InputRequest {
  id: string;
  cardId: string;
  questions: Question[];
  answers: Record<string, string> | null;
  status: "pending" | "answered" | "timed_out";
  requestedAt: string;
  answeredAt: string | null;
  timeoutSecs: number;
}

export interface TransitionRule {
  id: string;
  agentPattern: string | null;
  fromStatusId: string | null;
  toStatusId: string;
  createdAt: string;
}

export interface QueueMessage {
  id: string;
  agentId: string;
  body: string;
  status: "pending" | "read";
  author: string;
  createdAt: string;
  readAt: string | null;
}

export interface KeyboardShortcut {
  id: string;
  action: string;
  label: string;
  group: string;
  shortcut: string | null;
  defaultShortcut: string | null;
}

export interface Repo {
  id: string;
  name: string;
  path: string;
  baseBranch: string;
  compareBase: string | null;
  buildCommand: string | null;
  createdAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  type: WorkflowType;
  createdAt: string;
}

export interface WorkflowStatus {
  id: string;
  workflowId: string;
  statusId: string;
  position: number;
  triggersMerge: boolean;
  name: string;
  color: string;
}

export interface Commit {
  hash: string;
  author: string;
  subject: string;
  date: string;
}

export interface CommitDetail extends Commit {
  diff: string;
}

export interface Conversation {
  agentId: string;
  total: number;
  unread: number;
  lastAt: string;
}

export interface CardDependency {
  id: string;
  blockerCardId: string;
  blockedCardId: string;
}

export interface DependencyInfo {
  blockers: { id: string; title: string; statusId: string; statusName: string }[];
  blocking: { id: string; title: string; statusId: string; statusName: string }[];
}

export interface BuildResult {
  id: string;
  featureId: string;
  status: "running" | "passed" | "failed";
  output: string | null;
  triggeredAt: string;
  completedAt: string | null;
}

export type WsEvent =
  | "card:created"
  | "card:updated"
  | "card:deleted"
  | "card:unblocked"
  | "card:dependency:added"
  | "card:dependency:removed"
  | "comment:created"
  | "input:requested"
  | "input:answered"
  | "input:timed_out"
  | "status:created"
  | "status:updated"
  | "status:deleted"
  | "epic:created"
  | "epic:updated"
  | "epic:deleted"
  | "feature:created"
  | "feature:updated"
  | "feature:deleted"
  | "queue:created"
  | "queue:read"
  | "queue:deleted"
  | "build:started"
  | "build:completed"
  | "card:conflicted";

export interface WsMessage {
  event: WsEvent;
  data: unknown;
}
