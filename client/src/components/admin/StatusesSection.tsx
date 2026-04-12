import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Card, Status } from "../../api/types";
import { cancelBtnCls, inputCls, primaryBtnCls, sectionHeadingCls } from "./adminStyles";
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
  });

  async function deleteStatus(id: string) {
    await api.api.statuses({ id }).delete();
    queryClient.invalidateQueries({ queryKey: ["statuses"] });
    setDeletingId(null);
  }

  function startEdit(s: Status) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
    setDeletingId(null);
  }

  const cardCount = (statusId: string) => cards.filter((c) => c.statusId === statusId).length;
  const sortedStatuses = [...statuses].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6">
      <div>
        <h3 className={sectionHeadingCls}>New Status</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createMutation.mutate();
          }}
          className="flex items-center gap-2"
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
            className="h-10 w-10 cursor-pointer rounded-[14px] border border-[var(--border)] bg-[var(--panel-ink)] p-1"
            title="Pick color"
          />
          <button type="submit" disabled={!newName.trim() || createMutation.isPending} className={`${primaryBtnCls} shrink-0`}>
            Add
          </button>
        </form>
      </div>

      <div>
        <h3 className={sectionHeadingCls}>Existing Statuses ({sortedStatuses.length})</h3>
        <div className="space-y-2">
          {sortedStatuses.map((s, idx) => {
            const count = cardCount(s.id);
            const isEditing = editingId === s.id;
            const isConfirming = deletingId === s.id;
            const canRename = !s.isCore;
            const canDelete = !s.isCore;

            return (
              <div key={s.id} className="surface-panel px-4 py-3" style={{ boxShadow: `inset 3px 0 0 ${s.color}` }}>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    {canRename ? (
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls(false, "flex-1")} />
                    ) : (
                      <div className={`${inputCls(true, "flex-1")} truncate`}>{s.name}</div>
                    )}
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="h-10 w-10 cursor-pointer rounded-[14px] border border-[var(--border)] bg-[var(--panel-ink)] p-1"
                    />
                    <button type="button" onClick={() => saveMutation.mutate(s.id)} disabled={!editName.trim() || saveMutation.isPending} className={primaryBtnCls}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className={cancelBtnCls}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-[12px] font-mono text-[var(--text-primary)]">{s.name}</span>
                      {s.isCore ? (
                        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-dim)]">
                          Core
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-dim)]">{count} card{count !== 1 ? "s" : ""}</span>
                    <div className="flex items-center gap-3">
                      {!isConfirming && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              reorderMutation.mutate({
                                id: s.id,
                                newPosition: sortedStatuses[idx - 1].position,
                                swapId: sortedStatuses[idx - 1].id,
                                swapPosition: s.position,
                              })
                            }
                            disabled={idx === 0 || reorderMutation.isPending}
                            className="text-[11px] font-mono text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              reorderMutation.mutate({
                                id: s.id,
                                newPosition: sortedStatuses[idx + 1].position,
                                swapId: sortedStatuses[idx + 1].id,
                                swapPosition: s.position,
                              })
                            }
                            disabled={idx === sortedStatuses.length - 1 || reorderMutation.isPending}
                            className="text-[11px] font-mono text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            Down
                          </button>
                          <button type="button" onClick={() => startEdit(s)} className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                            Edit
                          </button>
                        </>
                      )}
                      {canDelete ? (
                        <DeleteConfirmRow
                          confirming={isConfirming}
                          onStartConfirm={() => {
                            setDeletingId(s.id);
                            setEditingId(null);
                          }}
                          onCancel={() => setDeletingId(null)}
                          onConfirm={() => deleteStatus(s.id)}
                          warningText={count > 0 ? `${count} card${count !== 1 ? "s" : ""} affected` : undefined}
                        />
                      ) : null}
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
