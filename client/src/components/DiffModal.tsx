import { useCallback, useEffect, useState } from "react";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import { api } from "../api/client";
import { parseDiff, type FileDiff } from "../lib/diffUtils";
import { DiffViewer } from "./DiffViewer";

interface DiffModalProps {
  cardId: string;
  cardTitle: string;
  branchName: string;
  onClose: () => void;
}

interface DiffData {
  diff: string;
  stat: string;
  branchName: string;
}

export function DiffModal({ cardId, cardTitle, branchName, onClose }: DiffModalProps) {
  const [data, setData] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleClose = useCallback(() => onClose(), [onClose]);
  useEscapeToClose(handleClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.api.cards({ id: cardId }).diff.get().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setError((error as any).value?.error ?? "Failed to load diff");
        setLoading(false);
      } else {
        setData(data as DiffData);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [cardId]);

  const files: FileDiff[] = data ? parseDiff(data.diff) : [];

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
                ⎇ {branchName}
              </span>
              {!loading && files.length > 0 && (
                <span className="text-[10px] font-mono text-[#475569]">
                  {files.length} file{files.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <h2 className="text-sm font-semibold text-[#e2e8f0] leading-snug">{cardTitle}</h2>
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
            <DiffViewer
              files={files}
              selectedFile={selectedFile}
              onSelectPath={setSelectedPath}
            />
          )}
        </div>
      </div>
    </div>
  );
}
