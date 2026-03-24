import { useQuery } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { useWebSocket } from "../hooks/useWebSocket";
import { Header } from "./Header";
import { Board } from "./Board";
import { CardModal } from "./CardModal";
import { InputModal } from "./InputModal";
import { InputNotificationBanner } from "./InputNotificationBanner";
import { HierarchySidebar } from "./HierarchySidebar";
import { AdminPanel } from "./AdminPanel";
import { NotificationPrompt } from "./NotificationPrompt";
import { DailySummaryBar } from "./DailySummaryBar";
import { API_BASE } from "../api/client";
import type { Status, InputRequest } from "../api/types";

export function App() {
  // Connect WebSocket on mount
  useWebSocket();

  const openModal = useBoardStore((s) => s.openModal);
  const pendingInputRequests = useBoardStore((s) => s.pendingInputRequests);
  const activeInputRequestId = useBoardStore((s) => s.activeInputRequestId);
  const adminPanelOpen = useBoardStore((s) => s.adminPanelOpen);

  // Load statuses for modals
  const { data: statuses = [] } = useQuery<Status[]>({
    queryKey: ["statuses"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/statuses`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  // Load pending input requests on startup (in case of page reload)
  useQuery<InputRequest[]>({
    queryKey: ["input", "pending"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/input/pending`);
      if (!res.ok) throw new Error("Failed");
      const data: InputRequest[] = await res.json();
      // Hydrate the store
      const store = useBoardStore.getState();
      for (const req of data) {
        store.addPendingInputRequest(req);
        store.addPulsingCard(req.cardId);
      }
      return data;
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
      {openModal === "card" && <CardModal statuses={statuses} />}

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
    </div>
  );
}
