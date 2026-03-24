import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../../api/client";
import type { Card, Epic, Feature } from "../../api/types";

export function MoveSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [targetEpicId, setTargetEpicId] = useState("");
  const [targetFeatureId, setTargetFeatureId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/cards`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5_000,
  });

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

  const filteredCards = search.trim()
    ? cards.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : [];

  const selectedCard = selectedCardId ? cards.find((c) => c.id === selectedCardId) : null;

  const featuresForEpic = targetEpicId
    ? features.filter((f) => f.epicId === targetEpicId)
    : [];

  const selectCard = (card: Card) => {
    setSelectedCardId(card.id);
    setTargetEpicId(card.epicId ?? "");
    setTargetFeatureId(card.featureId ?? "");
    setSearch("");
    setSavedId(null);
  };

  const handleEpicChange = (epicId: string) => {
    setTargetEpicId(epicId);
    setTargetFeatureId(""); // clear feature when epic changes
  };

  const saveMove = async () => {
    if (!selectedCardId) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/cards/${selectedCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          epicId: targetEpicId || null,
          featureId: targetFeatureId || null,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      setSavedId(selectedCardId);
      setSelectedCardId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-[11px] font-mono text-[#475569] uppercase tracking-wider">
        Move Card to Epic / Feature
      </h3>

      {!selectedCard ? (
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards by title..."
            className="w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none focus:border-[#6366f1] transition-colors mb-2"
          />
          {savedId && (
            <p className="text-[11px] font-mono text-[#22c55e] mb-2">Saved.</p>
          )}
          {filteredCards.length > 0 && (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {filteredCards.map((card) => {
                const epic = card.epicId ? epics.find((e) => e.id === card.epicId) : null;
                const feature = card.featureId ? features.find((f) => f.id === card.featureId) : null;
                return (
                  <button
                    key={card.id}
                    onClick={() => selectCard(card)}
                    className="w-full text-left bg-[#0d0d14] border border-[#1e1e2a] hover:border-[#3a3a4a] rounded-sm px-3 py-2 transition-colors"
                  >
                    <p className="text-[12px] font-mono text-[#e2e8f0] truncate">{card.title}</p>
                    <p className="text-[10px] font-mono text-[#475569] mt-0.5">
                      {epic ? epic.title : "no epic"}
                      {feature ? ` › ${feature.title}` : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
          {search.trim() && filteredCards.length === 0 && (
            <p className="text-[11px] font-mono text-[#334155]">No cards match.</p>
          )}
          {!search.trim() && (
            <p className="text-[11px] font-mono text-[#334155]">Type to search cards.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-[#0d0d14] border border-[#2a2a38] rounded-sm px-3 py-2 flex items-center justify-between">
            <p className="text-[12px] font-mono text-[#e2e8f0] truncate flex-1">{selectedCard.title}</p>
            <button
              onClick={() => setSelectedCardId(null)}
              className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors ml-3 shrink-0"
            >
              Change
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-[#475569] uppercase tracking-wider mb-1">
              Epic
            </label>
            <select
              value={targetEpicId}
              onChange={(e) => handleEpicChange(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] transition-colors cursor-pointer"
            >
              <option value="">— No epic —</option>
              {epics.map((epic) => (
                <option key={epic.id} value={epic.id}>{epic.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-[#475569] uppercase tracking-wider mb-1">
              Feature
            </label>
            <select
              value={targetFeatureId}
              onChange={(e) => setTargetFeatureId(e.target.value)}
              disabled={!targetEpicId}
              className="w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] transition-colors cursor-pointer disabled:opacity-40"
            >
              <option value="">— No feature —</option>
              {featuresForEpic.map((f) => (
                <option key={f.id} value={f.id}>{f.title}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setSelectedCardId(null)}
              className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveMove}
              disabled={saving}
              className="px-4 py-1.5 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-50 text-white font-mono text-[11px] rounded-sm transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
