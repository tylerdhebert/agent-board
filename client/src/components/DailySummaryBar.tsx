import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Card, Epic, Feature } from "../api/types";
import { useBoardStore } from "../store";
import { useShortcutHint } from "../hooks/useShortcutHint";
import { ShortcutBadge } from "./ShortcutBadge";

function dateKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric" }
  );
}

export function DailySummaryBar() {
  const summaryExpanded = useBoardStore((s) => s.summaryExpanded);
  const setSummaryExpanded = useBoardStore((s) => s.setSummaryExpanded);
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, -1 = yesterday, etc.
  const toggleHint = useShortcutHint("toggle-summary");
  const prevHint = useShortcutHint("summary-prev");
  const nextHint = useShortcutHint("summary-next");

  // Listen for keyboard shortcut day navigation events
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
    (c) => typeof c.completedAt === "string" && c.completedAt.startsWith(targetDate)
  );

  const epicLabel = (card: Card) => {
    if (card.featureId) {
      const f = features.find((x) => x.id === card.featureId);
      const e = f ? epics.find((x) => x.id === f.epicId) : null;
      if (e && f) return `${e.title} › ${f.title}`;
      if (f) return f.title;
    }
    if (card.epicId) {
      const e = epics.find((x) => x.id === card.epicId);
      if (e) return e.title;
    }
    return null;
  };

  const typeDot: Record<string, string> = {
    bug: "#ef4444",
    story: "#a855f7",
    task: "#6366f1",
  };

  return (
    <div className="shrink-0 border-t border-[#1e1e2a] bg-[#0a0a0f]">
      {/* Collapsed bar — always visible */}
      <button
        onClick={() => setSummaryExpanded(!summaryExpanded)}
        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#111118] transition-colors text-left"
      >
        <span className="text-[10px] font-mono text-[#475569] uppercase tracking-wider shrink-0">
          Daily Summary
        </span>
        <span className="text-[10px] font-mono text-[#334155]">|</span>
        <span className="text-[10px] font-mono text-[#22c55e]">
          {completedOnDay.length} completed{" "}
          {isToday ? "today" : `on ${formatDate(targetDate)}`}
        </span>
        {completedOnDay.length > 0 && !summaryExpanded && (
          <span className="flex gap-1.5 ml-1 overflow-hidden">
            {completedOnDay.slice(0, 6).map((c) => (
              <span
                key={c.id}
                className="text-[11px] font-mono text-[#64748b] truncate max-w-[120px]"
              >
                {c.title}
              </span>
            ))}
            {completedOnDay.length > 6 && (
              <span className="text-[10px] font-mono text-[#334155]">
                +{completedOnDay.length - 6} more
              </span>
            )}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-[#334155]">
          <ShortcutBadge shortcut={toggleHint} />
          {summaryExpanded ? "▼" : "▲"}
        </span>
      </button>

      {/* Expanded panel */}
      {summaryExpanded && (
        <div className="border-t border-[#1e1e2a] bg-[#0d0d14] max-h-64 overflow-y-auto">
          {/* Day navigation */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e1e2a] sticky top-0 bg-[#0d0d14]">
            <button
              onClick={() => setDayOffset((d) => d - 1)}
              className="flex items-center gap-1 text-[11px] font-mono text-[#475569] hover:text-[#94a3b8] transition-colors"
            >
              <ShortcutBadge shortcut={prevHint} />
              ← prev
            </button>
            <span className="text-[11px] font-mono text-[#e2e8f0] flex-1 text-center">
              {isToday ? "Today" : formatDate(targetDate)}
            </span>
            <button
              onClick={() => setDayOffset((d) => d + 1)}
              disabled={dayOffset >= 0}
              className="flex items-center gap-1 text-[11px] font-mono text-[#475569] hover:text-[#94a3b8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              next →
              <ShortcutBadge shortcut={nextHint} />
            </button>
          </div>

          {/* Card list */}
          {completedOnDay.length === 0 ? (
            <div className="px-4 py-6 text-center text-[11px] font-mono text-[#334155]">
              No cards completed {isToday ? "today" : "on this day"}.
            </div>
          ) : (
            <div className="divide-y divide-[#1e1e2a]">
              {completedOnDay.map((card) => {
                const label = epicLabel(card);
                return (
                  <div key={card.id} className="flex items-center gap-3 px-4 py-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: typeDot[card.type] ?? "#475569" }}
                    />
                    <span className="text-[12px] font-mono text-[#e2e8f0] flex-1 min-w-0 truncate">
                      {card.title}
                    </span>
                    {label && (
                      <span className="text-[10px] font-mono text-[#475569] shrink-0 truncate max-w-[200px]">
                        {label}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-[#334155] shrink-0 uppercase">
                      {card.type}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
