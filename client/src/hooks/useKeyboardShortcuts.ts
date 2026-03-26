import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useBoardStore } from "../store";
import type { KeyboardShortcut } from "../api/types";
import { escapeStack } from "./useEscapeStack";

function eventToKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.metaKey) parts.push("meta");
  const key = e.key.toLowerCase();
  if (!["control", "alt", "shift", "meta"].includes(key)) parts.push(key);
  return parts.join("+");
}

export function useKeyboardShortcuts() {
  const { data: shortcuts = [] } = useQuery<KeyboardShortcut[]>({
    queryKey: ["shortcuts"],
    queryFn: async () => {
      const { data } = await api.api.shortcuts.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA"].includes(tag)) return;

      const key = eventToKey(e);
      const match = shortcuts.find((s) => s.shortcut === key);
      if (!match) return;

      e.preventDefault();

      const store = useBoardStore.getState();
      switch (match.action) {
        case "toggle-admin":
          store.setAdminPanelOpen(!store.adminPanelOpen);
          break;
        case "close-modal":
          escapeStack.trigger();
          break;
        case "filter-all":
          store.setHierarchyFilter({ type: "all" });
          break;
        case "filter-unassigned":
          store.setHierarchyFilter({ type: "unassigned" });
          break;
        case "toggle-chat":
          store.setChatOpen(!store.chatOpen);
          break;
        case "chat-new":
          store.setChatOpen(true);
          window.dispatchEvent(new CustomEvent("kb:chat-new"));
          break;
        case "toggle-summary":
          store.setSummaryExpanded(!store.summaryExpanded);
          break;
        case "summary-prev":
          window.dispatchEvent(new CustomEvent("kb:summary-prev"));
          break;
        case "summary-next":
          window.dispatchEvent(new CustomEvent("kb:summary-next"));
          break;
        case "sidebar-prev":
          window.dispatchEvent(new CustomEvent("kb:sidebar-prev"));
          break;
        case "sidebar-next":
          window.dispatchEvent(new CustomEvent("kb:sidebar-next"));
          break;
        case "sidebar-toggle":
          window.dispatchEvent(new CustomEvent("kb:sidebar-toggle"));
          break;
      }
    };

    const upHandler = (e: KeyboardEvent) => {
      if (e.key === "Control") useBoardStore.getState().setCtrlHeld(false);
    };

    const downHandler = (e: KeyboardEvent) => {
      if (e.key === "Control") useBoardStore.getState().setCtrlHeld(true);
      handler(e);
    };

    window.addEventListener("keydown", downHandler);
    window.addEventListener("keyup", upHandler);
    return () => {
      window.removeEventListener("keydown", downHandler);
      window.removeEventListener("keyup", upHandler);
    };
  }, [shortcuts]);
}
