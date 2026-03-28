import { useQuery } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { api } from "../api/client";
import type { Card, Epic, Workflow, WorkflowStatus } from "../api/types";
import { KanbanColumn } from "./KanbanColumn";
import { EpicPicker } from "./EpicPicker";
import { BaseBranchPanel } from "./BaseBranchPanel";

export function Board() {
  const selectedEpicId = useBoardStore((s) => s.selectedEpicId);
  const setSelectedEpicId = useBoardStore((s) => s.setSelectedEpicId);
  const setHierarchyFilter = useBoardStore((s) => s.setHierarchyFilter);
  const hierarchyFilter = useBoardStore((s) => s.hierarchyFilter);

  const { data: cards = [], isLoading: cardsLoading } = useQuery<Card[]>({
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

  const selectedEpic = epics.find((e) => e.id === selectedEpicId) ?? null;
  const workflowId = selectedEpic?.workflowId ?? null;

  const { data: workflowStatuses = [], isLoading: workflowLoading } = useQuery<WorkflowStatus[]>({
    queryKey: ["workflow-statuses", workflowId],
    queryFn: async () => {
      const { data } = await api.api.workflows({ id: workflowId! }).statuses.get();
      return (data as WorkflowStatus[]) ?? [];
    },
    enabled: !!workflowId,
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

  // Fetch all card dependencies to compute which cards are blocked (N+1-free: one request)
  const { data: allDependencies = [] } = useQuery<{ blockerCardId: string; blockedCardId: string }[]>({
    queryKey: ["card-dependencies-all"],
    queryFn: async () => {
      const { data } = await (api.api.cards as any).dependencies.get();
      return (data as { blockerCardId: string; blockedCardId: string }[]) ?? [];
    },
    staleTime: 30_000,
  });

  // If no epic is selected, show the epic picker
  if (!selectedEpicId) {
    return <EpicPicker />;
  }

  const epicCards = cards.filter((c) => c.epicId === selectedEpicId);

  // Build set of card IDs that have at least one non-Done blocker
  const doneCardIds = new Set(
    cards
      .filter((c) => {
        // We'd need statuses here to check by name; use completedAt as a proxy for Done
        // Cards that have completedAt set are done; this avoids needing statuses in Board
        return c.completedAt !== null;
      })
      .map((c) => c.id)
  );
  const blockedCardIds = new Set<string>(
    allDependencies
      .filter((dep) => !doneCardIds.has(dep.blockerCardId))
      .map((dep) => dep.blockedCardId)
  );
  const visibleCards = hierarchyFilter.type === "feature"
    ? epicCards.filter((c) => c.featureId === hierarchyFilter.id)
    : epicCards;

  const isLoading = cardsLoading || (!!workflowId && workflowLoading);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[#334155] font-mono text-xs animate-pulse">
          loading...
        </span>
      </div>
    );
  }

  const currentWorkflow = workflowId
    ? workflows.find((w) => w.id === workflowId) ?? null
    : null;
  const isWorktree = currentWorkflow?.type === "worktree";

  const handleBackToEpics = () => {
    setSelectedEpicId(null);
    setHierarchyFilter({ type: "all" });
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Back button row */}
        <div className="px-4 pt-3 pb-0 shrink-0">
          <button
            onClick={handleBackToEpics}
            className="text-[11px] font-mono text-[#475569] hover:text-[#94a3b8] transition-colors"
          >
            ← All Epics
          </button>
        </div>

        {/* Columns */}
        <div className="flex-1 flex gap-3 p-4 overflow-x-auto overflow-y-hidden min-h-0">
          {workflowStatuses.length === 0 && !workflowId && (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[#334155] font-mono text-xs">
                No workflow assigned to this epic.
              </span>
            </div>
          )}
          {workflowStatuses.map((ws) => {
            const columnCards = visibleCards.filter((c) => c.statusId === ws.statusId);
            return (
              <KanbanColumn key={ws.id} workflowStatus={ws} cards={columnCards} blockedCardIds={blockedCardIds} />
            );
          })}
        </div>
      </div>

      {/* BaseBranchPanel for worktree epics */}
      {isWorktree && <BaseBranchPanel epicId={selectedEpicId} />}
    </div>
  );
}
