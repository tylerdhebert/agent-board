import { create } from "zustand";
import type { InputRequest } from "../api/types";

type ModalType = "card" | "input" | null;
type WsStatus = "connecting" | "connected" | "disconnected";

export type HierarchyFilter =
  | { type: "all" }
  | { type: "epic"; id: string }
  | { type: "feature"; id: string }
  | { type: "unassigned" };

interface BoardStore {
  // Selected card
  selectedCardId: string | null;
  setSelectedCardId: (id: string | null) => void;

  // Modal state
  openModal: ModalType;
  setOpenModal: (modal: ModalType) => void;

  // Active input request (the one currently shown in the input modal)
  activeInputRequestId: string | null;
  setActiveInputRequestId: (id: string | null) => void;

  // Pending input requests map: requestId -> InputRequest
  pendingInputRequests: Map<string, InputRequest>;
  addPendingInputRequest: (req: InputRequest) => void;
  removePendingInputRequest: (id: string) => void;

  // WebSocket connection status
  wsStatus: WsStatus;
  setWsStatus: (status: WsStatus) => void;

  // Cards that are currently "pulsing" due to a pending input request
  pulsingCardIds: Set<string>;
  addPulsingCard: (cardId: string) => void;
  removePulsingCard: (cardId: string) => void;

  // Hierarchy sidebar filter
  hierarchyFilter: HierarchyFilter;
  setHierarchyFilter: (filter: HierarchyFilter) => void;

  // Admin panel
  adminPanelOpen: boolean;
  setAdminPanelOpen: (open: boolean) => void;

  // Chat widget open state (lifted for keyboard shortcut access)
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;

  // Daily summary expanded state (lifted for keyboard shortcut access)
  summaryExpanded: boolean;
  setSummaryExpanded: (expanded: boolean) => void;

  // Height of the DailySummaryBar (measured via ResizeObserver, used by ChatWidget)
  summaryBarHeight: number;
  setSummaryBarHeight: (h: number) => void;

  // Ctrl key held (for shortcut hint overlay)
  ctrlHeld: boolean;
  setCtrlHeld: (held: boolean) => void;

  // Cards with unseen comments (cleared when card is opened)
  unseenCommentCardIds: Set<string>;
  addUnseenComment: (cardId: string) => void;
  clearUnseenComment: (cardId: string) => void;
}

export const useBoardStore = create<BoardStore>((set) => ({
  selectedCardId: null,
  setSelectedCardId: (id) => set({ selectedCardId: id }),

  openModal: null,
  setOpenModal: (modal) => set({ openModal: modal }),

  activeInputRequestId: null,
  setActiveInputRequestId: (id) => set({ activeInputRequestId: id }),

  pendingInputRequests: new Map(),
  addPendingInputRequest: (req) =>
    set((state) => {
      const next = new Map(state.pendingInputRequests);
      next.set(req.id, req);
      return { pendingInputRequests: next };
    }),
  removePendingInputRequest: (id) =>
    set((state) => {
      const next = new Map(state.pendingInputRequests);
      next.delete(id);
      return { pendingInputRequests: next };
    }),

  wsStatus: "disconnected",
  setWsStatus: (status) => set({ wsStatus: status }),

  pulsingCardIds: new Set(),
  addPulsingCard: (cardId) =>
    set((state) => {
      const next = new Set(state.pulsingCardIds);
      next.add(cardId);
      return { pulsingCardIds: next };
    }),
  removePulsingCard: (cardId) =>
    set((state) => {
      const next = new Set(state.pulsingCardIds);
      next.delete(cardId);
      return { pulsingCardIds: next };
    }),

  hierarchyFilter: { type: "all" },
  setHierarchyFilter: (filter) => set({ hierarchyFilter: filter }),

  adminPanelOpen: false,
  setAdminPanelOpen: (open) => set({ adminPanelOpen: open }),

  chatOpen: false,
  setChatOpen: (open) => set({ chatOpen: open }),

  summaryExpanded: false,
  setSummaryExpanded: (expanded) => set({ summaryExpanded: expanded }),

  summaryBarHeight: 0,
  setSummaryBarHeight: (h) => set({ summaryBarHeight: h }),

  ctrlHeld: false,
  setCtrlHeld: (held) => set({ ctrlHeld: held }),

  unseenCommentCardIds: new Set(),
  addUnseenComment: (cardId) =>
    set((state) => ({ unseenCommentCardIds: new Set(state.unseenCommentCardIds).add(cardId) })),
  clearUnseenComment: (cardId) =>
    set((state) => {
      const next = new Set(state.unseenCommentCardIds);
      next.delete(cardId);
      return { unseenCommentCardIds: next };
    }),
}));
