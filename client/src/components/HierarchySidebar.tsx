import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { API_BASE } from "../api/client";
import type { Epic, Feature, Card } from "../api/types";

export function HierarchySidebar() {
  const hierarchyFilter = useBoardStore((s) => s.hierarchyFilter);
  const setHierarchyFilter = useBoardStore((s) => s.setHierarchyFilter);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());

  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: ["epics"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/epics`);
      if (!res.ok) throw new Error("Failed to fetch epics");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: features = [] } = useQuery<Feature[]>({
    queryKey: ["features"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/features`);
      if (!res.ok) throw new Error("Failed to fetch features");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/cards`);
      if (!res.ok) throw new Error("Failed to fetch cards");
      return res.json();
    },
    staleTime: 5_000,
  });

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

  const unassignedCount = cards.filter(
    (c) => c.epicId === null && c.featureId === null
  ).length;

  return (
    <aside className="w-[220px] shrink-0 flex flex-col bg-[#0d0d14] border-r border-[#1e1e2a] overflow-y-auto">
      {/* Sidebar header */}
      <div className="px-3 py-2.5 border-b border-[#1e1e2a]">
        <span className="text-[10px] font-mono text-[#475569] uppercase tracking-wider">
          Hierarchy
        </span>
      </div>

      <nav className="flex-1 py-1">
        {/* All item */}
        <SidebarItem
          label="All"
          count={cards.length}
          active={isActive({ type: "all" })}
          onClick={() => setHierarchyFilter({ type: "all" })}
          indent={0}
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
                  className="flex-1 text-[11px] font-mono truncate"
                  onClick={() =>
                    setHierarchyFilter({ type: "epic", id: epic.id })
                  }
                >
                  {epic.title}
                </span>

                {/* Count */}
                <span
                  className={`text-[10px] font-mono shrink-0 px-1 rounded ${
                    isActive({ type: "epic", id: epic.id })
                      ? "text-[#6366f1] bg-[#1a1a30]"
                      : "text-[#475569] bg-[#1a1a24]"
                  }`}
                >
                  {getEpicCardCount(epic.id)}
                </span>
              </div>

              {/* Features under this epic */}
              {expanded &&
                epicFeatures.map((feature) => (
                  <SidebarItem
                    key={feature.id}
                    label={feature.title}
                    count={getFeatureCardCount(feature.id)}
                    active={isActive({ type: "feature", id: feature.id })}
                    onClick={() =>
                      setHierarchyFilter({ type: "feature", id: feature.id })
                    }
                    indent={2}
                  />
                ))}

              {expanded && epicFeatures.length === 0 && (
                <div className="pl-10 py-1 text-[10px] font-mono text-[#334155]">
                  no features
                </div>
              )}
            </div>
          );
        })}

        {epics.length === 0 && (
          <div className="px-3 py-2 text-[10px] font-mono text-[#334155]">
            no epics
          </div>
        )}

        {/* Divider */}
        <div className="mx-3 my-1 border-t border-[#1e1e2a]" />

        {/* Unassigned */}
        <SidebarItem
          label="Unassigned"
          count={unassignedCount}
          active={isActive({ type: "unassigned" })}
          onClick={() => setHierarchyFilter({ type: "unassigned" })}
          indent={0}
          muted
        />
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
}

function SidebarItem({ label, count, active, onClick, indent, muted }: SidebarItemProps) {
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
      <span className="flex-1 text-[11px] font-mono truncate">{label}</span>
      <span
        className={`text-[10px] font-mono shrink-0 px-1 rounded mr-2 ${
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
