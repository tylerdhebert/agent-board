import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Card, Epic, Feature } from "../../api/types";
import { inputCls, primaryBtnCls, sectionHeadingCls, selectCls } from "./adminStyles";

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
      const { data } = await api.api.cards.get();
      return data ?? [];
    },
    staleTime: 5_000,
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

  const filteredCards = search.trim() ? cards.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())) : [];
  const selectedCard = selectedCardId ? cards.find((c) => c.id === selectedCardId) : null;
  const featuresForEpic = targetEpicId ? features.filter((f) => f.epicId === targetEpicId) : [];

  function selectCard(card: Card) {
    setSelectedCardId(card.id);
    setTargetEpicId(card.epicId ?? "");
    setTargetFeatureId(card.featureId ?? "");
    setSearch("");
    setSavedId(null);
  }

  function handleEpicChange(epicId: string) {
    setTargetEpicId(epicId);
    setTargetFeatureId("");
  }

  async function saveMove() {
    if (!selectedCardId) return;
    setSaving(true);
    try {
      await api.api.cards({ id: selectedCardId }).patch({
        epicId: targetEpicId || null,
        featureId: targetFeatureId || null,
      });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      setSavedId(selectedCardId);
      setSelectedCardId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className={sectionHeadingCls}>Move Card to Epic / Feature</h3>

      {!selectedCard ? (
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards by title..."
            className={`${inputCls()} mb-2`}
          />
          {savedId && <p className="mb-2 text-[11px] font-mono text-[var(--success)]">Saved.</p>}

          {filteredCards.length > 0 && (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {filteredCards.map((card) => {
                const epic = card.epicId ? epics.find((e) => e.id === card.epicId) : null;
                const feature = card.featureId ? features.find((f) => f.id === card.featureId) : null;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => selectCard(card)}
                    className="surface-panel w-full px-4 py-3 text-left transition-colors hover:bg-[var(--panel-hover)]"
                  >
                    <p className="truncate text-[12px] font-mono text-[var(--text-primary)]">{card.title}</p>
                    <p className="mt-1 text-[10px] font-mono text-[var(--text-faint)]">
                      {epic ? epic.title : "no epic"}
                      {feature ? ` > ${feature.title}` : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {search.trim() && filteredCards.length === 0 && <p className="text-[11px] font-mono text-[var(--text-dim)]">No cards match.</p>}
          {!search.trim() && <p className="text-[11px] font-mono text-[var(--text-dim)]">Type to search cards.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="surface-panel flex items-center justify-between gap-3 px-4 py-3">
            <p className="flex-1 truncate text-[12px] font-mono text-[var(--text-primary)]">{selectedCard.title}</p>
            <button
              type="button"
              onClick={() => setSelectedCardId(null)}
              className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Change
            </button>
          </div>

          <div>
            <label className="meta-label mb-2 block">Epic</label>
            <select value={targetEpicId} onChange={(e) => handleEpicChange(e.target.value)} className={selectCls}>
              <option value="">No epic</option>
              {epics.map((epic) => (
                <option key={epic.id} value={epic.id}>
                  {epic.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="meta-label mb-2 block">Feature</label>
            <select
              value={targetFeatureId}
              onChange={(e) => setTargetFeatureId(e.target.value)}
              disabled={!targetEpicId}
              className={`${selectCls} disabled:opacity-40`}
            >
              <option value="">No feature</option>
              {featuresForEpic.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setSelectedCardId(null)}
              className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button type="button" onClick={saveMove} disabled={saving} className={primaryBtnCls}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
