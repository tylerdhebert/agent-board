import { useCallback, useEffect, useState } from "react";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import { api } from "../api/client";
import type { Commit, CommitDetail } from "../api/types";

interface Props {
  featureId: string;
  commit: Commit;
  onClose: () => void;
}

interface FileDiff {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
}

function parseDiff(fullDiff: string): FileDiff[] {
  const chunks = fullDiff.split(/(?=^diff --git )/m).filter(Boolean);
  return chunks.map((chunk) => {
    const firstLine = chunk.split("\n")[0];
    const match = firstLine.match(/^diff --git a\/(.*) b\/(.*)$/);
    const path = match ? match[2] : "unknown";
    let additions = 0;
    let deletions = 0;
    for (const line of chunk.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }
    return { path, diff: chunk, additions, deletions };
  });
}

function lineColor(line: string): string {
  if (line.startsWith("+")) return "#4ade80";
  if (line.startsWith("-")) return "#f87171";
  if (line.startsWith("@@")) return "#818cf8";
  return "#94a3b8";
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function CommitDiffModal({ featureId, commit, onClose }: Props) {
  const [data, setData] = useState<CommitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleClose = useCallback(() => onClose(), [onClose]);
  useEscapeToClose(handleClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (api.api.features({ id: featureId }) as any).commits({ hash: commit.hash }).get().then(({ data: detail, error: err }: any) => {
      if (cancelled) return;
      if (err) {
        setError((err as any).value?.error ?? "Failed to load commit diff");
        setLoading(false);
      } else {
        setData(detail as CommitDetail);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [featureId, commit.hash]);

  const files = data ? parseDiff(data.diff) : [];

  useEffect(() => {
    if (files.length > 0 && !selectedPath) {
      setSelectedPath(files[0].path);
    }
  }, [files.length]);

  const selectedFile = files.find((f) => f.path === selectedPath) ?? files[0] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-5xl mx-4 bg-[#111118] border border-[#2a2a38] rounded-sm shadow-2xl flex flex-col h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        style={{ borderTop: "3px solid #818cf8" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-[#1e1e2a] shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-[#818cf8] bg-[#1a1a2e] px-2 py-0.5 rounded-sm border border-[#2a2a4a]">
                {commit.hash.slice(0, 8)}
              </span>
              <span className="text-[10px] font-mono text-[#475569]">{commit.author}</span>
              <span className="text-[10px] font-mono text-[#334155]">{formatTimestamp(commit.date)}</span>
              {!loading && files.length > 0 && (
                <span className="text-[10px] font-mono text-[#475569]">
                  {files.length} file{files.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <h2 className="text-sm font-semibold text-[#e2e8f0] leading-snug">{commit.subject}</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-[#475569] hover:text-[#94a3b8] font-mono text-lg leading-none transition-colors shrink-0"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {loading && (
            <div className="flex-1 p-6 space-y-2">
              <div className="h-3 bg-[#1a1a24] rounded animate-pulse" />
              <div className="h-3 bg-[#1a1a24] rounded animate-pulse w-4/5" />
              <div className="h-3 bg-[#1a1a24] rounded animate-pulse w-3/5" />
            </div>
          )}

          {!loading && error && (
            <div className="flex-1 p-6">
              <p className="text-[#f87171] font-mono text-xs">Error: {error}</p>
            </div>
          )}

          {!loading && !error && data && files.length === 0 && (
            <div className="flex-1 p-6">
              <p className="font-mono text-xs text-[#475569]">No differences found.</p>
            </div>
          )}

          {!loading && !error && files.length > 0 && (
            <>
              {/* File list sidebar */}
              <div className="w-56 shrink-0 border-r border-[#1e1e2a] overflow-y-auto flex flex-col">
                {files.map((file) => {
                  const active = file.path === selectedFile?.path;
                  return (
                    <button
                      key={file.path}
                      onClick={() => setSelectedPath(file.path)}
                      className={`w-full text-left px-3 py-2.5 border-b border-[#1a1a24] transition-colors ${
                        active
                          ? "bg-[#1a1a2e] border-l-2 border-l-[#6366f1]"
                          : "hover:bg-[#16161f] border-l-2 border-l-transparent"
                      }`}
                    >
                      <p className={`text-[11px] font-mono truncate ${active ? "text-[#e2e8f0]" : "text-[#94a3b8]"}`}>
                        {basename(file.path)}
                      </p>
                      <p className="text-[10px] font-mono text-[#475569] truncate mt-0.5">
                        {file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : ""}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {file.additions > 0 && (
                          <span className="text-[10px] font-mono text-[#4ade80]">+{file.additions}</span>
                        )}
                        {file.deletions > 0 && (
                          <span className="text-[10px] font-mono text-[#f87171]">-{file.deletions}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Diff viewer */}
              <div className="flex-1 overflow-auto min-w-0">
                {selectedFile && (
                  <pre className="p-4 font-mono text-xs leading-relaxed bg-[#0a0a0f] min-h-full">
                    {selectedFile.diff.split("\n").map((line, i) => (
                      <span
                        key={i}
                        style={{
                          color: lineColor(line),
                          display: "block",
                          backgroundColor:
                            line.startsWith("+") && !line.startsWith("+++")
                              ? "rgba(74,222,128,0.06)"
                              : line.startsWith("-") && !line.startsWith("---")
                              ? "rgba(248,113,113,0.06)"
                              : "transparent",
                        }}
                      >
                        {line || "\u00a0"}
                      </span>
                    ))}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
