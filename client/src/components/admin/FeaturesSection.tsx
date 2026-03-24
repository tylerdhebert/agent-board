import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../../api/client";
import type { Card, Epic, Feature } from "../../api/types";

export function FeaturesSection() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEpicId, setSelectedEpicId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: ["epics"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/epics`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: features = [] } = useQuery<Feature[]>({
    queryKey: ["features"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/features`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/cards`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5_000,
  });

  const createFeatureMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          epicId: selectedEpicId || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create feature");
      return res.json();
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setSelectedEpicId("");
      queryClient.invalidateQueries({ queryKey: ["features"] });
    },
  });

  const deleteFeature = async (featureId: string) => {
    await fetch(`${API_BASE}/features/${featureId}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["features"] });
    queryClient.invalidateQueries({ queryKey: ["cards"] });
    setDeletingId(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createFeatureMutation.mutate();
  };

  const epicForFeature = (epicId: string) => epics.find((e) => e.id === epicId);
  const cardCountForFeature = (featureId: string) =>
    cards.filter((c) => c.featureId === featureId).length;

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div>
        <h3 className="text-[11px] font-mono text-[#475569] uppercase tracking-wider mb-3">
          Create Feature
        </h3>
        <form onSubmit={handleCreate} className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Feature title"
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
            value={selectedEpicId}
            onChange={(e) => setSelectedEpicId(e.target.value)}
            className="w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] transition-colors cursor-pointer"
          >
            <option value="">No epic (unassigned)</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!title.trim() || createFeatureMutation.isPending}
            className="px-4 py-2 bg-[#6366f1] hover:bg-[#818cf8] disabled:bg-[#1e1e2a] disabled:text-[#475569] text-white font-mono text-xs rounded-sm transition-colors"
          >
            {createFeatureMutation.isPending ? "Creating..." : "Create Feature"}
          </button>
        </form>
      </div>

      {/* Existing features */}
      <div>
        <h3 className="text-[11px] font-mono text-[#475569] uppercase tracking-wider mb-3">
          Existing Features ({features.length})
        </h3>
        {features.length === 0 ? (
          <p className="text-[11px] font-mono text-[#334155]">No features yet.</p>
        ) : (
          <div className="space-y-1">
            {features.map((feature) => {
              const epic = feature.epicId ? epicForFeature(feature.epicId) : null;
              const cCount = cardCountForFeature(feature.id);
              const isConfirming = deletingId === feature.id;
              return (
                <div
                  key={feature.id}
                  className="bg-[#0d0d14] border border-[#1e1e2a] rounded-sm px-3 py-2 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-mono text-[#e2e8f0]">{feature.title}</p>
                    {epic && (
                      <p className="text-[11px] font-mono text-[#6366f1] mt-0.5">
                        {epic.title}
                      </p>
                    )}
                    <p className="text-[10px] font-mono text-[#334155] mt-0.5">
                      {cCount} card{cCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {!isConfirming ? (
                    <button
                      onClick={() => setDeletingId(feature.id)}
                      className="text-[11px] font-mono text-[#64748b] hover:text-[#f87171] transition-colors shrink-0"
                    >
                      Delete
                    </button>
                  ) : (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-[10px] font-mono text-[#f87171]">
                        Deletes {cCount} card{cCount !== 1 ? "s" : ""}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteFeature(feature.id)}
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
