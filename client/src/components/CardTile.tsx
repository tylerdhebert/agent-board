import type { Card, Status } from "../api/types";
import { useBoardStore } from "../store";
import { TypeBadge } from "./TypeBadge";
import { StatusBadge } from "./StatusBadge";

interface Props {
  card: Card;
  status: Status;
}

export function CardTile({ card, status }: Props) {
  const setSelectedCardId = useBoardStore((s) => s.setSelectedCardId);
  const setOpenModal = useBoardStore((s) => s.setOpenModal);
  const pulsingCardIds = useBoardStore((s) => s.pulsingCardIds);
  const unseenCommentCardIds = useBoardStore((s) => s.unseenCommentCardIds);
  const clearUnseenComment = useBoardStore((s) => s.clearUnseenComment);

  const isPulsing = pulsingCardIds.has(card.id);
  const hasUnseenComment = unseenCommentCardIds.has(card.id);

  const handleClick = () => {
    clearUnseenComment(card.id);
    setSelectedCardId(card.id);
    setOpenModal("card");
  };

  return (
    <div
      onClick={handleClick}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
      className={`group relative cursor-pointer rounded-sm bg-[#1c1c28] border border-[#2a2a38] hover:border-[#3a3a4a] hover:bg-[#22222e] transition-colors duration-150 p-3.5 focus:outline-none focus:ring-1 focus:ring-[#3a3a4a] ${
        isPulsing ? "card-pulse" : ""
      } ${hasUnseenComment ? "card-comment-glow" : ""}`}
      style={{
        borderLeft: `3px solid ${status.color}`,
      }}
    >
      {/* Unseen comment badge */}
      {hasUnseenComment && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#6366f1] flex items-center justify-center text-[9px] font-bold text-white animate-pulse z-10">
          !
        </span>
      )}

      {/* Type + status row */}
      <div className="flex items-center gap-1.5 mb-2">
        <TypeBadge type={card.type} />
        <StatusBadge status={status} />
        {isPulsing && (
          <span className="ml-auto text-[10px] font-mono text-red-400 animate-pulse">
            INPUT
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-[#e2e8f0] text-sm font-medium leading-snug line-clamp-2 mb-2">
        {card.title}
      </p>

      {/* Branch badge */}
      {card.branchName && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#818cf8] bg-[#1a1a2e] border border-[#2a2a4a] px-1.5 py-0.5 rounded-sm max-w-full truncate">
            ⎇ {card.branchName}
          </span>
        </div>
      )}

      {/* Agent ID + timestamp */}
      <div className="flex items-center justify-between gap-2">
        {card.agentId ? (
          <span className="text-xs font-mono text-[#64748b] truncate max-w-[120px]">
            @{card.agentId}
          </span>
        ) : (
          <span />
        )}
        <span className="text-xs font-mono text-[#475569] shrink-0">
          {formatRelative(card.updatedAt)}
        </span>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
