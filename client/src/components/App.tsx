import { useQuery } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { useWebSocket } from "../hooks/useWebSocket";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { Header } from "./Header";
import { Board } from "./Board";
import { CardModal } from "./CardModal";
import { InputModal } from "./InputModal";
import { InputNotificationBanner } from "./InputNotificationBanner";
import { HierarchySidebar } from "./HierarchySidebar";
import { AdminPanel } from "./AdminPanel";
import { NotificationPrompt } from "./NotificationPrompt";
import { DailySummaryBar } from "./DailySummaryBar";
import { ChatWidget } from "./ChatWidget";
import { api } from "../api/client";
import type { Status, Epic, WorkflowStatus, InputRequest } from "../api/types";

export function App() {
  // Connect WebSocket on mount
  useWebSocket();
  useKeyboardShortcuts();

  const openModal = useBoardStore((s) => s.openModal);
  const pendingInputRequests = useBoardStore((s) => s.pendingInputRequests);
  const activeInputRequestId = useBoardStore((s) => s.activeInputRequestId);
  const adminPanelOpen = useBoardStore((s) => s.adminPanelOpen);
  const selectedEpicId = useBoardStore((s) => s.selectedEpicId);

  // Load statuses for modals
  const { data: statuses = [] } = useQuery<Status[]>({
    queryKey: ["statuses"],
    queryFn: async () => {
      const { data } = await api.api.statuses.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // Load epics to find the selected epic's workflowId
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

  // Load workflow statuses for the selected epic (used in CardModal for triggersMerge)
  const { data: workflowStatuses = [] } = useQuery<WorkflowStatus[]>({
    queryKey: ["workflow-statuses", selectedEpicWorkflowId],
    queryFn: async () => {
      const { data } = await api.api.workflows({ id: selectedEpicWorkflowId! }).statuses.get();
      return (data as WorkflowStatus[]) ?? [];
    },
    enabled: !!selectedEpicWorkflowId,
    staleTime: 30_000,
  });

  // Load pending input requests on startup (in case of page reload)
  useQuery<InputRequest[]>({
    queryKey: ["input", "pending"],
    queryFn: async () => {
      const { data } = await api.api.input.pending.get();
      const requests: InputRequest[] = (data as InputRequest[]) ?? [];
      // Hydrate the store
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0f]">
      <Header />

      {/* Main content: sidebar + board */}
      <div className="flex-1 flex min-h-0">
        <HierarchySidebar />
        <Board />
      </div>

      {/* Card detail modal */}
      {openModal === "card" && (
        <CardModal
          statuses={statuses}
          workflowStatuses={workflowStatuses.length > 0 ? workflowStatuses : undefined}
        />
      )}

      {/* Input answer modal */}
      {openModal === "input" && activeRequest && (
        <InputModal request={activeRequest} />
      )}

      {/* Daily summary footer bar */}
      <DailySummaryBar />

      {/* Floating input notifications */}
      <InputNotificationBanner requests={pendingList} />

      {/* Admin panel */}
      {adminPanelOpen && <AdminPanel />}

      {/* Notification permission prompt */}
      <NotificationPrompt />

      {/* Agent chat — fixed above daily summary bar */}
      <ChatWidget />
    </div>
  );
}
