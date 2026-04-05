import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { api } from "../api/client";
import type { Epic, Feature, Card } from "../api/types";
import { useShortcutHint } from "../hooks/useShortcutHint";
import { ShortcutBadge } from "./ShortcutBadge";

export function HierarchySidebar() {
  const hierarchyFilter = useBoardStore((s) => s.hierarchyFilter);
  const setHierarchyFilter = useBoardStore((s) => s.setHierarchyFilter);
  const setSelectedEpicId = useBoardStore((s) => s.setSelectedEpicId);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());

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

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data } = await api.api.cards.get();
      return data ?? [];
    },
    staleTime: 5_000,
  });

  const sidebarItems = [
    { type: "all" } as const,
    ...epics.flatMap((e) => [
      { type: "epic", id: e.id } as const,
      ...features
        .filter((f) => f.epicId === e.id)
        .map((f) => ({ type: "feature", id: f.id }) as const),
    ]),
  ];

  const toggleEpic = (epicId: string) => {
    setExpandedEpics((prev) => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId);
      else next.add(epicId);
      return next;
    });
  };

  useEffect(() => {
    const move = (dir: 1 | -1) => {
      const currentIdx = sidebarItems.findIndex((item) => {
        if (item.type !== hierarchyFilter.type) return false;
        if (item.type === "epic" && hierarchyFilter.type === "epic") return item.id === hierarchyFilter.id;
        if (item.type === "feature" && hierarchyFilter.type === "feature") return item.id === hierarchyFilter.id;
        return true;
      });
      const current = sidebarItems[currentIdx];
      const next = sidebarItems[(currentIdx + dir + sidebarItems.length) % sidebarItems.length];
      if (!next) return;
      setHierarchyFilter(next);
      const ownerEpicId = (item: typeof sidebarItems[number]) => {
        if (item.type === "epic") return item.id;
        if (item.type === "feature") return features.find((f) => f.id === item.id)?.epicId ?? null;
        return null;
      };
      setExpandedEpics((prev) => {
        const updated = new Set(prev);
        const prevEpicId = current ? ownerEpicId(current) : null;
        const nextEpicId = ownerEpicId(next);
        if (prevEpicId && prevEpicId !== nextEpicId) updated.delete(prevEpicId);
        if (nextEpicId) updated.add(nextEpicId);
        return updated;
      });
    };

    const onNext = () => move(1);
    const onPrev = () => move(-1);
    const onToggle = () => {
      if (hierarchyFilter.type === "epic") toggleEpic(hierarchyFilter.id);
      else if (hierarchyFilter.type === "feature") {
        const feature = features.find((item) => item.id === hierarchyFilter.id);
        if (feature?.epicId) toggleEpic(feature.epicId);
      }
    };

    window.addEventListener("kb:sidebar-next", onNext);
    window.addEventListener("kb:sidebar-prev", onPrev);
    window.addEventListener("kb:sidebar-toggle", onToggle);
    return () => {
      window.removeEventListener("kb:sidebar-next", onNext);
      window.removeEventListener("kb:sidebar-prev", onPrev);
      window.removeEventListener("kb:sidebar-toggle", onToggle);
    };
  }, [sidebarItems, hierarchyFilter, setHierarchyFilter, features]);

  const isActive = (filter: typeof hierarchyFilter) => {
    if (filter.type !== hierarchyFilter.type) return false;
    if (filter.type === "epic" && hierarchyFilter.type === "epic") return filter.id === hierarchyFilter.id;
    if (filter.type === "feature" && hierarchyFilter.type === "feature") return filter.id === hierarchyFilter.id;
    return true;
  };

  const getEpicCardCount = (epicId: string) =>
    cards.filter((c) => c.epicId === epicId).length;

  const getFeatureCardCount = (featureId: string) =>
    cards.filter((c) => c.featureId === featureId).length;

  const filterAllHint = useShortcutHint("filter-all");

  return (
    <aside className="surface-panel surface-panel--soft flex w-[248px] shrink-0 flex-col overflow-hidden">
      <div className="border-b border-[var(--border-soft)] px-3.5 py-3">
        <div className="meta-label mb-1.5">Hierarchy</div>
        <h2 className="text-[0.95rem] font-semibold text-[var(--text-primary)]">
          Browse scope
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SidebarStat label="Epics" value={String(epics.length)} />
          <SidebarStat label="Features" value={String(features.length)} />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-2.5">
        <SidebarItem
          label="All cards"
          count={cards.length}
          active={isActive({ type: "all" })}
          onClick={() => {
            setHierarchyFilter({ type: "all" });
            setSelectedEpicId(null);
          }}
          indent={0}
          hint={filterAllHint}
        />

        <div className="my-2 border-t border-[var(--border-soft)]" />

        {epics.map((epic) => {
          const expanded = expandedEpics.has(epic.id);
          const epicFeatures = features.filter((f) => f.epicId === epic.id);

          return (
            <div key={epic.id} className="mb-1.5 last:mb-0">
              <div
                className={`group flex items-center gap-2 rounded-[14px] border px-2 py-2 transition-colors ${
                  isActive({ type: "epic", id: epic.id })
                    ? "border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--text-primary)]"
                    : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-soft)] hover:bg-[var(--panel)]"
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleEpic(epic.id);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-[10px] border border-[var(--border-soft)] bg-[var(--panel-ink)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
                  aria-label={expanded ? "Collapse" : "Expand"}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    className={`transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
                  >
                    <path
                      d="M3 2l4 3-4 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setHierarchyFilter({ type: "epic", id: epic.id });
                    setSelectedEpicId(epic.id);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-[12.5px] font-semibold">{epic.title}</div>
                  <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                    Epic
                  </div>
                </button>

                <span className="stat-pill !rounded-[10px] !px-2 !py-1 !text-[0.55rem]">
                  {getEpicCardCount(epic.id)}
                </span>
              </div>

              {expanded && (
                <div className="mt-1.5 space-y-1">
                  {epicFeatures.map((feature) => (
                    <SidebarItem
                      key={feature.id}
                      label={feature.title}
                      count={getFeatureCardCount(feature.id)}
                      active={isActive({ type: "feature", id: feature.id })}
                      onClick={() => {
                        setHierarchyFilter({ type: "feature", id: feature.id });
                        setSelectedEpicId(epic.id);
                      }}
                      indent={1}
                    />
                  ))}

                  {epicFeatures.length === 0 && (
                    <div className="px-4 py-2 text-[11px] text-[var(--text-faint)]">
                      no features
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {epics.length === 0 && (
          <div className="px-3 py-2 text-[12px] text-[var(--text-faint)]">
            no epics
          </div>
        )}
      </nav>
    </aside>
  );
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel bg-transparent px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

interface SidebarItemProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  indent: number;
  muted?: boolean;
  hint?: string | null;
}

function SidebarItem({ label, count, active, onClick, indent, muted, hint }: SidebarItemProps) {
  const paddingLeft = 12 + indent * 18;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-[12px] border px-3 py-2 text-left transition-colors ${
        active
          ? "border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--text-primary)]"
          : muted
            ? "border-transparent text-[var(--text-dim)] hover:border-[var(--border-soft)] hover:bg-[var(--panel)] hover:text-[var(--text-muted)]"
            : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-soft)] hover:bg-[var(--panel)] hover:text-[var(--text-primary)]"
      }`}
      style={{ paddingLeft }}
    >
      <span className="flex-1 truncate text-[12.5px]">{label}</span>
      {hint && <ShortcutBadge shortcut={hint} />}
      <span className="stat-pill !rounded-[10px] !px-2 !py-1 !text-[0.55rem]">
        {count}
      </span>
    </button>
  );
}
