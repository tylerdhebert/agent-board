import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface BrowseResult {
  path: string;
  sep: string;
  entries: string[];
}

interface Props {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}

export function PathPicker({ value, onChange, placeholder, invalid, className }: Props) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  async function browse(path?: string) {
    setLoading(true);
    try {
      const { data } = await api.api.fs.browse.get({ query: path ? { path } : {} });
      setResult(data as BrowseResult);
    } catch {
      // ignore browse failures and keep the picker stable
    } finally {
      setLoading(false);
    }
  }

  function openPicker() {
    setOpen(true);
    browse(value || undefined);
  }

  function navigateTo(dir: string) {
    const next = result ? result.path + result.sep + dir : dir;
    browse(next);
  }

  function goUp() {
    if (!result) return;
    browse(result.path + result.sep + "..");
  }

  function selectCurrent() {
    if (!result) return;
    onChange(result.path);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={`relative ${className ?? "w-full"}`}>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`field-shell flex-1 px-3 py-2 text-xs ${invalid ? "field-shell--danger" : ""}`}
        />
        <button
          type="button"
          onClick={openPicker}
          className="action-button action-button--muted shrink-0 !rounded-[16px] !px-3 !py-2 !text-[0.64rem]"
          title="Browse directories"
        >
          Browse
        </button>
      </div>

      {open && (
        <div
          ref={popoverRef}
          className="surface-panel surface-panel--raised absolute left-0 right-0 top-full z-50 mt-2 flex max-h-[260px] flex-col overflow-hidden shadow-2xl"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-3 py-2.5 shrink-0">
            <button
              type="button"
              onClick={goUp}
              className="action-button action-button--ghost shrink-0 !px-2.5 !py-1.5 !text-[0.6rem]"
              title="Go up"
            >
              Up
            </button>
            <span className="flex-1 truncate text-[10px] font-mono text-[var(--text-faint)]" title={result?.path}>
              {result?.path ?? "..."}
            </span>
            <button
              type="button"
              onClick={selectCurrent}
              className="action-button action-button--accent shrink-0 !px-3 !py-1.5 !text-[0.6rem]"
            >
              Select
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="px-3 py-3 text-[11px] font-mono text-[var(--text-dim)]">Loading...</div>
            ) : result && result.entries.length === 0 ? (
              <div className="px-3 py-3 text-[11px] font-mono text-[var(--text-dim)]">No subdirectories.</div>
            ) : (
              result?.entries.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => navigateTo(entry)}
                  className="w-full border-b border-[var(--border-soft)] px-3 py-2 text-left text-[11px] font-mono text-[var(--text-secondary)] transition-colors last:border-b-0 hover:bg-[var(--accent-surface)] hover:text-[var(--text-primary)]"
                >
                  [{entry}]
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
