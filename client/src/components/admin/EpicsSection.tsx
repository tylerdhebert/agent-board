import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Card, Epic, Feature, Workflow } from "../../api/types";
import {
  adminItemMetaCls,
  adminItemSubtleCls,
  adminItemTitleCls,
  adminListItemCls,
  adminTagCls,
  emptyStateCls,
  inputCls,
  primaryBtnCls,
  sectionHeadingCls,
  selectCls,
} from "./adminStyles";
import { DeleteConfirmRow } from "../ui/DeleteConfirmRow";

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
      <div>
        <h3 className={sectionHeadingCls}>Create Epic</h3>
        <form onSubmit={handleCreate} className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Epic title"
            className={inputCls()}
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className={inputCls()}
          />
          <select
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            className={selectCls}
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
            className={primaryBtnCls}
          >
            {createEpicMutation.isPending ? "Creating..." : "Create Epic"}
          </button>
        </form>
      </div>

      <div>
        <h3 className={sectionHeadingCls}>Existing Epics ({epics.length})</h3>
        {epics.length === 0 ? (
          <p className={emptyStateCls}>No epics yet.</p>
        ) : (
          <div className="space-y-1.5">
            {epics.map((epic) => {
              const fCount = featureCountForEpic(epic.id);
              const cCount = cardCountForEpic(epic.id);
              const isConfirming = deletingId === epic.id;
              const workflow = epic.workflowId
                ? workflows.find((w) => w.id === epic.workflowId) ?? null
                : null;

              return (
                <div key={epic.id} className={adminListItemCls}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={adminItemTitleCls}>{epic.title}</p>
                      {workflow && (
                        <span className={adminTagCls(workflow.type === "worktree")}>
                          {workflow.name}
                        </span>
                      )}
                    </div>
                    {epic.description && (
                      <p className={`${adminItemMetaCls} truncate`}>
                        {epic.description}
                      </p>
                    )}
                    <p className={adminItemSubtleCls}>
                      {fCount} feature{fCount !== 1 ? "s" : ""} | {cCount} card{cCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <DeleteConfirmRow
                      confirming={isConfirming}
                      onStartConfirm={() => setDeletingId(epic.id)}
                      onCancel={() => setDeletingId(null)}
                      onConfirm={() => deleteEpic(epic.id)}
                      warningText={`Deletes ${fCount} feature${fCount !== 1 ? "s" : ""} + ${cCount} card${cCount !== 1 ? "s" : ""}`}
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
