import { useState, useEffect } from "react";
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

  // Ordered list of all sidebar filter items: all → epics+features
  const sidebarItems = [
    { type: "all" } as const,
    ...epics.flatMap((e) => [
      { type: "epic", id: e.id } as const,
      ...features.filter((f) => f.epicId === e.id).map((f) => ({ type: "feature", id: f.id }) as const),
    ]),
  ];

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
      // Collapse the epic context we're leaving, expand the one we're entering
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
        const feat = sidebarItems.find(
          (i) => i.type === "feature" && i.id === hierarchyFilter.id
        ) as { type: "feature"; id: string } | undefined;
        if (feat) {
          const parentEpic = epics.find((e) =>
            features.some((f) => f.id === feat.id && f.epicId === e.id)
          );
          if (parentEpic) toggleEpic(parentEpic.id);
        }
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
  }, [sidebarItems, hierarchyFilter, setHierarchyFilter, setExpandedEpics, epics, features]);

  const toggleEpic = (epicId: string) => {
    setExpandedEpics((prev) => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        next.delete(epicId);
      } else {
        next.add(epicId);
      }
      return next;
    });
  };

  const isActive = (filter: typeof hierarchyFilter) => {
    if (filter.type !== hierarchyFilter.type) return false;
    if (filter.type === "epic" && hierarchyFilter.type === "epic") {
      return filter.id === hierarchyFilter.id;
    }
    if (filter.type === "feature" && hierarchyFilter.type === "feature") {
      return filter.id === hierarchyFilter.id;
    }
    return true;
  };

  const getEpicCardCount = (epicId: string) =>
    cards.filter((c) => c.epicId === epicId).length;

  const getFeatureCardCount = (featureId: string) =>
    cards.filter((c) => c.featureId === featureId).length;

  const filterAllHint = useShortcutHint("filter-all");
  const sidebarToggleHint = useShortcutHint("sidebar-toggle");

  return (
    <aside className="w-[220px] shrink-0 flex flex-col bg-[#0d0d14] border-r border-[#1e1e2a] overflow-y-auto">
      {/* Sidebar header */}
      <div className="px-3 py-2.5 border-b border-[#1e1e2a]">
        <span className="text-[12px] font-mono text-[#475569] uppercase tracking-wider">
          Hierarchy
        </span>
      </div>

      <nav className="flex-1 py-1">
        {/* All item */}
        <SidebarItem
          label="All"
          count={cards.length}
          active={isActive({ type: "all" })}
          onClick={() => {
            setHierarchyFilter({ type: "all" });
            setSelectedEpicId(null);
          }}
          indent={0}
          hint={filterAllHint}
        />

        {/* Epics and their features */}
        {epics.map((epic) => {
          const expanded = expandedEpics.has(epic.id);
          const epicFeatures = features.filter((f) => f.epicId === epic.id);

          return (
            <div key={epic.id}>
              <div
                className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer group transition-colors duration-100 ${
                  isActive({ type: "epic", id: epic.id })
                    ? "bg-[#1e1e30] text-[#818cf8]"
                    : "text-[#94a3b8] hover:bg-[#111118] hover:text-[#e2e8f0]"
                }`}
              >
                {/* Chevron */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleEpic(epic.id);
                  }}
                  className="w-4 h-4 flex items-center justify-center text-[#475569] hover:text-[#94a3b8] shrink-0 transition-colors"
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

                {/* Epic label */}
                <span
                  className="flex-1 text-[13px] font-mono truncate"
                  onClick={() => {
                    setHierarchyFilter({ type: "epic", id: epic.id });
                    setSelectedEpicId(epic.id);
                  }}
                >
                  {epic.title}
                </span>

                {/* Count */}
                <span
                  className={`text-[11px] font-mono shrink-0 px-1 rounded ${
                    isActive({ type: "epic", id: epic.id })
                      ? "text-[#6366f1] bg-[#1a1a30]"
                      : "text-[#475569] bg-[#1a1a24]"
                  }`}
                >
                  {getEpicCardCount(epic.id)}
                </span>
                <ShortcutBadge shortcut={sidebarToggleHint} />
              </div>

              {/* Features under this epic */}
              {expanded &&
                epicFeatures.map((feature) => (
                  <SidebarItem
                    key={feature.id}
                    label={feature.title}
                    count={getFeatureCardCount(feature.id)}
                    active={isActive({ type: "feature", id: feature.id })}
                    onClick={() => {
                      setHierarchyFilter({ type: "feature", id: feature.id });
                      setSelectedEpicId(epic.id);
                    }}
                    indent={2}
                  />
                ))}

              {expanded && epicFeatures.length === 0 && (
                <div className="pl-10 py-1 text-[12px] font-mono text-[#334155]">
                  no features
                </div>
              )}
            </div>
          );
        })}

        {epics.length === 0 && (
          <div className="px-3 py-2 text-[12px] font-mono text-[#334155]">
            no epics
          </div>
        )}

      </nav>
    </aside>
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
  const paddingLeft = 12 + indent * 8;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 py-1.5 text-left transition-colors duration-100 ${
        active
          ? "bg-[#1e1e30] text-[#818cf8]"
          : muted
          ? "text-[#475569] hover:bg-[#111118] hover:text-[#64748b]"
          : "text-[#94a3b8] hover:bg-[#111118] hover:text-[#e2e8f0]"
      }`}
      style={{ paddingLeft }}
    >
      <span className="flex-1 text-[13px] font-mono truncate">{label}</span>
      {hint && (
        <kbd className="px-1 py-0.5 text-[9px] font-mono bg-[#1e1e30] text-[#6366f1] border border-[#3a3a58] rounded leading-none pointer-events-none">
          {hint}
        </kbd>
      )}
      <span
        className={`text-[11px] font-mono shrink-0 px-1 rounded mr-2 ${
          active
            ? "text-[#6366f1] bg-[#1a1a30]"
            : "text-[#475569] bg-[#1a1a24]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
