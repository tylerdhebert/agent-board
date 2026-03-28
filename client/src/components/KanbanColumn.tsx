import type { Card, WorkflowStatus } from "../api/types";
import { CardTile } from "./CardTile";

interface Props {
  workflowStatus: WorkflowStatus;
  cards: Card[];
  blockedCardIds?: Set<string>;
}

export function KanbanColumn({ workflowStatus, cards, blockedCardIds }: Props) {
  // Build a Status-like object for CardTile (which still expects { id, name, color })
  const statusForTile = {
    id: workflowStatus.statusId,
    name: workflowStatus.name,
    color: workflowStatus.color,
    position: workflowStatus.position,
    createdAt: "",
  };

  return (
    <div className="flex flex-col min-w-[260px] max-w-[300px] w-full bg-[#0d0d14] rounded-sm border border-[#1e1e2a]">
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1e1e2a]"
        style={{ borderTop: `2px solid ${workflowStatus.color}` }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: workflowStatus.color }}
        />
        <span className="text-xs font-mono font-semibold text-[#cbd5e1] uppercase tracking-wider">
          {workflowStatus.name}
        </span>
        <span className="ml-auto text-[10px] font-mono text-[#475569] bg-[#1a1a24] px-1.5 py-0.5 rounded">
          {cards.length}
        </span>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0">
        {cards.length === 0 ? (
          <div className="py-8 text-center text-[10px] font-mono text-[#334155]">
            — empty —
          </div>
        ) : (
          cards.map((card) => (
            <CardTile key={card.id} card={card} status={statusForTile} blockedCardIds={blockedCardIds} />
          ))
        )}
      </div>
    </div>
  );
}
