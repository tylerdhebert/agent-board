import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Card, Epic, Feature, Repo } from "../../api/types";
import {
  adminActionLinkCls,
  adminEditShellCls,
  adminItemMetaCls,
  adminItemSubtleCls,
  adminItemTitleCls,
  adminListItemCls,
  emptyStateCls,
  inputCls,
  selectCls,
  sectionHeadingCls,
  cancelBtnCls,
  primaryBtnCls,
} from "./adminStyles";
import { DeleteConfirmRow } from "../ui/DeleteConfirmRow";

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
      <div>
        <h3 className={sectionHeadingCls}>Create Feature</h3>
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
            className={selectCls + (createAttempted && !selectedEpicId ? " border-[var(--danger)]" : "")}
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
            className={primaryBtnCls}
          >
            {createFeatureMutation.isPending ? "Creating..." : "Create Feature"}
          </button>
        </form>
      </div>

      <div>
        <h3 className={sectionHeadingCls}>Existing Features ({features.length})</h3>
        {features.length === 0 ? (
          <p className={emptyStateCls}>No features yet.</p>
        ) : (
          <div className="space-y-1.5">
            {features.map((feature) => {
              const epic = feature.epicId ? epicForFeature(feature.epicId) : null;
              const repo = repoForFeature(feature.repoId);
              const cCount = cardCountForFeature(feature.id);
              const isConfirming = deletingId === feature.id;
              const isEditing = editingId === feature.id;

              if (isEditing) {
                return (
                  <div key={feature.id} className={adminEditShellCls}>
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
                      className={selectCls + (editAttempted && !editState.epicId ? " border-[var(--danger)]" : "")}
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
                        onClick={() => {
                          setEditingId(null);
                          setEditAttempted(false);
                        }}
                        className={cancelBtnCls}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(feature.id)}
                        disabled={updateMutation.isPending}
                        className={primaryBtnCls}
                      >
                        {updateMutation.isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={feature.id} className={adminListItemCls}>
                  <div className="min-w-0 flex-1">
                    <p className={adminItemTitleCls}>{feature.title}</p>
                    {epic && (
                      <p className={adminItemMetaCls}>{epic.title}</p>
                    )}
                    {(repo || feature.branchName) && (
                      <p className={adminItemSubtleCls}>
                        {repo && <span>{repo.name}</span>}
                        {repo && feature.branchName && <span> / </span>}
                        {feature.branchName && <span>branch {feature.branchName}</span>}
                      </p>
                    )}
                    <p className={adminItemSubtleCls}>
                      {cCount} card{cCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!isConfirming && (
                      <button
                        onClick={() => startEdit(feature)}
                        className={adminActionLinkCls}
                      >
                        Edit
                      </button>
                    )}
                    <DeleteConfirmRow
                      confirming={isConfirming}
                      onStartConfirm={() => setDeletingId(feature.id)}
                      onCancel={() => setDeletingId(null)}
                      onConfirm={() => deleteFeature(feature.id)}
                      warningText={cCount > 0 ? `Deletes ${cCount} card${cCount !== 1 ? "s" : ""}` : undefined}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
