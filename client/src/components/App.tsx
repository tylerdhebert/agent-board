import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { useWebSocket } from "../hooks/useWebSocket";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { Header } from "./Header";
import { Board } from "./Board";
import { CardModal } from "./CardModal";
import { InputModal } from "./InputModal";
import { HierarchySidebar } from "./HierarchySidebar";
import { AdminPanel } from "./AdminPanel";
import { WorkbenchSidebar } from "./WorkbenchSidebar";
import { api } from "../api/client";
import type { Status, Epic, WorkflowStatus, InputRequest } from "../api/types";

export function App() {
  useWebSocket();
  useKeyboardShortcuts();

  const openModal = useBoardStore((s) => s.openModal);
  const pendingInputRequests = useBoardStore((s) => s.pendingInputRequests);
  const activeInputRequestId = useBoardStore((s) => s.activeInputRequestId);
  const adminPanelOpen = useBoardStore((s) => s.adminPanelOpen);
  const selectedEpicId = useBoardStore((s) => s.selectedEpicId);
  const theme = useBoardStore((s) => s.theme);

  const { data: statuses = [] } = useQuery<Status[]>({
    queryKey: ["statuses"],
    queryFn: async () => {
      const { data } = await api.api.statuses.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: ["epics"],
    queryFn: async () => {
      const { data } = await api.api.epics.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const selectedEpicWorkflowId = selectedEpicId
    ? (epics.find((e) => e.id === selectedEpicId)?.workflowId ?? null)
    : null;

  const { data: workflowStatuses = [] } = useQuery<WorkflowStatus[]>({
    queryKey: ["workflow-statuses", selectedEpicWorkflowId],
    queryFn: async () => {
      const { data } = await api.api.workflows({ id: selectedEpicWorkflowId! }).statuses.get();
      return (data as WorkflowStatus[]) ?? [];
    },
    enabled: !!selectedEpicWorkflowId,
    staleTime: 30_000,
  });

  useQuery<InputRequest[]>({
    queryKey: ["input", "pending"],
    queryFn: async () => {
      const { data } = await api.api.input.pending.get();
      const requests: InputRequest[] = (data as InputRequest[]) ?? [];
      const store = useBoardStore.getState();
      for (const req of requests) {
        store.addPendingInputRequest(req);
        store.addPulsingCard(req.cardId);
      }
      return requests;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const pendingList = Array.from(pendingInputRequests.values());
  const activeRequest = activeInputRequestId
    ? pendingInputRequests.get(activeInputRequestId)
    : null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme =
      theme === "light" || theme === "summer" || theme === "wildflower" || theme === "wa"
        ? "light"
        : "dark";
  }, [theme]);

  return (
    <div className="app-root h-screen overflow-hidden">
      <div className="app-atmosphere" aria-hidden="true" />
      <div className="relative z-10 h-full">
        <div className="app-shell flex h-full flex-col overflow-hidden">
          <Header />

          <div className="app-workbench">
            <HierarchySidebar />
            <div className="app-canvas">
              <Board />
            </div>
            <WorkbenchSidebar requests={pendingList} />
          </div>
        </div>
      </div>

      {openModal === "card" && (
        <CardModal
          statuses={statuses}
          workflowStatuses={workflowStatuses.length > 0 ? workflowStatuses : undefined}
        />
      )}

      {openModal === "input" && activeRequest && (
        <InputModal request={activeRequest} />
      )}

      {adminPanelOpen && <AdminPanel />}
    </div>
  );
}
