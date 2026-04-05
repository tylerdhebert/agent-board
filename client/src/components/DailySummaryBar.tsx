import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Card, Epic, Feature } from "../api/types";
import { useBoardStore } from "../store";
import { useShortcutHint } from "../hooks/useShortcutHint";
import { ShortcutBadge } from "./ShortcutBadge";

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatLocalDateKey(d);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric" }
  );
}

export function DailySummaryBar({ embedded = false }: { embedded?: boolean }) {
  const summaryExpanded = useBoardStore((s) => s.summaryExpanded);
  const setSummaryExpanded = useBoardStore((s) => s.setSummaryExpanded);
  const setSummaryBarHeight = useBoardStore((s) => s.setSummaryBarHeight);
  const rootRef = useRef<HTMLDivElement>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const toggleHint = useShortcutHint("toggle-summary");
  const prevHint = useShortcutHint("summary-prev");
  const nextHint = useShortcutHint("summary-next");

  useEffect(() => {
    if (embedded) {
      setSummaryBarHeight(0);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSummaryBarHeight(el.offsetHeight));
    ro.observe(el);
    setSummaryBarHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [embedded, setSummaryBarHeight]);

  useEffect(() => {
    const prev = () => setDayOffset((d) => d - 1);
    const next = () => setDayOffset((d) => (d < 0 ? d + 1 : d));
    window.addEventListener("kb:summary-prev", prev);
    window.addEventListener("kb:summary-next", next);
    return () => {
      window.removeEventListener("kb:summary-prev", prev);
      window.removeEventListener("kb:summary-next", next);
    };
  }, []);

  const targetDate = dateKey(dayOffset);
  const isToday = dayOffset === 0;

  const { data: allCards = [] } = useQuery<Card[]>({
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

  const completedOnDay = allCards.filter(
    (c) =>
      typeof c.completedAt === "string"
      && formatLocalDateKey(new Date(c.completedAt)) === targetDate
  );

  const epicLabel = (card: Card) => {
    if (card.featureId) {
      const feature = features.find((item) => item.id === card.featureId);
      const epic = feature ? epics.find((item) => item.id === feature.epicId) : null;
      if (epic && feature) return `${epic.title} / ${feature.title}`;
      if (feature) return feature.title;
    }
    if (card.epicId) {
      const epic = epics.find((item) => item.id === card.epicId);
      if (epic) return epic.title;
    }
    return null;
  };

  const typeDot: Record<string, string> = {
    bug: "#ef4444",
    story: "#a855f7",
    task: "#6366f1",
  };

  const shellClass = embedded
    ? "surface-panel surface-panel--soft overflow-hidden"
    : "shrink-0 border-t border-[var(--border-soft)] bg-[var(--panel)]";

  return (
    <div ref={rootRef} className={shellClass}>
      <button
        type="button"
        onClick={() => setSummaryExpanded(!summaryExpanded)}
        className={`w-full text-left transition-colors hover:bg-[var(--panel-hover)] ${
          embedded ? "px-4 py-3" : "px-3 py-2.5 md:px-4"
        }`}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
              Daily Review
            </div>
            <div className={`mt-1 ${embedded ? "text-[13px] font-semibold" : "text-[12px]"} text-[var(--text-primary)]`}>
              {completedOnDay.length} completed {isToday ? "today" : `on ${formatDate(targetDate)}`}
            </div>
          </div>

          {completedOnDay.length > 0 && !summaryExpanded && (
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {completedOnDay.slice(0, 5).map((card) => (
                <span
                  key={card.id}
                  className="stat-pill !rounded-[10px] !px-2.5 !py-1 !text-[0.58rem]"
                >
                  {card.title}
                </span>
              ))}
              {completedOnDay.length > 5 && (
                <span className="stat-pill !rounded-[10px] !px-2.5 !py-1 !text-[0.58rem]">
                  +{completedOnDay.length - 5} more
                </span>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
            <ShortcutBadge shortcut={toggleHint} />
            {summaryExpanded ? "Collapse" : "Expand"}
          </div>
        </div>
      </button>

      {summaryExpanded && (
        <div className={`border-t border-[var(--border-soft)] ${embedded ? "bg-[var(--panel)]" : "bg-[var(--panel-soft)]"}`}>
          <div className={`flex items-center gap-2 border-b border-[var(--border-soft)] ${embedded ? "px-4 py-3" : "px-3 py-2.5 md:px-4"}`}>
            <button
              type="button"
              onClick={() => setDayOffset((d) => d - 1)}
              className="chrome-button chrome-button--compact"
            >
              <ShortcutBadge shortcut={prevHint} />
              Prev
            </button>
            <span className="flex-1 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              {isToday ? "Today" : formatDate(targetDate)}
            </span>
            <button
              type="button"
              onClick={() => setDayOffset((d) => d + 1)}
              disabled={dayOffset >= 0}
              className="chrome-button chrome-button--compact disabled:opacity-35"
            >
              Next
              <ShortcutBadge shortcut={nextHint} />
            </button>
          </div>

          {completedOnDay.length === 0 ? (
            <div className="px-4 py-7 text-center text-[12px] text-[var(--text-faint)]">
              No cards completed {isToday ? "today" : "on this day"}.
            </div>
          ) : (
            <div className={`overflow-y-auto ${embedded ? "max-h-[260px] px-4 py-4" : "max-h-64 px-3 py-3 md:px-4"}`}>
              <div className="grid gap-2">
                {completedOnDay.map((card) => {
                  const label = epicLabel(card);
                  return (
                    <div
                      key={card.id}
                      className="surface-panel surface-panel--soft flex items-center gap-3 rounded-[14px] px-3.5 py-3"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: typeDot[card.type] ?? "#475569" }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--text-primary)]">
                        {card.title}
                      </span>
                      {label && (
                        <span className="hidden max-w-[260px] truncate text-[11px] text-[var(--text-muted)] lg:inline">
                          {label}
                        </span>
                      )}
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                        {card.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
