import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../../api/client";
import type { Card, Status } from "../../api/types";

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
      const res = await fetch(`${API_BASE}/statuses`);
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/statuses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      setNewName("");
      setNewColor("#6366f1");
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/statuses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, newPosition, swapId, swapPosition }: { id: string; newPosition: number; swapId: string; swapPosition: number }) => {
      await Promise.all([
        fetch(`${API_BASE}/statuses/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: newPosition }) }),
        fetch(`${API_BASE}/statuses/${swapId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: swapPosition }) }),
      ]);
    },
    // No onSuccess invalidation — WS status:updated events handle cache refresh (debounced)
  });

  const deleteStatus = async (id: string) => {
    await fetch(`${API_BASE}/statuses/${id}`, { method: "DELETE" });
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
        <h3 className="text-[11px] font-mono text-[#475569] uppercase tracking-wider mb-3">
          New Status
        </h3>
        <form
          onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate(); }}
          className="flex gap-2 items-center"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Status name"
            className="flex-1 bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none focus:border-[#6366f1] transition-colors"
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
            className="px-3 py-2 bg-[#6366f1] hover:bg-[#818cf8] disabled:bg-[#1e1e2a] disabled:text-[#475569] text-white font-mono text-xs rounded-sm transition-colors shrink-0"
          >
            Add
          </button>
        </form>
      </div>

      {/* Existing */}
      <div>
        <h3 className="text-[11px] font-mono text-[#475569] uppercase tracking-wider mb-3">
          Existing Statuses ({sortedStatuses.length})
        </h3>
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
                      className="flex-1 bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-2 py-1 font-mono text-xs text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] transition-colors"
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
                      className="px-2 py-1 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-50 text-white font-mono text-[11px] rounded-sm transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-[12px] font-mono text-[#e2e8f0]">{s.name}</span>
                    <span className="text-[10px] font-mono text-[#334155]">{count} card{count !== 1 ? "s" : ""}</span>
                    {!isConfirming ? (
                      <div className="flex gap-3">
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
                        <button
                          onClick={() => { setDeletingId(s.id); setEditingId(null); }}
                          className="text-[11px] font-mono text-[#64748b] hover:text-[#f87171] transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {count > 0 && (
                          <span className="text-[10px] font-mono text-[#f87171]">
                            {count} card{count !== 1 ? "s" : ""} affected
                          </span>
                        )}
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteStatus(s.id)}
                          className="px-2 py-0.5 bg-[#3b1f1f] border border-[#7f1d1d] hover:bg-[#5c1f1f] text-[#f87171] font-mono text-[11px] rounded-sm transition-colors"
                        >
                          Confirm
                        </button>
                      </div>
                    )}
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
