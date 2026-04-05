import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
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
  const [capturing, setCapturing] = useState<string | null>(null);
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
      await api.api.shortcuts({ id }).patch({ shortcut });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shortcuts"] }),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      await (api.api.shortcuts as any).reset.post({});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shortcuts"] }),
  });

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

  function saveCapture(id: string) {
    if (!captured) return;
    updateMutation.mutate({ id, shortcut: captured });
    setCapturing(null);
    setCaptured(null);
  }

  function cancelCapture() {
    setCapturing(null);
    setCaptured(null);
  }

  const groups = shortcuts.reduce<Record<string, KeyboardShortcut[]>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-mono text-[var(--text-faint)]">Click a binding to rebind it. Press Escape to cancel capture.</p>
        <button
          type="button"
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          className="action-button action-button--muted"
        >
          Reset All
        </button>
      </div>

      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <p className="meta-label mb-2">{group}</p>
          <div className="surface-panel overflow-hidden">
            {items.map((s, index) => {
              const isCapturing = capturing === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between gap-4 px-4 py-3 ${index > 0 ? "border-t border-[var(--border-soft)]" : ""}`}
                >
                  <span className="flex-1 text-[13px] font-mono text-[var(--text-primary)]">{s.label}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {isCapturing ? (
                      <>
                        <button
                          type="button"
                          className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-surface)] px-3 py-2 text-[11px] font-mono text-[var(--accent-strong)] animate-pulse min-w-[140px]"
                          onClick={captured ? () => saveCapture(s.id) : undefined}
                        >
                          {captured ? captured : "press a key..."}
                        </button>
                        {captured && (
                          <button type="button" className="action-button action-button--accent !px-3 !py-1.5" onClick={() => saveCapture(s.id)}>
                            Save
                          </button>
                        )}
                        <button type="button" className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)]" onClick={cancelCapture}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="rounded-full border border-[var(--border)] px-3 py-2 text-[11px] font-mono text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-border)] hover:text-[var(--accent-strong)] min-w-[92px]"
                          onClick={() => {
                            setCapturing(s.id);
                            setCaptured(null);
                          }}
                        >
                          {s.shortcut ?? "-"}
                        </button>
                        {s.shortcut && (
                          <button
                            type="button"
                            className="text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors"
                            onClick={() => updateMutation.mutate({ id: s.id, shortcut: null })}
                            title="Clear shortcut"
                          >
                            Clear
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
