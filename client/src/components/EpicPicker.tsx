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
    <div className="flex min-h-0 flex-1 overflow-y-auto">
      <div className="w-full px-4 py-5 md:px-6 md:py-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-[760px]">
            <div className="meta-label mb-2">Board</div>
            <h1 className="display-title text-[2.25rem] leading-none md:text-[2.9rem]">
              Select an epic
            </h1>
            <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-[var(--text-muted)]">
              Open an epic to enter the board, review blockers, and keep branch activity visible
              without crowding the workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <PickerStat label="Epics" value={String(epics.length)} />
            <PickerStat label="Cards" value={String(cards.length)} />
          </div>
        </div>

        {epics.length === 0 ? (
          <div className="surface-panel mt-6 rounded-[18px] border-dashed px-6 py-10 text-[13px] text-[var(--text-faint)]">
            No epics found. Create one in the admin panel.
          </div>
        ) : (
          <div className="mt-6 grid content-start justify-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,320px))]">
            {epics.map((epic) => {
              const workflow = epic.workflowId ? workflowMap.get(epic.workflowId) : null;
              const cardCount = cards.filter((c) => c.epicId === epic.id).length;

              return (
                <button
                  key={epic.id}
                  type="button"
                  onClick={() => handleSelect(epic.id)}
                  className="surface-panel group rounded-[20px] p-4 text-left transition-colors duration-150 hover:border-[var(--accent-border)] hover:bg-[var(--panel-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-border)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                        Epic
                      </div>
                      <span className="mt-2 block text-[17px] font-semibold leading-snug text-[var(--text-primary)]">
                        {epic.title}
                      </span>
                    </div>
                    {workflow && (
                      <span
                        className={`stat-pill shrink-0 ${
                          workflow.type === "worktree"
                            ? "!border-[var(--accent-border)] !bg-[var(--accent-surface)] !text-[var(--accent-strong)]"
                            : ""
                        }`}
                      >
                        {workflow.type}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 line-clamp-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
                    {epic.description?.trim() || "No description yet. Open the board to start coordinating work."}
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-3">
                    <span className="stat-pill">
                      {cardCount} card{cardCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)] transition-transform duration-150 group-hover:translate-x-0.5">
                      Open board
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PickerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel bg-transparent px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}
