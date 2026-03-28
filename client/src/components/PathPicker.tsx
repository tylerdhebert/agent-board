import { useState, useRef, useEffect } from "react";
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

  const borderCls = invalid
    ? "border-[#f87171] focus:border-[#f87171]"
    : "border-[#2a2a38] focus:border-[#6366f1]";

  async function browse(path?: string) {
    setLoading(true);
    try {
      const { data } = await api.api.fs.browse.get({ query: path ? { path } : {} });
      setResult(data as BrowseResult);
    } catch {
      // ignore
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
    const sep = result.sep;
    const parts = result.path.split(sep).filter(Boolean);
    if (parts.length <= 1) return;
    const parent = (result.path.startsWith(sep) ? sep : "") + parts.slice(0, -1).join(sep);
    browse(parent);
  }

  function selectCurrent() {
    if (result) {
      onChange(result.path);
      setOpen(false);
    }
  }

  // Close on outside click
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
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 bg-[#0a0a0f] border rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none transition-colors ${borderCls}`}
        />
        <button
          type="button"
          onClick={openPicker}
          className="px-2.5 py-2 bg-[#1e1e2a] border border-[#2a2a38] hover:border-[#6366f1] hover:bg-[#23233a] text-[#94a3b8] font-mono text-xs rounded-sm transition-colors shrink-0"
          title="Browse directories"
        >
          …
        </button>
      </div>

      {open && (
        <div
          ref={popoverRef}
          className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#111118] border border-[#2a2a38] rounded-sm shadow-2xl flex flex-col"
          style={{ maxHeight: 260 }}
        >
          {/* Current path bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e1e2a] shrink-0">
            <button
              onClick={goUp}
              className="text-[11px] font-mono text-[#475569] hover:text-[#94a3b8] transition-colors shrink-0"
              title="Go up"
            >
              ↑
            </button>
            <span className="text-[10px] font-mono text-[#475569] truncate flex-1" title={result?.path}>
              {result?.path ?? "…"}
            </span>
            <button
              onClick={selectCurrent}
              className="px-2 py-0.5 bg-[#6366f1] hover:bg-[#818cf8] text-white font-mono text-[10px] rounded-sm transition-colors shrink-0"
            >
              Select
            </button>
          </div>

          {/* Directory list */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="px-3 py-3 text-[11px] font-mono text-[#334155]">Loading…</div>
            ) : result && result.entries.length === 0 ? (
              <div className="px-3 py-3 text-[11px] font-mono text-[#334155]">No subdirectories.</div>
            ) : (
              result?.entries.map((entry) => (
                <button
                  key={entry}
                  onClick={() => navigateTo(entry)}
                  className="w-full text-left px-3 py-1.5 text-[11px] font-mono text-[#94a3b8] hover:bg-[#1a1a2e] hover:text-[#e2e8f0] transition-colors border-b border-[#1a1a24] last:border-b-0"
                >
                  📁 {entry}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
