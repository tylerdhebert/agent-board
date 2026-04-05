import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Card, Status } from "../../api/types";
import { inputCls, sectionHeadingCls } from "./adminStyles";
import { DeleteConfirmRow } from "../ui/DeleteConfirmRow";

export function CardsSection() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showDeleteDoneConfirm, setShowDeleteDoneConfirm] = useState(false);
  const [deleteAllDoneStatus, setDeleteAllDoneStatus] = useState<
    "idle" | "running" | "done"
  >("idle");

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data } = await api.api.cards.get();
      return data ?? [];
    },
    staleTime: 5_000,
  });

  const { data: statuses = [] } = useQuery<Status[]>({
    queryKey: ["statuses"],
    queryFn: async () => {
      const { data } = await api.api.statuses.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const doneStatus = statuses.find(
    (s) => s.name.toLowerCase() === "done"
  );
  const doneCards = doneStatus
    ? cards.filter((c) => c.statusId === doneStatus.id)
    : [];

  const deleteCard = async (cardId: string) => {
    setDeletingIds((prev) => new Set(prev).add(cardId));
    try {
      await api.api.cards({ id: cardId }).delete();
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  const deleteAllDoneCards = async () => {
    setDeleteAllDoneStatus("running");
    for (const card of doneCards) {
      await deleteCard(card.id);
    }
    setDeleteAllDoneStatus("done");
    setShowDeleteDoneConfirm(false);
    setTimeout(() => setDeleteAllDoneStatus("idle"), 2000);
  };

  const filteredCards = searchQuery.trim()
    ? cards.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Delete all Done */}
      <div>
        <h3 className={sectionHeadingCls}>Bulk Actions</h3>
        <div className="surface-panel flex items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[12px] font-mono text-[var(--text-primary)]">
              Delete all Done cards
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-[var(--text-faint)]">
              {doneCards.length} card{doneCards.length !== 1 ? "s" : ""} will be
              deleted
            </p>
          </div>
          {!showDeleteDoneConfirm ? (
            <button
              onClick={() => setShowDeleteDoneConfirm(true)}
              disabled={doneCards.length === 0}
              className="action-button action-button--danger shrink-0"
            >
              Delete Done
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowDeleteDoneConfirm(false)}
                className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteAllDoneCards}
                disabled={deleteAllDoneStatus === "running"}
                className="action-button action-button--danger"
              >
                {deleteAllDoneStatus === "running"
                  ? "Deleting..."
                  : deleteAllDoneStatus === "done"
                  ? "Done"
                  : "Confirm"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card search + individual delete */}
      <div>
        <h3 className={sectionHeadingCls}>Find and Delete</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search cards by title..."
          className={`${inputCls()} mb-2`}
        />
        {filteredCards.length > 0 && (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredCards.map((card) => (
              <CardDeleteRow
                key={card.id}
                card={card}
                statuses={statuses}
                isDeleting={deletingIds.has(card.id)}
                onDelete={() => deleteCard(card.id)}
              />
            ))}
          </div>
        )}
        {searchQuery.trim() && filteredCards.length === 0 && (
          <p className="py-2 text-[11px] font-mono text-[var(--text-dim)]">
            No cards match.
          </p>
        )}
        {!searchQuery.trim() && (
          <p className="py-1 text-[11px] font-mono text-[var(--text-dim)]">
            Type to search cards.
          </p>
        )}
      </div>
    </div>
  );
}

interface CardDeleteRowProps {
  card: Card;
  statuses: Status[];
  isDeleting: boolean;
  onDelete: () => void;
}

function CardDeleteRow({
  card,
  statuses,
  isDeleting,
  onDelete,
}: CardDeleteRowProps) {
  const [confirm, setConfirm] = useState(false);
  const status = statuses.find((s) => s.id === card.statusId);

  return (
    <div className="surface-panel flex items-center gap-2 px-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="truncate text-[12px] font-mono text-[var(--text-primary)]">
          {card.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-[10px] font-mono"
            style={{ color: status?.color ?? "var(--text-faint)" }}
          >
            {status?.name ?? "Unknown"}
          </span>
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            {card.type}
          </span>
        </div>
      </div>
      <div className="shrink-0">
        <DeleteConfirmRow
          confirming={confirm}
          onStartConfirm={() => setConfirm(true)}
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); onDelete(); }}
          disabled={isDeleting}
          isPending={isDeleting}
          pendingLabel="..."
        />
      </div>
    </div>
  );
}
