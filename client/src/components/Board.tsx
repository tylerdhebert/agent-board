import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { api } from "../api/client";
import type { Card, Epic, Status, Workflow, WorkflowStatus } from "../api/types";
import { KanbanColumn } from "./KanbanColumn";
import { EpicPicker } from "./EpicPicker";
import { BaseBranchPanel } from "./BaseBranchPanel";

export function Board() {
  const laneScrollerRef = useRef<HTMLDivElement>(null);
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

  const { data: statuses = [], isLoading: statusesLoading } = useQuery<Status[]>({
    queryKey: ["statuses"],
    queryFn: async () => {
      const { data } = await api.api.statuses.get();
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

  const { data: allDependencies = [] } = useQuery<{ blockerCardId: string; blockedCardId: string }[]>({
    queryKey: ["card-dependencies-all"],
    queryFn: async () => {
      const { data } = await (api.api.cards as any).dependencies.get();
      return (data as { blockerCardId: string; blockedCardId: string }[]) ?? [];
    },
    staleTime: 30_000,
  });

  if (!selectedEpicId) {
    return <EpicPicker />;
  }

  const epicCards = cards.filter((c) => c.epicId === selectedEpicId);
  const doneStatusId = statuses.find((status) => status.name.toLowerCase() === "done")?.id;
  const doneCardIds = new Set(
    cards
      .filter((c) => c.statusId === doneStatusId)
      .map((c) => c.id)
  );
  const blockedCardIds = new Set<string>(
    allDependencies
      .filter((dep) => !doneCardIds.has(dep.blockerCardId))
      .map((dep) => dep.blockedCardId)
  );
  const visibleCards =
    hierarchyFilter.type === "feature"
      ? epicCards.filter((c) => c.featureId === hierarchyFilter.id)
      : epicCards;
  const isLoading = cardsLoading || statusesLoading || (!!workflowId && workflowLoading);

  if (isLoading) {
    return (
      <div className="surface-panel surface-panel--soft flex flex-1 items-center justify-center">
        <span className="text-xs font-mono text-[var(--text-faint)] animate-pulse">loading...</span>
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

  const filterLabel =
    hierarchyFilter.type === "feature"
      ? "Feature focus"
      : hierarchyFilter.type === "epic"
        ? "Epic overview"
        : "All cards";

  const epicDescription = selectedEpic?.description?.trim()
    ? selectedEpic.description
    : "Track execution across statuses, surface blockers early, and keep the current epic legible at a glance.";

  const handleLaneWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const container = laneScrollerRef.current;
    if (!container) return;

    const canScrollHorizontally = container.scrollWidth > container.clientWidth;
    if (!canScrollHorizontally) return;

    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (shouldPreserveVerticalScroll(event.target, container, event.deltaY)) return;

    event.preventDefault();
    container.scrollLeft += event.deltaY;
  };

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4 md:p-6">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="surface-panel surface-panel--soft mb-4 shrink-0 px-4 py-3.5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleBackToEpics}
                  className="chrome-button chrome-button--compact"
                >
                  Back to epics
                </button>
                {currentWorkflow && (
                  <span className="stat-pill">
                    {currentWorkflow.type}
                  </span>
                )}
                <span className="stat-pill">{filterLabel}</span>
              </div>

              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="display-title text-[2rem] leading-none md:text-[2.35rem]">
                  {selectedEpic?.title ?? "Epic board"}
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                  {visibleCards.length} visible
                </span>
              </div>

              <p className="mt-1.5 max-w-4xl text-[12px] leading-relaxed text-[var(--text-muted)]">
                {epicDescription}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 xl:max-w-[340px] xl:justify-end">
              <MetricPill label="Cards" value={String(epicCards.length)} />
              <MetricPill label="Visible" value={String(visibleCards.length)} />
              <MetricPill
                label="Blocked"
                value={String(visibleCards.filter((card) => blockedCardIds.has(card.id)).length)}
              />
            </div>
          </div>
        </div>

        <div
          ref={laneScrollerRef}
          onWheel={handleLaneWheel}
          className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-2 pr-1"
        >
          {workflowStatuses.length === 0 && !workflowId && (
            <div className="surface-panel surface-panel--soft flex flex-1 items-center justify-center px-4 py-10">
              <span className="text-xs font-mono text-[var(--text-faint)]">
                No workflow assigned to this epic.
              </span>
            </div>
          )}
          {workflowStatuses.map((ws) => {
            const columnCards = visibleCards.filter((c) => c.statusId === ws.statusId);
            return (
              <KanbanColumn
                key={ws.id}
                workflowStatus={ws}
                cards={columnCards}
                blockedCardIds={blockedCardIds}
              />
            );
          })}
        </div>
      </div>

      {isWorktree && <BaseBranchPanel epicId={selectedEpicId} />}
    </div>
  );
}

function shouldPreserveVerticalScroll(
  target: EventTarget | null,
  container: HTMLDivElement,
  deltaY: number
) {
  let node = target instanceof HTMLElement ? target : null;

  while (node && node !== container) {
    const canScrollVertically = node.scrollHeight > node.clientHeight;
    if (canScrollVertically) {
      const styles = window.getComputedStyle(node);
      const overflowY = styles.overflowY;
      const allowsVerticalScroll = overflowY === "auto" || overflowY === "scroll";
      if (allowsVerticalScroll) {
        const scrollingDown = deltaY > 0;
        const canScrollDown = node.scrollTop + node.clientHeight < node.scrollHeight;
        const canScrollUp = node.scrollTop > 0;
        if ((scrollingDown && canScrollDown) || (!scrollingDown && canScrollUp)) {
          return true;
        }
      }
    }
    node = node.parentElement;
  }

  return false;
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel min-w-[90px] bg-transparent px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}
