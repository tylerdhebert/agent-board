import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Card, Epic, Feature, Workflow } from "../../api/types";

export function EpicsSection() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: ["epics"],
    queryFn: async () => {
      const { data } = await api.api.epics.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: features = [] } = useQuery<Feature[]>({
    queryKey: ["features"],
    queryFn: async () => {
      const { data } = await api.api.features.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data } = await api.api.workflows.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data } = await api.api.cards.get();
      return data ?? [];
    },
    staleTime: 5_000,
  });

  const createEpicMutation = useMutation({
    mutationFn: async () => {
      const body: { title: string; description?: string; workflowId?: string } = {
        title: title.trim(),
      };
      if (description.trim()) body.description = description.trim();
      if (workflowId) body.workflowId = workflowId;
      const { data } = await api.api.epics.post(body);
      return data!;
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setWorkflowId("");
      queryClient.invalidateQueries({ queryKey: ["epics"] });
    },
  });

  const deleteEpic = async (epicId: string) => {
    await api.api.epics({ id: epicId }).delete();
    queryClient.invalidateQueries({ queryKey: ["epics"] });
    queryClient.invalidateQueries({ queryKey: ["features"] });
    queryClient.invalidateQueries({ queryKey: ["cards"] });
    setDeletingId(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createEpicMutation.mutate();
  };

  const featureCountForEpic = (epicId: string) =>
    features.filter((f) => f.epicId === epicId).length;

  const cardCountForEpic = (epicId: string) => {
    const featureIds = features.filter((f) => f.epicId === epicId).map((f) => f.id);
    return cards.filter(
      (c) => c.epicId === epicId || (c.featureId && featureIds.includes(c.featureId))
    ).length;
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div>
        <h3 className="text-[11px] font-mono text-[#475569] uppercase tracking-wider mb-3">
          Create Epic
        </h3>
        <form onSubmit={handleCreate} className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Epic title"
            className="w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <select
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            className="w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] transition-colors cursor-pointer"
          >
            <option value="">Workflow (optional)</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.type})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!title.trim() || createEpicMutation.isPending}
            className="px-4 py-2 bg-[#6366f1] hover:bg-[#818cf8] disabled:bg-[#1e1e2a] disabled:text-[#475569] text-white font-mono text-xs rounded-sm transition-colors"
          >
            {createEpicMutation.isPending ? "Creating..." : "Create Epic"}
          </button>
        </form>
      </div>

      {/* Existing epics */}
      <div>
        <h3 className="text-[11px] font-mono text-[#475569] uppercase tracking-wider mb-3">
          Existing Epics ({epics.length})
        </h3>
        {epics.length === 0 ? (
          <p className="text-[11px] font-mono text-[#334155]">No epics yet.</p>
        ) : (
          <div className="space-y-1">
            {epics.map((epic) => {
              const fCount = featureCountForEpic(epic.id);
              const cCount = cardCountForEpic(epic.id);
              const isConfirming = deletingId === epic.id;
              return (
                <div
                  key={epic.id}
                  className="bg-[#0d0d14] border border-[#1e1e2a] rounded-sm px-3 py-2 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-mono text-[#e2e8f0]">{epic.title}</p>
                      {epic.workflowId && (() => {
                        const wf = workflows.find((w) => w.id === epic.workflowId);
                        return wf ? (
                          <span className="text-[10px] font-mono px-1 py-0.5 rounded-sm border"
                            style={wf.type === "worktree"
                              ? { color: "#818cf8", borderColor: "#3a3a5a", backgroundColor: "#1a1a2e" }
                              : { color: "#475569", borderColor: "#2a2a38", backgroundColor: "#1a1a24" }}
                          >
                            {wf.name}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    {epic.description && (
                      <p className="text-[11px] font-mono text-[#475569] mt-0.5 truncate">
                        {epic.description}
                      </p>
                    )}
                    <p className="text-[10px] font-mono text-[#334155] mt-0.5">
                      {fCount} feature{fCount !== 1 ? "s" : ""} · {cCount} card{cCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {!isConfirming ? (
                    <button
                      onClick={() => setDeletingId(epic.id)}
                      className="text-[11px] font-mono text-[#64748b] hover:text-[#f87171] transition-colors shrink-0"
                    >
                      Delete
                    </button>
                  ) : (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-[10px] font-mono text-[#f87171]">
                        Deletes {fCount} feature{fCount !== 1 ? "s" : ""} + {cCount} card{cCount !== 1 ? "s" : ""}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteEpic(epic.id)}
                          className="px-2 py-0.5 bg-[#3b1f1f] border border-[#7f1d1d] hover:bg-[#5c1f1f] text-[#f87171] font-mono text-[11px] rounded-sm transition-colors"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
