import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Status, Workflow, WorkflowStatus } from "../../api/types";
import { primaryBtnCls, sectionHeadingCls, selectCls } from "./adminStyles";

export function WorkflowsSection() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data } = await api.api.workflows.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
      <h3 className={sectionHeadingCls}>Workflows ({workflows.length})</h3>

      {workflows.length === 0 ? (
        <p className="text-[11px] font-mono text-[var(--text-dim)]">No workflows configured.</p>
      ) : (
        <div className="space-y-2">
          {workflows.map((workflow) => (
            <WorkflowRow
              key={workflow.id}
              workflow={workflow}
              expanded={expandedId === workflow.id}
              onToggle={() => setExpandedId(expandedId === workflow.id ? null : workflow.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface WorkflowRowProps {
  workflow: Workflow;
  expanded: boolean;
  onToggle: () => void;
}

function WorkflowRow({ workflow, expanded, onToggle }: WorkflowRowProps) {
  const queryClient = useQueryClient();
  const [selectedStatusId, setSelectedStatusId] = useState("");

  const { data: workflowStatuses = [], isLoading } = useQuery<WorkflowStatus[]>({
    queryKey: ["workflow-statuses", workflow.id],
    queryFn: async () => {
      const { data } = await api.api.workflows({ id: workflow.id }).statuses.get();
      return (data as WorkflowStatus[]) ?? [];
    },
    enabled: expanded,
    staleTime: 30_000,
  });

  const { data: allStatuses = [] } = useQuery<Status[]>({
    queryKey: ["statuses"],
    queryFn: async () => {
      const { data } = await api.api.statuses.get();
      return data ?? [];
    },
    enabled: expanded,
    staleTime: 30_000,
  });

  const sortedStatuses = [...workflowStatuses].sort((a, b) => a.position - b.position);
  const usedStatusIds = new Set(sortedStatuses.map((ws) => ws.statusId));
  const availableStatuses = allStatuses.filter((s) => !usedStatusIds.has(s.id));

  const reorderMutation = useMutation({
    mutationFn: async ({ wsId, newPosition, swapWsId, swapPosition }: { wsId: string; newPosition: number; swapWsId: string; swapPosition: number }) => {
      await Promise.all([
        (api.api.workflows({ id: workflow.id }) as any).statuses({ wsId }).position.patch({ position: newPosition }),
        (api.api.workflows({ id: workflow.id }) as any).statuses({ wsId: swapWsId }).position.patch({ position: swapPosition }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-statuses", workflow.id] });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ wsId, triggersMerge }: { wsId: string; triggersMerge: boolean }) => {
      await (api.api.workflows({ id: workflow.id }) as any).statuses({ wsId }).merge.patch({ triggersMerge });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-statuses", workflow.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (wsId: string) => {
      await (api.api.workflows({ id: workflow.id }) as any).statuses({ wsId }).delete();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-statuses", workflow.id] });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (statusId: string) => {
      await (api.api.workflows({ id: workflow.id }) as any).statuses.post({ statusId });
    },
    onSuccess: () => {
      setSelectedStatusId("");
      queryClient.invalidateQueries({ queryKey: ["workflow-statuses", workflow.id] });
    },
  });

  function handleMoveUp(idx: number) {
    const current = sortedStatuses[idx];
    const prev = sortedStatuses[idx - 1];
    reorderMutation.mutate({
      wsId: current.id,
      newPosition: prev.position,
      swapWsId: prev.id,
      swapPosition: current.position,
    });
  }

  function handleMoveDown(idx: number) {
    const current = sortedStatuses[idx];
    const next = sortedStatuses[idx + 1];
    reorderMutation.mutate({
      wsId: current.id,
      newPosition: next.position,
      swapWsId: next.id,
      swapPosition: current.position,
    });
  }

  return (
    <div className="surface-panel overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--accent-surface)]"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`shrink-0 text-[var(--text-faint)] transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        >
          <path
            d="M3 2l4 3-4 3"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="flex-1 text-[12px] font-mono text-[var(--text-primary)]">{workflow.name}</span>
        <span
          className="rounded-full border px-2 py-1 text-[10px] font-mono shrink-0"
          style={
            workflow.type === "worktree"
              ? { color: "var(--accent-strong)", borderColor: "var(--accent-border)", backgroundColor: "var(--accent-surface)" }
              : { color: "var(--text-faint)", borderColor: "var(--border)", backgroundColor: "var(--panel-ink)" }
          }
        >
          {workflow.type}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-soft)] px-4 py-3">
          {isLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-3 rounded-full bg-[var(--panel-hover)] animate-pulse" />
              <div className="h-3 w-4/5 rounded-full bg-[var(--panel-hover)] animate-pulse" />
            </div>
          ) : sortedStatuses.length === 0 ? (
            <p className="py-1 text-[11px] font-mono text-[var(--text-dim)]">No statuses assigned.</p>
          ) : (
            <div className="space-y-2 py-1">
              {sortedStatuses.map((ws, idx) => (
                <div
                  key={ws.id}
                  className="flex items-center gap-2 rounded-[16px] border border-[var(--border-soft)] bg-[var(--panel-ink)] px-3 py-2"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ws.color }} />
                  <span className="flex-1 text-[11px] font-mono text-[var(--text-secondary)]">{ws.name}</span>
                  <button
                    type="button"
                    onClick={() => mergeMutation.mutate({ wsId: ws.id, triggersMerge: !ws.triggersMerge })}
                    disabled={mergeMutation.isPending}
                    title="Toggle triggers merge"
                    className={`rounded-full border px-2 py-1 text-[10px] font-mono transition-colors ${
                      ws.triggersMerge
                        ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
                        : "border-[var(--border)] bg-transparent text-[var(--text-faint)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    merge
                  </button>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0 || reorderMutation.isPending}
                      className="text-[11px] font-mono text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move up"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === sortedStatuses.length - 1 || reorderMutation.isPending}
                      className="text-[11px] font-mono text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move down"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(ws.id)}
                      disabled={deleteMutation.isPending}
                      className="text-[11px] font-mono text-[var(--text-muted)] transition-colors hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-30"
                      title="Remove from workflow"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 border-t border-[var(--border-soft)] pt-3">
            <select
              value={selectedStatusId}
              onChange={(e) => setSelectedStatusId(e.target.value)}
              className={selectCls.replace("w-full", "flex-1").replace("text-xs", "text-[11px]")}
            >
              <option value="">Add a status...</option>
              {availableStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => selectedStatusId && addMutation.mutate(selectedStatusId)}
              disabled={!selectedStatusId || addMutation.isPending}
              className={`${primaryBtnCls} shrink-0`}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
