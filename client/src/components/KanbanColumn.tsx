import type { Card, WorkflowStatus } from "../api/types";
import { CardTile } from "./CardTile";

interface Props {
  workflowStatus: WorkflowStatus;
  cards: Card[];
  blockedCardIds?: Set<string>;
}

export function KanbanColumn({ workflowStatus, cards, blockedCardIds }: Props) {
  const statusForTile = {
    id: workflowStatus.statusId,
    name: workflowStatus.name,
    color: workflowStatus.color,
    position: workflowStatus.position,
    createdAt: "",
  };

  return (
    <div className="surface-panel flex min-w-[292px] max-w-[324px] w-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border-soft)] px-3.5 py-3">
        <div className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 rounded-full shadow-[0_0_10px_currentColor]"
            style={{ color: workflowStatus.color, backgroundColor: workflowStatus.color }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
              Stage
            </div>
            <div className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]">
              {workflowStatus.name}
            </div>
          </div>
          <span className="stat-pill !rounded-[10px] !px-2 !py-1 !text-[0.55rem]">
            {cards.length}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 py-2.5">
        {cards.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[14px] border border-dashed border-[var(--border-soft)] bg-[var(--panel)] px-4 py-8 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
            Empty lane
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
