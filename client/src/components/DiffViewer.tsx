/**
 * DiffViewer
 *
 * Renders a split-pane diff UI: a file-list sidebar on the left and a
 * colourised diff on the right.  Used by both DiffModal (card branch diff)
 * and CommitDiffModal (single-commit diff) so the layout/logic is not
 * duplicated.
 */

import { useState, useEffect } from "react";
import { type FileDiff, diffLineColor, diffLineBg, basename } from "../lib/diffUtils";

interface DiffViewerProps {
  loading: boolean;
  error: string | null;
  files: FileDiff[];
}

export function DiffViewer({ loading, error, files }: DiffViewerProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Auto-select first file when files change.
  useEffect(() => {
    if (files.length > 0 && !selectedPath) {
      setSelectedPath(files[0].path);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  const selectedFile = files.find((f) => f.path === selectedPath) ?? files[0] ?? null;

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-2">
        <div className="h-3 bg-[#1a1a24] rounded animate-pulse" />
        <div className="h-3 bg-[#1a1a24] rounded animate-pulse w-4/5" />
        <div className="h-3 bg-[#1a1a24] rounded animate-pulse w-3/5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6">
        <p className="text-[#f87171] font-mono text-xs">Error: {error}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 p-6">
        <p className="font-mono text-xs text-[#475569]">No differences found.</p>
      </div>
    );
  }

  return (
    <>
      {/* File list sidebar */}
      <div className="w-56 shrink-0 border-r border-[#1e1e2a] overflow-y-auto flex flex-col">
        {files.map((file) => {
          const active = file.path === selectedFile?.path;
          const dir = file.path.includes("/")
            ? file.path.slice(0, file.path.lastIndexOf("/"))
            : "";
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
              {dir && (
                <p className="text-[10px] font-mono text-[#475569] truncate mt-0.5">{dir}</p>
              )}
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

      {/* Diff content */}
      <div className="flex-1 overflow-auto min-w-0">
        {selectedFile && (
          <pre className="p-4 font-mono text-xs leading-relaxed bg-[#0a0a0f] min-h-full">
            {selectedFile.diff.split("\n").map((line, i) => (
              <span
                key={i}
                style={{
                  color: diffLineColor(line),
                  display: "block",
                  backgroundColor: diffLineBg(line),
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
