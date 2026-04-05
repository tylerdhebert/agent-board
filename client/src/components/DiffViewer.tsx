import { useEffect, useState } from "react";
import { type FileDiff, diffLineBg, diffLineColor, basename, dirname } from "../lib/diffUtils";

interface DiffViewerProps {
  loading: boolean;
  error: string | null;
  files: FileDiff[];
}

export function DiffViewer({ loading, error, files }: DiffViewerProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    if (files.length > 0 && !selectedPath) {
      setSelectedPath(files[0].path);
    }
  }, [files, selectedPath]);

  const selectedFile = files.find((f) => f.path === selectedPath) ?? files[0] ?? null;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="surface-panel surface-panel--soft w-full max-w-xl space-y-3 px-5 py-5">
          <div className="h-3 rounded-full bg-[var(--panel-hover)] animate-pulse" />
          <div className="h-3 w-4/5 rounded-full bg-[var(--panel-hover)] animate-pulse" />
          <div className="h-3 w-3/5 rounded-full bg-[var(--panel-hover)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="surface-panel w-full max-w-xl px-5 py-5 text-center">
          <div className="meta-label mb-3">Diff Error</div>
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="surface-panel w-full max-w-xl px-5 py-5 text-center">
          <div className="meta-label mb-3">Diff Snapshot</div>
          <p className="text-sm text-[var(--text-dim)]">No differences found.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-64 shrink-0 border-r border-[var(--border-soft)] bg-[var(--panel-soft)] overflow-y-auto">
        <div className="border-b border-[var(--border-soft)] px-4 py-3">
          <div className="meta-label">Changed Files</div>
        </div>
        <div className="p-2">
          {files.map((file) => {
            const active = file.path === selectedFile?.path;
            const dir = dirname(file.path);
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedPath(file.path)}
                className={`mb-2 w-full rounded-[18px] border px-3 py-3 text-left transition-colors last:mb-0 ${
                  active
                    ? "border-[var(--accent-border)] bg-[var(--accent-surface)]"
                    : "border-[var(--border-soft)] bg-transparent hover:bg-[var(--panel-hover)]"
                }`}
              >
                <p className={`truncate text-[11px] font-semibold ${active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                  {basename(file.path)}
                </p>
                {dir && (
                  <p className="mt-1 truncate text-[10px] font-mono text-[var(--text-faint)]">{dir}</p>
                )}
                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono">
                  {file.additions > 0 && <span style={{ color: "var(--success)" }}>+{file.additions}</span>}
                  {file.deletions > 0 && <span style={{ color: "var(--danger)" }}>-{file.deletions}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-auto bg-[var(--panel-ink)]">
        {selectedFile && (
          <pre className="min-h-full p-5 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {selectedFile.diff.split("\n").map((line, i) => (
              <span
                key={i}
                style={{
                  color: diffLineColor(line),
                  display: "block",
                  backgroundColor: diffLineBg(line),
                  paddingInline: "0.5rem",
                  borderRadius: "0.45rem",
                }}
              >
                {line || "\u00a0"}
              </span>
            ))}
          </pre>
        )}
      </div>
    </>
  );
}
