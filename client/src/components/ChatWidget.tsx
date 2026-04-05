import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Card, Conversation, QueueMessage } from "../api/types";
import { useBoardStore } from "../store";
import { useShortcutHint } from "../hooks/useShortcutHint";
import { ShortcutBadge } from "./ShortcutBadge";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import { formatTimestamp } from "../lib/formatUtils";

interface ThreadWindowProps {
  agentId: string;
  unread: number;
  onClose: () => void;
}

function ChatThreadWindow({ agentId, unread, onClose }: ThreadWindowProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEscapeToClose(onClose);

  const scrollRefCallback = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    if (el) {
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 0);
    }
  }, []);

  const textareaRefCallback = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) setTimeout(() => el.focus(), 0);
  }, []);

  const { data: messages = [] } = useQuery<QueueMessage[]>({
    queryKey: ["queue", agentId],
    queryFn: async () => {
      const { data } = await api.api.queue.get({ query: { agentId } });
      return data ?? [];
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

  const markRead = useCallback(async () => {
    if (unread === 0) return;
    const { data } = await api.api.queue.get({ query: { agentId, status: "pending" } });
    const pending: QueueMessage[] = data ?? [];
    await Promise.all(
      pending.filter((m) => m.author !== "user").map((m) => (api.api.queue({ id: m.id }) as any).read.post({}))
    );
    if (pending.some((m) => m.author !== "user")) {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    }
  }, [agentId, unread, queryClient]);

  useEffect(() => {
    markRead();
  }, [agentId, markRead]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      className={`surface-panel surface-panel--raised flex w-[336px] max-w-[calc(100vw-2rem)] shrink-0 flex-col overflow-hidden rounded-b-none border-b-0 shadow-2xl ${
        unread > 0 ? "chat-bar-glow" : ""
      }`}
      style={{ height: collapsed ? "auto" : 400 }}
      onClick={markRead}
    >
      <div
        className="flex cursor-pointer items-center justify-between border-b border-[var(--border-soft)] px-4 py-3 transition-colors hover:bg-[var(--accent-surface)]"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="min-w-0">
          <div className="meta-label mb-1">Active Thread</div>
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{agentId}</p>
            {unread > 0 && <UnreadBadge count={unread} />}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((v) => !v);
            }}
            className="action-button action-button--ghost !px-2.5 !py-1.5 !text-[0.58rem]"
          >
            {collapsed ? "Open" : "Hide"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="action-button action-button--ghost !px-2.5 !py-1.5 !text-[0.58rem]"
          >
            Close
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div ref={scrollRefCallback} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="surface-panel bg-transparent px-4 py-5 text-center">
                <div className="meta-label mb-2">Conversation</div>
                <p className="text-[11px] font-mono text-[var(--text-dim)]">No messages yet.</p>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.author === "user";
              return (
                <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-[20px] px-3 py-2.5 text-[12px] font-mono shadow-[0_10px_24px_var(--shadow-color)] ${
                      isUser ? "rounded-br-md text-white" : "rounded-bl-md text-[var(--text-primary)]"
                    }`}
                    style={{
                      background: isUser
                        ? "linear-gradient(135deg, var(--accent), var(--accent-strong))"
                        : "linear-gradient(180deg, rgba(255,255,255,0.04), transparent), var(--panel-ink)",
                    }}
                  >
                    {!isUser && (
                      <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                        {msg.author}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                    <p className={`mt-1 text-[9px] opacity-60 ${isUser ? "text-right" : "text-left"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-[var(--border-soft)] px-4 py-3">
            <textarea
              ref={textareaRefCallback}
              className="field-shell min-h-[78px] resize-none px-3 py-3 text-[12px]"
              placeholder="Write a reply..."
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
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="action-button action-button--accent !px-3.5 !py-2"
                disabled={!input.trim() || sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
              >
                {sendMutation.isPending ? "Sending" : "Send"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ChatWidget({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const chatOpen = useBoardStore((s) => s.chatOpen);
  const setChatOpen = useBoardStore((s) => s.setChatOpen);
  const summaryBarHeight = useBoardStore((s) => s.summaryBarHeight);
  const chatHint = useShortcutHint("toggle-chat");
  const [openThreads, setOpenThreads] = useState<string[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newAgentKey, setNewAgentKey] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setShowNewChat(true);
    window.addEventListener("kb:chat-new", handler);
    return () => window.removeEventListener("kb:chat-new", handler);
  }, []);

  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [overflowOpen]);

  const swapOverflow = (agentId: string) => {
    setOpenThreads((prev) => {
      const without = prev.filter((t) => t !== agentId);
      const [oldest, ...remaining] = without;
      return [...remaining.slice(0, 2), agentId, oldest, ...remaining.slice(2)];
    });
    setOverflowOpen(false);
  };

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["queue", "conversations"],
    queryFn: async () => {
      const { data } = await api.api.queue.conversations.get();
      return data ?? [];
    },
    staleTime: 5_000,
  });

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data } = await api.api.cards.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const knownAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of conversations) ids.add(c.agentId);
    for (const card of cards) {
      if (card.agentId) ids.add(card.agentId);
    }
    return Array.from(ids).sort();
  }, [conversations, cards]);

  const suggestions = useMemo(() => {
    if (!newAgentKey) return [];
    const lower = newAgentKey.toLowerCase();
    return knownAgentIds.filter((id) => id.toLowerCase().includes(lower));
  }, [newAgentKey, knownAgentIds]);

  const showDropdown =
    dropdownOpen &&
    newAgentKey.length > 0 &&
    suggestions.length > 0 &&
    !(suggestions.length === 1 && suggestions[0] === newAgentKey);

  const deleteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await (api.api.queue.conversations as any)({ agentId }).delete();
    },
    onSuccess: (_, agentId) => {
      setOpenThreads((prev) => prev.filter((id) => id !== agentId));
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const toggleThread = (agentId: string) => {
    setOpenThreads((prev) => (prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]));
  };

  const openNewChat = (agentKey: string) => {
    if (!openThreads.includes(agentKey)) {
      setOpenThreads((prev) => [...prev, agentKey]);
    }
    setShowNewChat(false);
    setNewAgentKey("");
    setDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const unreadInClosedThreads = conversations
    .filter((c) => !openThreads.includes(c.agentId))
    .reduce((sum, c) => sum + c.unread, 0);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);
  const dockOffsetStyle = {
    "--chat-dock-offset": embedded ? "0px" : `${summaryBarHeight}px`,
  } as CSSProperties;

  const threadDockClass = embedded
    ? "fixed bottom-4 left-4 right-4 z-40 overflow-x-auto"
    : "fixed bottom-[calc(var(--chat-dock-offset)+0.75rem)] left-0 right-0 z-40 overflow-x-auto md:bottom-[calc(var(--chat-dock-offset)+1.25rem)]";

  const mainDockClass = embedded
    ? "w-full"
    : "fixed bottom-[calc(var(--chat-dock-offset)+0.75rem)] left-0 z-40 w-[468px] max-w-full px-3 md:bottom-[calc(var(--chat-dock-offset)+1.25rem)] md:px-4";

  const mainPanelClass = embedded
    ? "surface-panel surface-panel--soft overflow-hidden"
    : "surface-panel surface-panel--raised overflow-hidden rounded-b-none border-b-0 shadow-2xl";

  return (
    <>
      {openThreads.length > 0 && (
        <div className={threadDockClass} style={dockOffsetStyle}>
          <div className={`flex min-w-max items-end gap-3 ${embedded ? "" : "px-4"}`}>
            {!embedded && <div className="w-[468px] max-w-full shrink-0" />}

            {openThreads.slice(0, 3).map((agentId) => {
              const conv = conversations.find((c) => c.agentId === agentId);
              return (
                <ChatThreadWindow
                  key={agentId}
                  agentId={agentId}
                  unread={conv?.unread ?? 0}
                  onClose={() => toggleThread(agentId)}
                />
              );
            })}

            {openThreads.length > 3 && (() => {
              const overflowIds = openThreads.slice(3);
              const overflowUnread = overflowIds.reduce((sum, id) => {
                const conv = conversations.find((c) => c.agentId === id);
                return sum + (conv?.unread ?? 0);
              }, 0);
              const hasUnread = overflowUnread > 0;

              return (
                <div ref={overflowRef} className="relative shrink-0">
                  {overflowOpen && (
                    <div
                      className="surface-panel surface-panel--raised absolute bottom-[calc(100%+8px)] left-0 w-[220px] overflow-hidden shadow-2xl"
                    >
                      {overflowIds.map((id) => {
                        const conv = conversations.find((c) => c.agentId === id);
                        const unread = conv?.unread ?? 0;
                        return (
                          <button
                            key={id}
                            type="button"
                            className="flex w-full items-center justify-between border-b border-[var(--border-soft)] px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--accent-surface)]"
                            onClick={() => swapOverflow(id)}
                          >
                            <span className="truncate text-[12px] font-mono text-[var(--text-primary)]">{id}</span>
                            {unread > 0 && <UnreadBadge count={unread} />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setOverflowOpen((v) => !v)}
                    className={`surface-panel surface-panel--raised flex w-[220px] max-w-[calc(100vw-2rem)] items-center justify-between rounded-b-none border-b-0 px-4 py-3 text-left shadow-2xl ${
                      hasUnread ? "chat-bar-glow" : ""
                    }`}
                  >
                    <span className="text-[12px] font-semibold text-[var(--text-primary)]">+{overflowIds.length} more</span>
                    {hasUnread && <UnreadBadge count={overflowUnread} />}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <div className={mainDockClass} style={embedded ? undefined : dockOffsetStyle}>
        {chatOpen && (
          <div className={mainPanelClass}>
            <div
              className="flex cursor-pointer items-center justify-between border-b border-[var(--border-soft)] px-4 py-3"
              onClick={() => setChatOpen(false)}
            >
              <div>
                <div className="meta-label mb-1">Communications</div>
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">Agent Conversations</p>
              </div>
              <button
                type="button"
                className="action-button action-button--accent !px-3 !py-1.5 !text-[0.58rem]"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNewChat((v) => !v);
                }}
              >
                New
              </button>
            </div>

            {showNewChat && (
              <div className="relative border-b border-[var(--border-soft)] px-4 py-3">
                <div className="flex gap-2">
                  <input
                    className="field-shell flex-1 px-3 py-2 text-xs"
                    placeholder="Agent key, for example implementer"
                    value={newAgentKey}
                    onChange={(e) => {
                      setNewAgentKey(e.target.value);
                      setDropdownOpen(true);
                      setHighlightedIndex(-1);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setDropdownOpen(false), 120)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightedIndex((i) => Math.min(i + 1, Math.min(suggestions.length, 6) - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightedIndex((i) => Math.max(i - 1, -1));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        if (showDropdown && highlightedIndex >= 0) {
                          openNewChat(suggestions[highlightedIndex]);
                        } else if (newAgentKey.trim()) {
                          openNewChat(newAgentKey.trim());
                        }
                      } else if (e.key === "Escape") {
                        setDropdownOpen(false);
                        setHighlightedIndex(-1);
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="action-button action-button--accent !px-3.5 !py-2"
                    disabled={!newAgentKey.trim()}
                    onClick={() => openNewChat(newAgentKey.trim())}
                  >
                    Open
                  </button>
                </div>

                {showDropdown && (
                  <div className="surface-panel surface-panel--raised absolute left-4 right-4 top-[calc(100%-2px)] z-50 overflow-hidden shadow-2xl">
                    {suggestions.slice(0, 6).map((id, i) => (
                      <button
                        key={id}
                        type="button"
                        className={`flex w-full items-center border-b border-[var(--border-soft)] px-4 py-2.5 text-left text-[12px] font-mono last:border-b-0 ${
                          i === highlightedIndex
                            ? "bg-[var(--accent-surface)] text-[var(--accent-strong)]"
                            : "text-[var(--text-primary)] hover:bg-[var(--panel-hover)]"
                        }`}
                        onMouseEnter={() => setHighlightedIndex(i)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          openNewChat(id);
                        }}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="max-h-[320px] overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <div className="meta-label mb-2">No Threads</div>
                  <p className="text-[11px] font-mono text-[var(--text-dim)]">
                    No conversations yet.{" "}
                    <button
                      type="button"
                      className="text-[var(--accent-strong)] hover:text-[var(--text-primary)]"
                      onClick={() => setShowNewChat(true)}
                    >
                      Start one
                    </button>
                    .
                  </p>
                </div>
              ) : (
                conversations.map((c) => {
                  const isOpen = openThreads.includes(c.agentId);
                  return (
                    <div
                      key={c.agentId}
                      className={`group mb-2 flex cursor-pointer items-center justify-between rounded-[18px] border px-3 py-3 transition-colors last:mb-0 ${
                        isOpen
                          ? "border-[var(--accent-border)] bg-[var(--accent-surface)]"
                          : "border-[var(--border-soft)] hover:bg-[var(--panel-hover)]"
                      }`}
                      onClick={() => toggleThread(c.agentId)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isOpen && <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                          <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{c.agentId}</p>
                        </div>
                        <p className="mt-1 text-[10px] font-mono text-[var(--text-faint)]">{formatTimestamp(c.lastAt)}</p>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-2">
                        {c.unread > 0 && <UnreadBadge count={c.unread} />}
                        <button
                          type="button"
                          className="opacity-0 transition-opacity group-hover:opacity-100 text-[var(--text-dim)] hover:text-[var(--danger)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(c.agentId);
                          }}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {(!embedded || !chatOpen) && (
          <button
            type="button"
            onClick={() => setChatOpen(!chatOpen)}
            className={`surface-panel flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--panel-hover)] ${
              embedded
                ? "surface-panel--soft"
                : "rounded-b-none border-b-0 shadow-2xl"
            } ${unreadInClosedThreads > 0 ? "chat-bar-glow" : ""}`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-strong)]">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2Z" />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="meta-label mb-1">Agent Chat</div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">Conversations</span>
                {totalUnread > 0 && <UnreadBadge count={totalUnread} />}
              </div>
            </div>

            <span className="ml-auto flex items-center gap-2 text-[10px] font-mono text-[var(--text-faint)]">
              <ShortcutBadge shortcut={chatHint} />
              {chatOpen ? "hide" : "open"}
            </span>
          </button>
        )}
      </div>
    </>
  );
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white">
      {count}
    </span>
  );
}
