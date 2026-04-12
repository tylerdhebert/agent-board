import type { Card, Status } from "../api/types";
import { useBoardStore } from "../store";
import { TypeBadge } from "./TypeBadge";
import { StatusBadge } from "./StatusBadge";

interface Props {
  card: Card;
  status: Status;
  blockedCardIds?: Set<string>;
}

export function CardTile({ card, status, blockedCardIds }: Props) {
  const setSelectedCardId = useBoardStore((s) => s.setSelectedCardId);
  const setOpenModal = useBoardStore((s) => s.setOpenModal);
  const pulsingCardIds = useBoardStore((s) => s.pulsingCardIds);
  const unseenCommentCardIds = useBoardStore((s) => s.unseenCommentCardIds);
  const clearUnseenComment = useBoardStore((s) => s.clearUnseenComment);

  const isPulsing = pulsingCardIds.has(card.id);
  const hasUnseenComment = unseenCommentCardIds.has(card.id);
  const isBlocked =
    (blockedCardIds?.has(card.id) ?? false)
    || status.name.toLowerCase() === "blocked"
    || Boolean(card.blockedReason);
  const summary = card.blockedReason ?? card.latestUpdate ?? card.plan ?? null;

  const handleClick = () => {
    clearUnseenComment(card.id);
    setSelectedCardId(card.id);
    setOpenModal("card");
  };

  return (
    <div
      onClick={handleClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleClick();
      }}
      className={`group relative cursor-pointer rounded-[18px] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3.5 transition-colors duration-150 hover:border-[var(--border)] hover:bg-[var(--panel-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-border)] ${
        isPulsing ? "card-pulse" : ""
      } ${hasUnseenComment ? "card-comment-glow" : ""}`}
      style={{ boxShadow: `inset 3px 0 0 ${status.color}` }}
    >
      {hasUnseenComment && (
        <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">
          !
        </span>
      )}

      <div className="mb-3 flex items-center gap-1.5">
        <span className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--panel-ink)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          {card.ref}
        </span>
        <TypeBadge type={card.type} />
        <StatusBadge status={status} />
        <div className="ml-auto flex items-center gap-1.5">
          {card.conflictedAt && (
            <span className="rounded-[10px] border border-amber-400/30 bg-amber-400/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-300">
              conflict
            </span>
          )}
          {isBlocked && (
            <span className="rounded-[10px] border border-red-400/30 bg-red-400/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-red-300">
              blocked
            </span>
          )}
          {isPulsing && (
            <span className="rounded-[10px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]">
              input
            </span>
          )}
        </div>
      </div>

      <p className="line-clamp-3 text-[14px] font-semibold leading-snug text-[var(--text-primary)]">
        {card.title}
      </p>

      {summary && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {summary}
        </p>
      )}

      {card.branchName && (
        <div className="mt-3">
          <span className="inline-flex max-w-full items-center gap-1 rounded-[10px] border border-[var(--accent-border)] bg-[var(--accent-surface)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            branch {card.branchName}
          </span>
        </div>
      )}

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {card.agentId ? (
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {card.agentId}
            </div>
          ) : (
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
              unassigned
            </div>
          )}
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
          {formatRelative(card.updatedAt)}
        </span>
      </div>
    </div>
  );
}

function formatRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
