import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Card, Status } from "../../api/types";
import { inputCls, sectionHeadingCls, cancelBtnCls, confirmDeleteBtnCls, primaryBtnCls } from "./adminStyles";
import { DeleteConfirmRow } from "../ui/DeleteConfirmRow";

export function StatusesSection() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: statuses = [] } = useQuery<Status[]>({
    queryKey: ["statuses"],
    queryFn: async () => {
      const { data } = await api.api.statuses.get();
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.api.statuses.post({ name: newName.trim(), color: newColor });
      return data!;
    },
    onSuccess: () => {
      setNewName("");
      setNewColor("#6366f1");
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.api.statuses({ id }).patch({ name: editName.trim(), color: editColor });
      return data!;
    },
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, newPosition, swapId, swapPosition }: { id: string; newPosition: number; swapId: string; swapPosition: number }) => {
      await Promise.all([
        api.api.statuses({ id }).patch({ position: newPosition }),
        api.api.statuses({ id: swapId }).patch({ position: swapPosition }),
      ]);
    },
    // No onSuccess invalidation — WS status:updated events handle cache refresh (debounced)
  });

  const deleteStatus = async (id: string) => {
    await api.api.statuses({ id }).delete();
    queryClient.invalidateQueries({ queryKey: ["statuses"] });
    setDeletingId(null);
  };

  const startEdit = (s: Status) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
    setDeletingId(null);
  };

  const cardCount = (statusId: string) =>
    cards.filter((c) => c.statusId === statusId).length;

  const sortedStatuses = [...statuses].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6">
      {/* Create */}
      <div>
        <h3 className={sectionHeadingCls}>New Status</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate(); }}
          className="flex gap-2 items-center"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Status name"
            className={inputCls(false, "flex-1")}
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-9 h-9 rounded-sm border border-[#2a2a38] bg-[#0a0a0f] cursor-pointer p-1"
            title="Pick color"
          />
          <button
            type="submit"
            disabled={!newName.trim() || createMutation.isPending}
            className={`${primaryBtnCls} shrink-0`}
          >
            Add
          </button>
        </form>
      </div>

      {/* Existing */}
      <div>
        <h3 className={sectionHeadingCls}>Existing Statuses ({sortedStatuses.length})</h3>
        <div className="space-y-1">
          {sortedStatuses.map((s, idx) => {
            const count = cardCount(s.id);
            const isEditing = editingId === s.id;
            const isConfirming = deletingId === s.id;
            return (
              <div
                key={s.id}
                className="bg-[#0d0d14] border border-[#1e1e2a] rounded-sm px-3 py-2"
                style={{ borderLeft: `3px solid ${s.color}` }}
              >
                {isEditing ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={inputCls(false, "flex-1")}
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-8 h-8 rounded-sm border border-[#2a2a38] bg-[#0a0a0f] cursor-pointer p-1"
                    />
                    <button
                      onClick={() => saveMutation.mutate(s.id)}
                      disabled={!editName.trim() || saveMutation.isPending}
                      className={primaryBtnCls}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className={cancelBtnCls}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-[12px] font-mono text-[#e2e8f0]">{s.name}</span>
                    <span className="text-[10px] font-mono text-[#334155]">{count} card{count !== 1 ? "s" : ""}</span>
                    <div className="flex items-center gap-3">
                      {!isConfirming && (
                        <>
                          <button
                            onClick={() => reorderMutation.mutate({ id: s.id, newPosition: sortedStatuses[idx - 1].position, swapId: sortedStatuses[idx - 1].id, swapPosition: s.position })}
                            disabled={idx === 0 || reorderMutation.isPending}
                            className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >↑</button>
                          <button
                            onClick={() => reorderMutation.mutate({ id: s.id, newPosition: sortedStatuses[idx + 1].position, swapId: sortedStatuses[idx + 1].id, swapPosition: s.position })}
                            disabled={idx === sortedStatuses.length - 1 || reorderMutation.isPending}
                            className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >↓</button>
                          <button
                            onClick={() => startEdit(s)}
                            className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                          >
                            Edit
                          </button>
                        </>
                      )}
                      <DeleteConfirmRow
                        confirming={isConfirming}
                        onStartConfirm={() => { setDeletingId(s.id); setEditingId(null); }}
                        onCancel={() => setDeletingId(null)}
                        onConfirm={() => deleteStatus(s.id)}
                        warningText={count > 0 ? `${count} card${count !== 1 ? "s" : ""} affected` : undefined}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
