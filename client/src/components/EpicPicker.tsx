import { useQuery } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { api } from "../api/client";
import type { Epic, Workflow, Card } from "../api/types";

export function EpicPicker() {
  const setSelectedEpicId = useBoardStore((s) => s.setSelectedEpicId);
  const setHierarchyFilter = useBoardStore((s) => s.setHierarchyFilter);

  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: ["epics"],
    queryFn: async () => {
      const { data } = await api.api.epics.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data } = await api.api.workflows.get();
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

  const workflowMap = new Map(workflows.map((w) => [w.id, w]));

  const handleSelect = (epicId: string) => {
    setSelectedEpicId(epicId);
    setHierarchyFilter({ type: "epic", id: epicId });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-lg font-mono font-semibold text-[#e2e8f0]">Select an Epic</h1>
        <p className="text-[12px] font-mono text-[#475569] mt-1">
          Choose an epic to open its board
        </p>
      </div>

      {epics.length === 0 ? (
        <div className="text-[13px] font-mono text-[#334155]">
          No epics found. Create one in the admin panel.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {epics.map((epic) => {
            const workflow = epic.workflowId ? workflowMap.get(epic.workflowId) : null;
            const cardCount = cards.filter((c) => c.epicId === epic.id).length;

            return (
              <button
                key={epic.id}
                onClick={() => handleSelect(epic.id)}
                className="text-left bg-[#111118] border border-[#2a2a38] rounded hover:border-[#3a3a4a] hover:bg-[#16161f] transition-colors duration-150 p-4 focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[13px] font-mono font-semibold text-[#e2e8f0] leading-snug line-clamp-2 flex-1">
                    {epic.title}
                  </span>
                  {workflow && (
                    <span
                      className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-sm border"
                      style={
                        workflow.type === "worktree"
                          ? { color: "#818cf8", borderColor: "#3a3a5a", backgroundColor: "#1a1a2e" }
                          : { color: "#475569", borderColor: "#2a2a38", backgroundColor: "#1a1a24" }
                      }
                    >
                      {workflow.type}
                    </span>
                  )}
                </div>

                {epic.description && (
                  <p className="text-[11px] font-mono text-[#64748b] leading-relaxed line-clamp-2 mb-3">
                    {epic.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-mono text-[#475569] bg-[#1a1a24] px-1.5 py-0.5 rounded">
                    {cardCount} card{cardCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
