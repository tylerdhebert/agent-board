import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Card, Epic, Feature, Repo } from "../../api/types";

function inputCls(invalid = false, width = "w-full") {
  return `${width} bg-[#0a0a0f] border rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none transition-colors ${
    invalid ? "border-[#f87171] focus:border-[#f87171]" : "border-[#2a2a38] focus:border-[#6366f1]"
  }`;
}

const selectCls = "w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] transition-colors cursor-pointer";

interface EditState {
  title: string;
  description: string;
  epicId: string;
  repoId: string;
  branchName: string;
}

export function FeaturesSection() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEpicId, setSelectedEpicId] = useState("");
  const [repoId, setRepoId] = useState("");
  const [branchName, setBranchName] = useState("");
  const [createAttempted, setCreateAttempted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAttempted, setEditAttempted] = useState(false);
  const [editState, setEditState] = useState<EditState>({
    title: "",
    description: "",
    epicId: "",
    repoId: "",
    branchName: "",
  });

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

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data } = await api.api.cards.get();
      return data ?? [];
    },
    staleTime: 5_000,
  });

  const { data: repos = [] } = useQuery<Repo[]>({
    queryKey: ["repos"],
    queryFn: async () => {
      const { data } = await api.api.repos.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const createFeatureMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {
        title: title.trim(),
        epicId: selectedEpicId,
      };
      if (description.trim()) body.description = description.trim();
      if (repoId) body.repoId = repoId;
      if (branchName.trim()) body.branchName = branchName.trim();
      const { data } = await api.api.features.post(body as any);
      return data!;
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setSelectedEpicId("");
      setRepoId("");
      setBranchName("");
      setCreateAttempted(false);
      queryClient.invalidateQueries({ queryKey: ["features"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const body: Record<string, string> = {
        title: editState.title.trim(),
        epicId: editState.epicId,
      };
      if (editState.description.trim()) body.description = editState.description.trim();
      if (editState.repoId) body.repoId = editState.repoId;
      if (editState.branchName.trim()) body.branchName = editState.branchName.trim();
      await api.api.features({ id }).patch(body as any);
    },
    onSuccess: () => {
      setEditingId(null);
      setEditAttempted(false);
      queryClient.invalidateQueries({ queryKey: ["features"] });
      queryClient.invalidateQueries({ queryKey: ["feature-commits"] });
    },
  });

  const deleteFeature = async (featureId: string) => {
    await api.api.features({ id: featureId }).delete();
    queryClient.invalidateQueries({ queryKey: ["features"] });
    queryClient.invalidateQueries({ queryKey: ["cards"] });
    setDeletingId(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAttempted(true);
    if (!title.trim() || !selectedEpicId) return;
    createFeatureMutation.mutate();
  };

  const handleSave = (id: string) => {
    setEditAttempted(true);
    if (!editState.title.trim() || !editState.epicId) return;
    updateMutation.mutate(id);
  };

  const startEdit = (feature: Feature) => {
    setDeletingId(null);
    setEditAttempted(false);
    setEditingId(feature.id);
    setEditState({
      title: feature.title,
      description: feature.description,
      epicId: feature.epicId,
      repoId: feature.repoId ?? "",
      branchName: feature.branchName ?? "",
    });
  };

  const epicForFeature = (epicId: string) => epics.find((e) => e.id === epicId);
  const repoForFeature = (rId: string | null) => repos.find((r) => r.id === rId);
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
            className={inputCls(createAttempted && !title.trim())}
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className={inputCls()}
          />
          <select
            value={selectedEpicId}
            onChange={(e) => setSelectedEpicId(e.target.value)}
            className={selectCls + (createAttempted && !selectedEpicId ? " border-[#f87171]" : "")}
          >
            <option value="">Select epic</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.title}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={repoId}
              onChange={(e) => setRepoId(e.target.value)}
              className={selectCls.replace("w-full", "flex-1")}
            >
              <option value="">No repo</option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="Branch name (optional)"
              className={inputCls(false, "flex-1")}
            />
          </div>
          <button
            type="submit"
            disabled={createFeatureMutation.isPending}
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
              const repo = repoForFeature(feature.repoId);
              const cCount = cardCountForFeature(feature.id);
              const isConfirming = deletingId === feature.id;
              const isEditing = editingId === feature.id;

              if (isEditing) {
                return (
                  <div
                    key={feature.id}
                    className="bg-[#0d0d14] border border-[#2a2a4a] rounded-sm px-3 py-3 space-y-2"
                  >
                    <input
                      type="text"
                      value={editState.title}
                      onChange={(e) => setEditState((s) => ({ ...s, title: e.target.value }))}
                      placeholder="Title"
                      className={inputCls(editAttempted && !editState.title.trim())}
                    />
                    <input
                      type="text"
                      value={editState.description}
                      onChange={(e) => setEditState((s) => ({ ...s, description: e.target.value }))}
                      placeholder="Description (optional)"
                      className={inputCls()}
                    />
                    <select
                      value={editState.epicId}
                      onChange={(e) => setEditState((s) => ({ ...s, epicId: e.target.value }))}
                      className={selectCls + (editAttempted && !editState.epicId ? " border-[#f87171]" : "")}
                    >
                      <option value="">Select epic</option>
                      {epics.map((epic) => (
                        <option key={epic.id} value={epic.id}>
                          {epic.title}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <select
                        value={editState.repoId}
                        onChange={(e) => setEditState((s) => ({ ...s, repoId: e.target.value }))}
                        className={selectCls.replace("w-full", "flex-1")}
                      >
                        <option value="">No repo</option>
                        {repos.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editState.branchName}
                        onChange={(e) => setEditState((s) => ({ ...s, branchName: e.target.value }))}
                        placeholder="Branch name"
                        className={inputCls(false, "flex-1")}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setEditingId(null); setEditAttempted(false); }}
                        className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(feature.id)}
                        disabled={updateMutation.isPending}
                        className="px-3 py-1 bg-[#6366f1] hover:bg-[#818cf8] disabled:bg-[#1e1e2a] disabled:text-[#475569] text-white font-mono text-xs rounded-sm transition-colors"
                      >
                        {updateMutation.isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                );
              }

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
                    {(repo || feature.branchName) && (
                      <p className="text-[10px] font-mono text-[#475569] mt-0.5">
                        {repo && <span>{repo.name}</span>}
                        {repo && feature.branchName && <span className="text-[#334155]"> / </span>}
                        {feature.branchName && <span className="text-[#818cf8]">⎇ {feature.branchName}</span>}
                      </p>
                    )}
                    <p className="text-[10px] font-mono text-[#334155] mt-0.5">
                      {cCount} card{cCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {!isConfirming ? (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(feature)}
                        className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingId(feature.id)}
                        className="text-[11px] font-mono text-[#64748b] hover:text-[#f87171] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
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
