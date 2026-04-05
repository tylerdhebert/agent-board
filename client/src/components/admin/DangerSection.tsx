import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Card } from "../../api/types";

export function DangerSection() {
  const queryClient = useQueryClient();
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data } = await api.api.cards.get();
      return data ?? [];
    },
    staleTime: 5_000,
  });

  async function deleteAllCards() {
    setIsDeleting(true);
    try {
      for (const card of cards) {
        await api.api.cards({ id: card.id }).delete();
      }
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    } finally {
      setIsDeleting(false);
      setConfirmStep(0);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border px-5 py-5" style={{ borderColor: "rgba(248, 113, 113, 0.36)", background: "var(--danger-soft)" }}>
        <h3 className="mb-1 text-[11px] font-mono uppercase tracking-[0.28em] text-[var(--danger)]">Danger Zone</h3>
        <p className="mb-4 text-[11px] font-mono text-[var(--text-muted)]">These actions are irreversible.</p>

        <div className="surface-panel surface-panel--raised px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-mono text-[var(--text-primary)]">Delete all cards</p>
              <p className="mt-0.5 text-[11px] font-mono text-[var(--text-faint)]">
                {cards.length} card{cards.length !== 1 ? "s" : ""} will be permanently deleted
              </p>
            </div>

            {confirmStep === 0 && (
              <button
                type="button"
                onClick={() => setConfirmStep(1)}
                disabled={cards.length === 0}
                className="action-button action-button--danger shrink-0"
              >
                Delete All Cards
              </button>
            )}

            {confirmStep === 1 && (
              <div className="flex shrink-0 flex-col items-end gap-2">
                <p className="text-[11px] font-mono text-[var(--danger)]">Are you sure? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmStep(0)}
                    className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmStep(2)}
                    className="action-button action-button--danger"
                  >
                    Yes, delete all
                  </button>
                </div>
              </div>
            )}

            {confirmStep === 2 && (
              <div className="flex shrink-0 flex-col items-end gap-2">
                <p className="text-[11px] font-mono text-[var(--danger)]">Final confirmation required.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmStep(0)}
                    className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={deleteAllCards}
                    disabled={isDeleting}
                    className="action-button action-button--danger"
                  >
                    {isDeleting ? "Deleting" : "Permanently Delete All"}
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
