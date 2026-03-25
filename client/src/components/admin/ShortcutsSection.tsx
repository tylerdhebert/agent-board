import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE } from "../../api/client";
import type { KeyboardShortcut } from "../../api/types";

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

export function ShortcutsSection() {
  const queryClient = useQueryClient();
  const [capturing, setCapturing] = useState<string | null>(null); // action id being rebound
  const [captured, setCaptured] = useState<string | null>(null);

  const { data: shortcuts = [] } = useQuery<KeyboardShortcut[]>({
    queryKey: ["shortcuts"],
    queryFn: async () => {
      const { data } = await api.api.shortcuts.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, shortcut }: { id: string; shortcut: string | null }) => {
      await fetch(`${API_BASE}/shortcuts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortcut }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shortcuts"] }),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      await fetch(`${API_BASE}/shortcuts/reset`, { method: "POST" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shortcuts"] }),
  });

  // Capture key press when in capture mode
  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        setCaptured(null);
        return;
      }
      const key = eventToKey(e);
      if (key) setCaptured(key);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [capturing]);

  const saveCapture = (id: string) => {
    if (!captured) return;
    updateMutation.mutate({ id, shortcut: captured });
    setCapturing(null);
    setCaptured(null);
  };

  const cancelCapture = () => {
    setCapturing(null);
    setCaptured(null);
  };

  // Group shortcuts
  const groups = shortcuts.reduce<Record<string, KeyboardShortcut[]>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-mono text-[#475569]">
          Click a binding to rebind. Press Escape to cancel capture.
        </p>
        <button
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          className="text-[11px] font-mono text-[#475569] hover:text-[#94a3b8] border border-[#2a2a38] px-3 py-1 rounded transition-colors disabled:opacity-40"
        >
          Reset all to defaults
        </button>
      </div>

      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <p className="text-[10px] font-mono text-[#475569] uppercase tracking-wider mb-2">{group}</p>
          <div className="divide-y divide-[#1e1e2a] border border-[#1e1e2a] rounded">
            {items.map((s) => {
              const isCapturing = capturing === s.id;
              return (
                <div key={s.id} className="flex items-center justify-between px-3 py-2.5 gap-4">
                  <span className="text-[13px] font-mono text-[#e2e8f0] flex-1">{s.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {isCapturing ? (
                      <>
                        <button
                          className="text-[11px] font-mono px-3 py-1 border border-[#6366f1] rounded text-[#818cf8] min-w-[120px] text-center animate-pulse"
                          onClick={captured ? () => saveCapture(s.id) : undefined}
                        >
                          {captured ? captured : "press a key..."}
                        </button>
                        {captured && (
                          <button
                            className="text-[11px] font-mono px-2 py-1 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded transition-colors"
                            onClick={() => saveCapture(s.id)}
                          >
                            save
                          </button>
                        )}
                        <button
                          className="text-[11px] font-mono text-[#475569] hover:text-[#94a3b8] transition-colors"
                          onClick={cancelCapture}
                        >
                          cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="text-[11px] font-mono px-3 py-1 border border-[#2a2a38] rounded text-[#94a3b8] hover:border-[#6366f1] hover:text-[#818cf8] transition-colors min-w-[80px] text-center"
                          onClick={() => { setCapturing(s.id); setCaptured(null); }}
                        >
                          {s.shortcut ?? "—"}
                        </button>
                        {s.shortcut && (
                          <button
                            className="text-[10px] font-mono text-[#334155] hover:text-[#475569] transition-colors"
                            onClick={() => updateMutation.mutate({ id: s.id, shortcut: null })}
                            title="Clear shortcut"
                          >
                            ✕
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
