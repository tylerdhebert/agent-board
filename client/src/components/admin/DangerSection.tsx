import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../../api/client";
import type { Card } from "../../api/types";

export function DangerSection() {
  const queryClient = useQueryClient();
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/cards`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5_000,
  });

  const deleteAllCards = async () => {
    setIsDeleting(true);
    try {
      for (const card of cards) {
        await fetch(`${API_BASE}/cards/${card.id}`, { method: "DELETE" });
      }
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    } finally {
      setIsDeleting(false);
      setConfirmStep(0);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-[#7f1d1d] rounded-sm p-4 bg-[#1a0a0a]">
        <h3 className="text-[11px] font-mono text-[#f87171] uppercase tracking-wider mb-1">
          Danger Zone
        </h3>
        <p className="text-[11px] font-mono text-[#64748b] mb-4">
          These actions are irreversible.
        </p>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-mono text-[#e2e8f0]">
                Delete ALL cards
              </p>
              <p className="text-[11px] font-mono text-[#64748b] mt-0.5">
                {cards.length} card{cards.length !== 1 ? "s" : ""} will be
                permanently deleted
              </p>
            </div>

            {confirmStep === 0 && (
              <button
                onClick={() => setConfirmStep(1)}
                disabled={cards.length === 0}
                className="px-3 py-1.5 bg-[#3b1f1f] border border-[#7f1d1d] hover:bg-[#5c1f1f] disabled:opacity-40 disabled:cursor-not-allowed text-[#f87171] font-mono text-[11px] rounded-sm transition-colors shrink-0"
              >
                Delete All Cards
              </button>
            )}

            {confirmStep === 1 && (
              <div className="flex flex-col items-end gap-2 shrink-0">
                <p className="text-[11px] font-mono text-[#f87171]">
                  Are you sure? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmStep(0)}
                    className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setConfirmStep(2)}
                    className="px-3 py-1.5 bg-[#3b1f1f] border border-[#7f1d1d] hover:bg-[#5c1f1f] text-[#f87171] font-mono text-[11px] rounded-sm transition-colors"
                  >
                    Yes, delete all
                  </button>
                </div>
              </div>
            )}

            {confirmStep === 2 && (
              <div className="flex flex-col items-end gap-2 shrink-0">
                <p className="text-[11px] font-mono text-[#f87171]">
                  Final confirmation required.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmStep(0)}
                    className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteAllCards}
                    disabled={isDeleting}
                    className="px-3 py-1.5 bg-[#7f1d1d] border border-[#ef4444] hover:bg-[#991b1b] disabled:opacity-50 text-white font-mono text-[11px] rounded-sm transition-colors"
                  >
                    {isDeleting ? "Deleting..." : "PERMANENTLY DELETE ALL"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
