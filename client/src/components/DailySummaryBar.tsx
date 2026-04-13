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

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const { data: completedOnDay = [] } = useQuery<Card[]>({
    queryKey: ["cards", "completed-day", targetDate],
    queryFn: async () => {
      const { data } = await (api.api.cards as any)["completed-today"].get({
        query: { date: targetDate },
      });
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

  const orderedCards = [...completedOnDay].sort(
    (a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()
  );
  const previewCards = orderedCards.slice(0, embedded ? 3 : 4);
  const bugCount = orderedCards.filter((card) => card.type === "bug").length;
  const storyCount = orderedCards.filter((card) => card.type === "story").length;
  const taskCount = orderedCards.filter((card) => card.type === "task").length;

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
  const dayTitle = isToday ? "Today" : formatDate(targetDate);
  const countTone =
    orderedCards.length >= 8
      ? "High-output day"
      : orderedCards.length >= 3
        ? "Steady progress"
        : orderedCards.length >= 1
          ? "Light finish"
          : "Quiet day";

  return (
    <div ref={rootRef} className={shellClass}>
      <button
        type="button"
        onClick={() => setSummaryExpanded(!summaryExpanded)}
        className={`w-full text-left transition-colors hover:bg-[var(--panel-hover)] ${
          embedded ? "px-4 py-4" : "px-3 py-3 md:px-4"
        }`}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-[var(--accent-border)] bg-[linear-gradient(180deg,var(--accent-surface),rgba(255,255,255,0.02))] text-[var(--accent-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 4.5v15M18 4.5v15M9 7.5h9M9 12h9M9 16.5h9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="meta-label mb-0">Daily Review</div>
                <div className="flex shrink-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  <ShortcutBadge shortcut={toggleHint} />
                  {summaryExpanded ? "Collapse" : "Expand"}
                </div>
              </div>
              <div className="mt-2 min-h-[2.85rem]">
                <div className="flex items-start justify-between gap-2">
                  <p className={`${embedded ? "text-[15px]" : "text-[14px]"} font-semibold text-[var(--text-primary)]`}>
                    {orderedCards.length} completed
                  </p>
                  <span className="shrink-0 rounded-full border border-[var(--border-soft)] bg-[var(--panel-ink)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                    {countTone}
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  {isToday ? "Today" : dayTitle}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniMetric label="Bug" value={bugCount} accent="#ef4444" />
            <MiniMetric label="Story" value={storyCount} accent="#a855f7" />
            <MiniMetric label="Task" value={taskCount} accent="#6366f1" />
          </div>

          {!summaryExpanded && (
            orderedCards.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-[var(--border-soft)] bg-[var(--panel-ink)] px-3.5 py-3 text-[11px] text-[var(--text-faint)]">
                Nothing to review yet. Step back one day to browse earlier completions.
              </div>
            ) : (
              <div className="grid gap-2">
                {previewCards.map((card) => {
                  const label = epicLabel(card);
                  return (
                    <div
                      key={card.id}
                      className="flex items-center gap-3 rounded-[16px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent),var(--panel-ink)] px-3.5 py-3"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_12px_currentColor]"
                        style={{ backgroundColor: typeDot[card.type] ?? "#475569", color: typeDot[card.type] ?? "#475569" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold text-[var(--text-primary)]">
                          {card.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                          <span>{formatTime(card.completedAt)}</span>
                          <span>{card.ref}</span>
                          {label && <span className="truncate normal-case tracking-normal text-[var(--text-muted)]">{label}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {orderedCards.length > previewCards.length && (
                  <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                    +{orderedCards.length - previewCards.length} more in the day ledger
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </button>

      {summaryExpanded && (
        <div className={`border-t border-[var(--border-soft)] ${embedded ? "bg-[var(--panel)]" : "bg-[var(--panel-soft)]"}`}>
          <div className={`border-b border-[var(--border-soft)] ${embedded ? "px-4 py-3.5" : "px-3 py-3 md:px-4"}`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDayOffset((d) => d - 1)}
                className="chrome-button chrome-button--compact"
              >
                <ShortcutBadge shortcut={prevHint} />
                Prev
              </button>
              <span className="flex-1 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                {dayTitle}
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

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-[var(--panel-ink)] px-3 py-3">
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Completed
                </div>
                <div className="mt-1 text-[20px] font-semibold text-[var(--text-primary)]">
                  {orderedCards.length}
                </div>
              </div>
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-[var(--panel-ink)] px-3 py-3">
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Mix
                </div>
                <div className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                  {bugCount} bug{bugCount === 1 ? "" : "s"} • {storyCount} stor{storyCount === 1 ? "y" : "ies"} • {taskCount} task{taskCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </div>

          {orderedCards.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-[var(--border-soft)] bg-[var(--panel-ink)] text-[var(--text-faint)]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M7 4.5h10A2.5 2.5 0 0 1 19.5 7v10A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5ZM8 9h8M8 12h5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="mt-4 text-[13px] font-semibold text-[var(--text-primary)]">
                No cards completed {isToday ? "today" : "on this day"}.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                Step backward to review earlier shipments, or wait for the next handoff to land here.
              </p>
            </div>
          ) : (
            <div className={`overflow-y-auto ${embedded ? "max-h-[360px] px-4 py-4" : "max-h-80 px-3 py-3 md:px-4"}`}>
              <div className="grid gap-2.5">
                {orderedCards.map((card, index) => {
                  const label = epicLabel(card);
                  return (
                    <article
                      key={card.id}
                      className="surface-panel surface-panel--soft rounded-[18px] px-3.5 py-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex min-w-[2.25rem] flex-col items-center pt-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span
                            className="mt-2 h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]"
                            style={{ backgroundColor: typeDot[card.type] ?? "#475569", color: typeDot[card.type] ?? "#475569" }}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[12.5px] font-semibold text-[var(--text-primary)]">
                                {card.title}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                                <span>{card.ref}</span>
                                <span>{formatTime(card.completedAt)}</span>
                              </div>
                            </div>

                            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--panel)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                              {card.type}
                            </span>
                          </div>

                          {label && (
                            <p className="mt-2 truncate text-[11px] leading-relaxed text-[var(--text-muted)]">
                              {label}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
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

function MiniMetric({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-[15px] border border-[var(--border-soft)] bg-[var(--panel-ink)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full shadow-[0_0_12px_currentColor]"
          style={{ backgroundColor: accent, color: accent }}
        />
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
          {label}
        </span>
      </div>
      <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}
