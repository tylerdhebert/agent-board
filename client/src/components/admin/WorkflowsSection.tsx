import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Status, Workflow, WorkflowStatus } from "../../api/types";
import { selectCls, sectionHeadingCls, primaryBtnCls } from "./adminStyles";

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
        <p className="text-[11px] font-mono text-[#334155]">No workflows configured.</p>
      ) : (
        <div className="space-y-1">
          {workflows.map((workflow) => (
            <WorkflowRow
              key={workflow.id}
              workflow={workflow}
              expanded={expandedId === workflow.id}
              onToggle={() =>
                setExpandedId(expandedId === workflow.id ? null : workflow.id)
              }
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
    mutationFn: async ({ wsId, newPosition, swapWsId, swapPosition }: {
      wsId: string;
      newPosition: number;
      swapWsId: string;
      swapPosition: number;
    }) => {
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

  const handleMoveUp = (idx: number) => {
    const current = sortedStatuses[idx];
    const prev = sortedStatuses[idx - 1];
    reorderMutation.mutate({
      wsId: current.id,
      newPosition: prev.position,
      swapWsId: prev.id,
      swapPosition: current.position,
    });
  };

  const handleMoveDown = (idx: number) => {
    const current = sortedStatuses[idx];
    const next = sortedStatuses[idx + 1];
    reorderMutation.mutate({
      wsId: current.id,
      newPosition: next.position,
      swapWsId: next.id,
      swapPosition: current.position,
    });
  };

  const handleAdd = () => {
    if (!selectedStatusId) return;
    addMutation.mutate(selectedStatusId);
  };

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2a] rounded-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#111118] transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`transition-transform duration-150 text-[#475569] shrink-0 ${expanded ? "rotate-90" : ""}`}
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
        <span className="flex-1 text-[12px] font-mono text-[#e2e8f0]">{workflow.name}</span>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm border shrink-0"
          style={
            workflow.type === "worktree"
              ? { color: "#818cf8", borderColor: "#3a3a5a", backgroundColor: "#1a1a2e" }
              : { color: "#475569", borderColor: "#2a2a38", backgroundColor: "#1a1a24" }
          }
        >
          {workflow.type}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[#1e1e2a] px-3 py-2 space-y-2">
          {isLoading ? (
            <div className="space-y-1.5 py-1">
              <div className="h-3 bg-[#1a1a24] rounded animate-pulse" />
              <div className="h-3 bg-[#1a1a24] rounded animate-pulse w-4/5" />
            </div>
          ) : sortedStatuses.length === 0 ? (
            <p className="text-[11px] font-mono text-[#334155] py-1">No statuses assigned.</p>
          ) : (
            <div className="space-y-1 py-1">
              {sortedStatuses.map((ws, idx) => (
                <div
                  key={ws.id}
                  className="flex items-center gap-2 bg-[#0a0a0f] border border-[#1e1e2a] rounded-sm px-2 py-1.5"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: ws.color }}
                  />
                  <span className="flex-1 text-[11px] font-mono text-[#94a3b8]">
                    {ws.name}
                  </span>
                  <button
                    onClick={() => mergeMutation.mutate({ wsId: ws.id, triggersMerge: !ws.triggersMerge })}
                    disabled={mergeMutation.isPending}
                    title="Toggle triggers merge"
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm border transition-colors ${
                      ws.triggersMerge
                        ? "text-[#4ade80] bg-[#0d2e0d] border-[#1a5c1a] hover:bg-[#162e16]"
                        : "text-[#334155] bg-[#0a0a0f] border-[#1e1e2a] hover:border-[#2a2a38] hover:text-[#475569]"
                    }`}
                  >
                    merge
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0 || reorderMutation.isPending}
                      className="text-[11px] font-mono text-[#475569] hover:text-[#94a3b8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors w-5 text-center"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === sortedStatuses.length - 1 || reorderMutation.isPending}
                      className="text-[11px] font-mono text-[#475569] hover:text-[#94a3b8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors w-5 text-center"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(ws.id)}
                      disabled={deleteMutation.isPending}
                      className="text-[11px] font-mono text-[#475569] hover:text-[#f87171] disabled:opacity-30 disabled:cursor-not-allowed transition-colors w-5 text-center"
                      title="Remove from workflow"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add status row */}
          <div className="flex gap-2 items-center pt-1 border-t border-[#1e1e2a]">
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
              onClick={handleAdd}
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
