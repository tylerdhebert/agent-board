import { useQuery } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { API_BASE } from "../api/client";
import type { Card, Status } from "../api/types";
import { KanbanColumn } from "./KanbanColumn";

export function Board() {
  const hierarchyFilter = useBoardStore((s) => s.hierarchyFilter);

  const { data: statuses = [], isLoading: statusesLoading } = useQuery<Status[]>({
    queryKey: ["statuses"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/statuses`);
      if (!res.ok) throw new Error("Failed to fetch statuses");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: cards = [], isLoading: cardsLoading } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/cards`);
      if (!res.ok) throw new Error("Failed to fetch cards");
      return res.json();
    },
    staleTime: 5_000,
  });

  const filteredCards = (() => {
    switch (hierarchyFilter.type) {
      case "all":
        return cards;
      case "epic":
        return cards.filter((c) => c.epicId === hierarchyFilter.id);
      case "feature":
        return cards.filter((c) => c.featureId === hierarchyFilter.id);
      case "unassigned":
        return cards.filter((c) => c.epicId === null && c.featureId === null);
      default:
        return cards;
    }
  })();

  if (statusesLoading || cardsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[#334155] font-mono text-xs animate-pulse">
          loading...
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-3 p-4 overflow-x-auto overflow-y-hidden min-h-0">
      {statuses.map((status) => {
        const columnCards = filteredCards.filter((c) => c.statusId === status.id);
        return (
          <KanbanColumn key={status.id} status={status} cards={columnCards} />
        );
      })}
    </div>
  );
}
