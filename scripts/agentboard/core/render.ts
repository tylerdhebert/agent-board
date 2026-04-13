import type { CardContextData, QueueMessage, RenderEnvelope } from "./types";

// ── Utilities ──────────────────────────────────────────────────────────────────

function padCell(value: string, width: number) {
  return value.padEnd(width, " ");
}

export function renderTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i]?.length ?? 0)));
  return rows
    .map((row) =>
      row.map((cell, ci) => padCell(cell ?? "", widths[ci])).join("  ").trimEnd()
    )
    .join("\n");
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return "-";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(diff)) return iso;
  if (diff < 60) return `${Math.max(0, Math.floor(diff))}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function unwrapRenderable(value: unknown): unknown {
  if (value && typeof value === "object" && "__render" in value && "data" in value) {
    return (value as RenderEnvelope).data;
  }
  return value;
}

// ── Generic types ──────────────────────────────────────────────────────────────

function renderRecord(data: unknown): string {
  if (!data || typeof data !== "object") return String(data ?? "");
  const entries = Object.entries(data as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  if (entries.length === 0) return "(empty)";
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join("\n");
}

function renderAction(data: unknown): string {
  if (data && typeof data === "object" && "message" in data) {
    return String((data as { message: string }).message);
  }
  return String(data ?? "OK");
}

// ── Card types ─────────────────────────────────────────────────────────────────

function renderCardList(data: unknown): string {
  if (!Array.isArray(data)) return renderRecord(data);
  if (data.length === 0) return "No cards.";
  const rows = [
    ["REF", "STATUS", "TITLE", "AGENT", "UPDATED"],
    ...data.map((card) => {
      const c = card as Record<string, unknown>;
      return [
        String(c.ref ?? "-"),
        String(c.statusName ?? "-"),
        String(c.title ?? "-"),
        String(c.agentId ?? "unassigned"),
        formatRelative(c.updatedAt as string | undefined),
      ];
    }),
  ];
  return renderTable(rows);
}

function renderCardDetail(data: unknown): string {
  const ctx = data as CardContextData;
  const lines = [
    `Ref: ${ctx.card.ref}`,
    `Title: ${ctx.card.title}`,
    `Status: ${ctx.statusName}`,
    `Agent: ${ctx.card.agentId ?? "Unassigned"}`,
    `Feature: ${ctx.featureRef ? `${ctx.featureRef} / ${ctx.featureTitle ?? "-"}` : (ctx.featureTitle ?? "-")}`,
    `Epic: ${ctx.epicTitle ?? "-"}`,
    `Created: ${formatRelative(ctx.card.createdAt)}`,
    `Updated: ${formatRelative(ctx.card.updatedAt)}`,
  ];
  return lines.join("\n");
}

function renderCardContext(data: unknown): string {
  const ctx = data as CardContextData;
  const lines = [
    `Card: ${ctx.card.title}`,
    `Ref: ${ctx.card.ref}`,
    `Status: ${ctx.statusName}`,
    `Feature: ${ctx.featureRef ? `${ctx.featureRef} / ${ctx.featureTitle ?? "-"}` : (ctx.featureTitle ?? "-")}`,
    `Epic: ${ctx.epicTitle ?? "-"}`,
    `Agent: ${ctx.card.agentId ?? "Unassigned"}`,
    `Blocked: ${ctx.blocked ? "yes" : "no"}`,
    `Waiting on input: ${ctx.waitingOnInput ? "yes" : "no"}`,
  ];
  if (ctx.card.description) lines.push(`Description: ${ctx.card.description}`);
  if (ctx.card.blockedReason) lines.push(`Blocked reason: ${ctx.card.blockedReason}`);
  if (ctx.card.plan) lines.push(`Plan: ${ctx.card.plan}`);
  if (ctx.card.latestUpdate) lines.push(`Latest update: ${ctx.card.latestUpdate}`);
  if (ctx.card.handoffSummary) lines.push(`Handoff: ${ctx.card.handoffSummary}`);
  if (ctx.pendingInputPrompts.length > 0) {
    lines.push(`Pending input: ${ctx.pendingInputPrompts.join(" | ")}`);
  }
  if (ctx.blockers.length > 0) {
    lines.push(`Blockers: ${ctx.blockers.map((b) => b.ref ?? b.id).join(", ")}`);
  }
  if (ctx.blocking.length > 0) {
    lines.push(`Blocking: ${ctx.blocking.map((b) => b.ref ?? b.id).join(", ")}`);
  }
  if (ctx.repoName) lines.push(`Repo: ${ctx.repoName}`);
  if (ctx.repoBaseBranch) lines.push(`Repo base branch: ${ctx.repoBaseBranch}`);
  if (ctx.featureBranchName) lines.push(`Feature base branch: ${ctx.featureBranchName}`);
  if (ctx.suggestedBranchName) lines.push(`Suggested card branch: ${ctx.suggestedBranchName}`);
  if (ctx.card.branchName) lines.push(`Card branch: ${ctx.card.branchName}`);
  if (ctx.card.conflictedAt) {
    lines.push(`Conflicted: yes (since ${formatRelative(ctx.card.conflictedAt)})`);
  }
  if (ctx.card.conflictDetails) lines.push(`Conflict details: ${ctx.card.conflictDetails}`);
  if (ctx.recentComments.length > 0) {
    lines.push("Recent comments:");
    for (const c of ctx.recentComments) {
      lines.push(`  [${c.agentId ?? c.author}] ${c.body}`);
    }
  }
  return lines.join("\n");
}

function renderCardDiff(data: unknown): string {
  const payload = data as Record<string, unknown>;
  const lines: string[] = [];
  if (payload.baseBranch) lines.push(`base: ${String(payload.baseBranch)}`);
  if (payload.branchName) lines.push(`branch: ${String(payload.branchName)}`);
  if (payload.stat) lines.push(`stat: ${String(payload.stat)}`);
  if (lines.length > 0) lines.push("");
  lines.push(String(payload.diff ?? ""));
  return lines.join("\n");
}

function renderTaskflow(data: unknown): string {
  const payload = data as Record<string, unknown>;
  const card = payload.card as Record<string, unknown> | undefined;
  const inboxMessages = Array.isArray(payload.inboxMessages)
    ? payload.inboxMessages as QueueMessage[]
    : [];
  const lines = [
    `${String(payload.action ?? "Updated")} ${String(card?.ref ?? card?.id ?? "card")}`,
  ];
  if (card?.title) lines.push(`Title: ${String(card.title)}`);
  if (payload.statusName) lines.push(`Status: ${String(payload.statusName)}`);
  if (card?.branchName) {
    lines.push(`Branch: ${String(card.branchName)}`);
    if (payload.action === "Started") {
      lines.push(`Note: finish will auto-select "Ready to Merge" for this branch-backed card. Use --status "Done" to override.`);
    }
  }
  if (typeof payload.inboxCount === "number") lines.push(`Inbox: ${payload.inboxCount} pending`);
  if (inboxMessages.length > 0) {
    lines.push("Inbox messages:");
    for (const message of inboxMessages) {
      lines.push(`  [${formatRelative(message.createdAt)}] ${message.body}`);
    }
  }
  if (payload.note) lines.push(String(payload.note));
  return lines.join("\n");
}

function renderWorktree(data: unknown): string {
  const payload = data as Record<string, unknown>;
  const lines = [
    `Worktree ready for ${String(payload.cardRef ?? payload.cardId ?? "card")}`,
    `Branch: ${String(payload.branchName ?? "-")}`,
    `Path: ${String(payload.path ?? "-")}`,
  ];
  if (payload.baseBranch) lines.push(`Base: ${String(payload.baseBranch)}`);
  if (payload.note) lines.push(String(payload.note));
  return lines.join("\n");
}

// ── Dep types ──────────────────────────────────────────────────────────────────

function renderDepList(data: unknown): string {
  const payload = data as Record<string, unknown>;
  const blockers = Array.isArray(payload.blockers) ? payload.blockers : [];
  const blocking = Array.isArray(payload.blocking) ? payload.blocking : [];
  const lines: string[] = [];
  if (blockers.length > 0) {
    lines.push("Blockers:");
    for (const b of blockers as Array<Record<string, unknown>>) {
      lines.push(`  ${String(b.ref ?? b.id ?? "-")}  ${String(b.statusName ?? "-")}  ${String(b.title ?? "-")}`);
    }
  }
  if (blocking.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("Blocking:");
    for (const b of blocking as Array<Record<string, unknown>>) {
      lines.push(`  ${String(b.ref ?? b.id ?? "-")}  ${String(b.statusName ?? "-")}  ${String(b.title ?? "-")}`);
    }
  }
  return lines.length === 0 ? "No dependencies." : lines.join("\n");
}

function renderDepBoard(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) return "No dependencies.";
  const rows = [
    ["BLOCKER", "STATUS", "TITLE", "→", "DEPENDENT"],
    ...data.map((e) => {
      const entry = e as Record<string, unknown>;
      const from = String(entry.blockerRef ?? entry.blockerCardRef ?? entry.blockerId ?? "-");
      const to = String(entry.cardRef ?? entry.dependentRef ?? entry.cardId ?? "-");
      const status = String(entry.blockerStatusName ?? entry.statusName ?? "-");
      const title = String(entry.blockerTitle ?? entry.title ?? "-");
      return [from, status, title, "→", to];
    }),
  ];
  return renderTable(rows);
}

// ── Admin types ────────────────────────────────────────────────────────────────

function renderStatusList(data: unknown): string {
  if (!Array.isArray(data)) return renderRecord(data);
  if (data.length === 0) return "No statuses.";
  const rows = [
    ["NAME", "COLOR", "POSITION", "CORE"],
    ...data.map((s) => {
      const st = s as Record<string, unknown>;
      return [
        String(st.name ?? "-"),
        String(st.color ?? "-"),
        String(st.position ?? "-"),
        st.isCore ? "yes" : "no",
      ];
    }),
  ];
  return renderTable(rows);
}

function renderEpicList(data: unknown): string {
  if (!Array.isArray(data)) return renderRecord(data);
  if (data.length === 0) return "No epics.";
  const rows = [
    ["TITLE", "STATUS"],
    ...data.map((e) => {
      const epic = e as Record<string, unknown>;
      return [String(epic.title ?? "-"), String(epic.statusName ?? "-")];
    }),
  ];
  return renderTable(rows);
}

function renderFeatureList(data: unknown): string {
  if (!Array.isArray(data)) return renderRecord(data);
  if (data.length === 0) return "No features.";
  const rows = [
    ["REF", "TITLE", "REPO", "BRANCH"],
    ...data.map((f) => {
      const feat = f as Record<string, unknown>;
      return [
        String(feat.ref ?? "-"),
        String(feat.title ?? "-"),
        String(feat.repoName ?? "-"),
        String(feat.branchName ?? "-"),
      ];
    }),
  ];
  return renderTable(rows);
}

function renderRepoList(data: unknown): string {
  if (!Array.isArray(data)) return renderRecord(data);
  if (data.length === 0) return "No repos.";
  const rows = [
    ["NAME", "PATH", "BASE"],
    ...data.map((r) => {
      const repo = r as Record<string, unknown>;
      return [String(repo.name ?? "-"), String(repo.path ?? "-"), String(repo.baseBranch ?? "-")];
    }),
  ];
  return renderTable(rows);
}

function renderWorkflowList(data: unknown): string {
  if (!Array.isArray(data)) return renderRecord(data);
  if (data.length === 0) return "No workflows.";
  const rows = [
    ["NAME", "TYPE"],
    ...data.map((w) => {
      const wf = w as Record<string, unknown>;
      return [String(wf.name ?? "-"), String(wf.type ?? "-")];
    }),
  ];
  return renderTable(rows);
}

function renderWorkflowStatuses(data: unknown): string {
  if (!Array.isArray(data)) return renderRecord(data);
  if (data.length === 0) return "No statuses in workflow.";
  const rows = [
    ["STATUS", "POSITION", "TRIGGERS-MERGE"],
    ...data.map((ws) => {
      const w = ws as Record<string, unknown>;
      return [
        String(w.name ?? w.statusName ?? w.statusId ?? "-"),
        String(w.position ?? "-"),
        w.triggersMerge ? "yes" : "no",
      ];
    }),
  ];
  return renderTable(rows);
}

function renderCommitList(data: unknown): string {
  if (!Array.isArray(data)) return renderRecord(data);
  if (data.length === 0) return "No commits.";
  const rows = [
    ["HASH", "AUTHOR", "MESSAGE", "DATE"],
    ...data.map((c) => {
      const commit = c as Record<string, unknown>;
      return [
        String(commit.hash ?? "-").slice(0, 7),
        String(commit.authorEmail ?? commit.author ?? "-"),
        String(commit.subject ?? commit.message ?? "-"),
        formatRelative(commit.date as string | undefined),
      ];
    }),
  ];
  return renderTable(rows);
}

function renderCommitDetail(data: unknown): string {
  const payload = data as Record<string, unknown>;
  const lines = [
    `hash: ${String(payload.hash ?? "-")}`,
    `author: ${String(payload.authorEmail ?? payload.author ?? "-")}`,
    `message: ${String(payload.subject ?? payload.message ?? "-")}`,
    `date: ${formatRelative(payload.date as string | undefined)}`,
    "",
    String(payload.diff ?? payload.patch ?? ""),
  ];
  return lines.join("\n");
}

function renderBootstrap(data: unknown): string {
  const payload = data as Record<string, unknown>;
  const epic = payload.epic as Record<string, unknown> | undefined;
  const feature = payload.feature as Record<string, unknown> | undefined;
  const card = payload.card as Record<string, unknown> | undefined;
  const lines: string[] = [];
  if (epic) {
    lines.push(`Epic: "${String(epic.title ?? "-")}" (${payload.epicCreated ? "created" : "existing"})`);
  }
  if (feature) {
    const ref = feature.ref ? `${String(feature.ref)} ` : "";
    lines.push(`Feature: ${ref}"${String(feature.title ?? "-")}" (${payload.featureCreated ? "created" : "existing"})`);
  }
  if (card) {
    const status = String(payload.statusName ?? card.statusId ?? "-");
    const agent = card.agentId ? ` (claimed by ${String(card.agentId)})` : "";
    lines.push(`Card: ${String(card.ref ?? card.id ?? "-")} "${String(card.title ?? "-")}" → ${status}${agent}`);
  }
  return lines.join("\n");
}

// ── Queue types ────────────────────────────────────────────────────────────────

function renderQueueList(data: unknown): string {
  if (!Array.isArray(data)) return renderRecord(data);
  if (data.length === 0) return "No messages.";
  return (data as QueueMessage[])
    .map((m) => `[${formatRelative(m.createdAt)}] ${m.author}: ${m.body}`)
    .join("\n");
}

// ── Input types ────────────────────────────────────────────────────────────────

function renderInputList(data: unknown): string {
  if (!Array.isArray(data)) return renderRecord(data);
  if (data.length === 0) return "No input requests.";
  const rows = [
    ["ID", "CARD", "AGENT", "STATUS", "PROMPT"],
    ...data.map((req) => {
      const r = req as Record<string, unknown>;
      const questions = Array.isArray(r.questions) ? r.questions : [];
      const firstPrompt =
        questions.length > 0
          ? String((questions[0] as Record<string, unknown>).prompt ?? "-")
          : "-";
      return [
        String(r.id ?? "-").slice(0, 8),
        String(r.cardId ?? "-"),
        String(r.agentId ?? "-"),
        String(r.status ?? "-"),
        firstPrompt.slice(0, 60),
      ];
    }),
  ];
  return renderTable(rows);
}

function renderInputRecord(data: unknown): string {
  const r = data as Record<string, unknown>;
  const lines: string[] = [];
  lines.push(`id: ${String(r.requestId ?? r.id ?? "-")}`);
  lines.push(`status: ${String(r.status ?? "-")}`);
  const request = r.request as Record<string, unknown> | undefined;
  const cardId = request?.cardId ?? r.cardId;
  const agentId = request?.agentId ?? r.agentId;
  if (cardId) lines.push(`card: ${String(cardId)}`);
  if (agentId) lines.push(`agent: ${String(agentId)}`);
  if (r.answers && typeof r.answers === "object") {
    for (const [k, v] of Object.entries(r.answers as Record<string, string>)) {
      lines.push(`answer.${k}: ${String(v)}`);
    }
  }
  return lines.join("\n");
}

// ── Registry + dispatcher ──────────────────────────────────────────────────────

export const renderers = new Map<string, (data: unknown) => string>([
  ["card-list",           renderCardList],
  ["card-context",        renderCardContext],
  ["card-detail",         renderCardDetail],
  ["card-diff",           renderCardDiff],
  ["feature-list",        renderFeatureList],
  ["taskflow",            renderTaskflow],
  ["worktree",            renderWorktree],
  ["dep-list",            renderDepList],
  ["dep-board",           renderDepBoard],
  ["record",              renderRecord],
  ["action",              renderAction],
  ["status-list",         renderStatusList],
  ["epic-list",           renderEpicList],
  ["repo-list",           renderRepoList],
  ["workflow-list",       renderWorkflowList],
  ["workflow-statuses",   renderWorkflowStatuses],
  ["commit-list",         renderCommitList],
  ["commit-detail",       renderCommitDetail],
  ["bootstrap",           renderBootstrap],
  ["queue-list",          renderQueueList],
  ["input-list",          renderInputList],
  ["input-record",        renderInputRecord],
]);

export function renderKnown(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const render = "__render" in value ? (value as RenderEnvelope).__render : null;
  const data = "__render" in value ? (value as RenderEnvelope).data : value;
  if (!render) return null;
  const fn = renderers.get(render);
  return fn ? fn(data) : null;
}
