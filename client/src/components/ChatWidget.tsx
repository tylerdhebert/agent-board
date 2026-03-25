import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE } from "../api/client";
import type { QueueMessage, Conversation } from "../api/types";
import { useBoardStore } from "../store";
import { useShortcutHint } from "../hooks/useShortcutHint";
import { ShortcutBadge } from "./ShortcutBadge";

// ---------------------------------------------------------------------------
// Thread window — one per open conversation
// ---------------------------------------------------------------------------

interface ThreadWindowProps {
  agentId: string;
  leftOffset: number;
  unread: number;
  onClose: () => void;
}

function ChatThreadWindow({ agentId, leftOffset, unread, onClose }: ThreadWindowProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fires every time the scroll container mounts (open, uncollapse, reopen)
  const scrollRefCallback = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 0);
  }, []);

  const textareaRefCallback = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) setTimeout(() => el.focus(), 0);
  }, []);

  const { data: messages = [] } = useQuery<QueueMessage[]>({
    queryKey: ["queue", agentId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/queue?agentId=${encodeURIComponent(agentId)}`);
      return res.json();
    },
    staleTime: 5_000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      await api.api.queue.post({ agentId, body: input, author: "user" });
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  // Mark agent messages as read when window opens
  useEffect(() => {
    (async () => {
      const res = await fetch(`${API_BASE}/queue?agentId=${encodeURIComponent(agentId)}&status=pending`);
      const pending: QueueMessage[] = await res.json();
      await Promise.all(
        pending.filter(m => m.author !== "user").map(m =>
          fetch(`${API_BASE}/queue/${m.id}/read`, { method: "POST" })
        )
      );
      if (pending.some(m => m.author !== "user")) {
        queryClient.invalidateQueries({ queryKey: ["queue"] });
      }
    })();
  }, [agentId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      className="fixed z-40 w-[320px] flex flex-col border border-b-0 border-[#2a2a38] rounded-t-lg overflow-hidden shadow-2xl"
      style={{ bottom: 32, left: leftOffset, height: collapsed ? "auto" : 380, background: "#1c1c28" }}
    >
      {/* Header — click to collapse/expand, ✕ to close */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 border-b border-[#2a2a38] shrink-0 cursor-pointer select-none hover:bg-[#22222e] transition-colors ${
          unread > 0 ? "chat-bar-glow" : ""
        }`}
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono text-[#e2e8f0] truncate">{agentId}</span>
          {unread > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#6366f1] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-[10px] font-mono text-[#334155]">{collapsed ? "▲" : "▼"}</span>
          <button
            className="text-[11px] font-mono text-[#475569] hover:text-[#94a3b8]"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages + Compose — hidden when collapsed */}
      {!collapsed && (
        <>
          <div ref={scrollRefCallback} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-[#475569] text-[11px] font-mono text-center mt-6">No messages yet.</p>
            )}
            {messages.map((msg) => {
              const isUser = msg.author === "user";
              return (
                <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12px] font-mono ${
                      isUser ? "rounded-br-sm text-white" : "rounded-bl-sm text-[#e2e8f0]"
                    }`}
                    style={{ background: isUser ? "#2d6eb3" : "#2e2e3e" }}
                  >
                    {!isUser && (
                      <p className="text-[10px] text-[#818cf8] mb-0.5">{msg.author}</p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                    <p className={`text-[9px] opacity-40 mt-1 ${isUser ? "text-right" : "text-left"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-[#2a2a38] px-3 py-2 shrink-0">
            <textarea
              ref={textareaRefCallback}
              className="w-full bg-[#12121f] border border-[#2a2a38] rounded-xl px-3 py-2 text-[12px] font-mono text-white placeholder-[#475569] focus:outline-none focus:border-[#6366f1] resize-none"
              placeholder="Message..."
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && input.trim()) {
                  e.preventDefault();
                  sendMutation.mutate();
                }
              }}
            />
            <div className="flex justify-end mt-1.5">
              <button
                className="px-3 py-1 bg-[#6366f1] hover:bg-[#818cf8] text-white text-[10px] font-mono rounded disabled:opacity-40 transition-colors"
                disabled={!input.trim() || sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
              >
                send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main widget — docked bar + conversation list
// ---------------------------------------------------------------------------

export function ChatWidget() {
  const chatOpen = useBoardStore((s) => s.chatOpen);
  const setChatOpen = useBoardStore((s) => s.setChatOpen);
  const chatHint = useShortcutHint("toggle-chat");
  const [openThreads, setOpenThreads] = useState<string[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newAgentKey, setNewAgentKey] = useState("");

  // Listen for keyboard shortcut "chat-new" event
  useEffect(() => {
    const handler = () => setShowNewChat(true);
    window.addEventListener("kb:chat-new", handler);
    return () => window.removeEventListener("kb:chat-new", handler);
  }, []);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["queue", "conversations"],
    queryFn: async () => {
      const { data } = await api.api.queue.conversations.get();
      return data ?? [];
    },
    staleTime: 5_000,
  });

  const toggleThread = (agentId: string) => {
    setOpenThreads((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  const openNewChat = (agentKey: string) => {
    if (!openThreads.includes(agentKey)) {
      setOpenThreads((prev) => [...prev, agentKey]);
    }
    setShowNewChat(false);
    setNewAgentKey("");
  };

  // Only pulse the main bar for unread in threads that aren't open
  const unreadInClosedThreads = conversations
    .filter((c) => !openThreads.includes(c.agentId))
    .reduce((sum, c) => sum + c.unread, 0);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  return (
    <>
      {/* Thread windows — positioned to the right of the main widget */}
      {openThreads.map((agentId, index) => {
        const conv = conversations.find((c) => c.agentId === agentId);
        return (
          <ChatThreadWindow
            key={agentId}
            agentId={agentId}
            leftOffset={450 + index * 330}
            unread={conv?.unread ?? 0}
            onClose={() => toggleThread(agentId)}
          />
        );
      })}

      {/* Main widget */}
      <div className="fixed bottom-8 left-0 w-[440px] z-40">
        {/* Conversation list panel */}
        {chatOpen && (
          <div
            className="flex flex-col border border-b-0 border-[#2a2a38] rounded-t-lg overflow-hidden shadow-2xl"
            style={{ maxHeight: 320, background: "#1c1c28" }}
          >
            {/* Panel header — click to collapse */}
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a38] shrink-0 cursor-pointer hover:bg-[#22222e] transition-colors select-none"
              onClick={() => setChatOpen(false)}
            >
              <span className="text-[10px] font-mono text-[#475569] uppercase tracking-wider">
                Conversations
              </span>
              <button
                className="text-[11px] font-mono text-[#6366f1] hover:text-[#818cf8] transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowNewChat((v) => !v); }}
              >
                + new
              </button>
            </div>

            {/* New chat input */}
            {showNewChat && (
              <div className="flex gap-2 px-4 py-2 border-b border-[#2a2a38] shrink-0">
                <input
                  className="flex-1 bg-[#12121f] border border-[#2a2a38] rounded px-2 py-1 text-xs font-mono text-white placeholder-[#475569] focus:outline-none focus:border-[#6366f1]"
                  placeholder="Agent key (e.g. implementer)"
                  value={newAgentKey}
                  onChange={(e) => setNewAgentKey(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && newAgentKey.trim() && openNewChat(newAgentKey.trim())
                  }
                  autoFocus
                />
                <button
                  className="px-3 py-1 bg-[#6366f1] hover:bg-[#818cf8] text-white text-xs font-mono rounded disabled:opacity-40 transition-colors"
                  disabled={!newAgentKey.trim()}
                  onClick={() => openNewChat(newAgentKey.trim())}
                >
                  open
                </button>
              </div>
            )}

            {/* List */}
            <div className="overflow-y-auto divide-y divide-[#2a2a38]">
              {conversations.length === 0 ? (
                <p className="text-[#475569] text-[11px] font-mono text-center py-8">
                  No conversations yet.{" "}
                  <button
                    className="text-[#6366f1] hover:text-[#818cf8]"
                    onClick={() => setShowNewChat(true)}
                  >
                    + new
                  </button>
                </p>
              ) : (
                conversations.map((c) => {
                  const isOpen = openThreads.includes(c.agentId);
                  return (
                    <button
                      key={c.agentId}
                      className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left ${
                        isOpen ? "bg-[#22222e]" : "hover:bg-[#22222e]"
                      }`}
                      onClick={() => toggleThread(c.agentId)}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        {isOpen && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-[12px] font-mono text-[#e2e8f0] truncate">{c.agentId}</p>
                          <p className="text-[10px] font-mono text-[#475569]">
                            {new Date(c.lastAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {c.unread > 0 && (
                        <span className="ml-2 w-5 h-5 rounded-full bg-[#6366f1] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {c.unread}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Docked bar */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`w-full flex items-center gap-2.5 px-4 py-2 border border-b-0 border-[#2a2a38] rounded-t bg-[#0a0a0f] hover:bg-[#111118] transition-colors text-left ${
            unreadInClosedThreads > 0 ? "chat-bar-glow" : ""
          }`}
        >
          <svg className="w-3.5 h-3.5 text-[#6366f1] shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>

          <span className="text-[10px] font-mono text-[#475569] uppercase tracking-wider shrink-0">
            Agent Chat
          </span>

          {totalUnread > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#6366f1] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
              {totalUnread}
            </span>
          )}


          <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-[#334155] shrink-0">
            <ShortcutBadge shortcut={chatHint} />
            {chatOpen ? "▼" : "▲"}
          </span>
        </button>
      </div>
    </>
  );
}
