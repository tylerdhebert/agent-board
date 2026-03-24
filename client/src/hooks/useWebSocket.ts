import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import type { WsMessage, InputRequest } from "../api/types";
import { WS_URL } from "../api/client";

const RECONNECT_DELAY_MS = 3000;

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    // Two-tone blip: 880 Hz then 1100 Hz
    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.3, t + i * 0.12 + 0.01);
      gain.gain.linearRampToValueAtTime(0, t + i * 0.12 + 0.1);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.12);
    });
  } catch {
    // AudioContext not available
  }
}

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalClose = useRef(false);
  // Track which request IDs have already fired a notification to prevent duplicates
  const notifiedIds = useRef<Set<string>>(new Set());
  const statusInvalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hold store actions in refs so handleMessage never gets a new identity
  // just because a Zustand selector returned a different function reference.
  const storeRef = useRef(useBoardStore.getState());
  useEffect(() => {
    return useBoardStore.subscribe((state) => {
      storeRef.current = state;
    });
  }, []);

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      const { event, data } = msg;
      const store = storeRef.current;

      switch (event) {
        case "card:created":
        case "card:updated":
        case "card:deleted":
          queryClient.invalidateQueries({ queryKey: ["cards"] });
          if (event !== "card:created" && data && typeof data === "object" && "id" in data) {
            queryClient.invalidateQueries({
              queryKey: ["card", (data as { id: string }).id],
            });
          }
          break;

        case "comment:created":
          if (data && typeof data === "object" && "cardId" in data) {
            const cardId = (data as { cardId: string }).cardId;
            queryClient.invalidateQueries({ queryKey: ["card", cardId] });
            store.addUnseenComment(cardId);
          }
          break;

        case "input:requested": {
          const req = data as InputRequest;
          store.addPendingInputRequest(req);
          store.addPulsingCard(req.cardId);
          queryClient.invalidateQueries({ queryKey: ["cards"] });
          queryClient.invalidateQueries({ queryKey: ["input", "pending"] });
          // Only notify once per request ID
          if (!notifiedIds.current.has(req.id)) {
            notifiedIds.current.add(req.id);
            playAlertSound();
            if (Notification.permission === "granted") {
              new Notification("agent-board", {
                body: "An agent is requesting input.",
                icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>",
              });
            }
          }
          break;
        }

        case "input:answered":
        case "input:timed_out": {
          const payload = data as { requestId: string; cardId: string };
          store.removePendingInputRequest(payload.requestId);
          store.removePulsingCard(payload.cardId);
          notifiedIds.current.delete(payload.requestId);
          queryClient.invalidateQueries({ queryKey: ["cards"] });
          queryClient.invalidateQueries({ queryKey: ["input", "pending"] });
          break;
        }

        case "status:created":
        case "status:updated":
        case "status:deleted":
          if (statusInvalidateTimer.current) clearTimeout(statusInvalidateTimer.current);
          statusInvalidateTimer.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["statuses"] });
          }, 80);
          break;

        case "epic:created":
        case "epic:updated":
          queryClient.invalidateQueries({ queryKey: ["epics"] });
          break;

        case "feature:created":
        case "feature:updated":
          queryClient.invalidateQueries({ queryKey: ["features"] });
          break;
      }
    },
    [queryClient] // stable — store actions come from storeRef
  );

  const connect = useCallback(() => {
    const state = wsRef.current?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

    storeRef.current.setWsStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      storeRef.current.setWsStatus("connected");
      console.log("[ws] Connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string);
        handleMessage(msg);
      } catch {
        // Ignore non-JSON messages (e.g. "pong")
      }
    };

    ws.onclose = () => {
      storeRef.current.setWsStatus("disconnected");
      wsRef.current = null;
      if (!intentionalClose.current) {
        console.log(`[ws] Disconnected — reconnecting in ${RECONNECT_DELAY_MS}ms`);
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = (err) => {
      console.warn("[ws] Error:", err);
    };
  }, [handleMessage]);

  useEffect(() => {
    intentionalClose.current = false;
    connect();

    // Keepalive ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 30_000);

    return () => {
      intentionalClose.current = true;
      clearInterval(pingInterval);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
