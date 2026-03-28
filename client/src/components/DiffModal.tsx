import { useCallback, useEffect, useState } from "react";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import { api } from "../api/client";
import { parseDiff, type FileDiff } from "../lib/diffUtils";
import { DiffViewer } from "./DiffViewer";
import { ModalOverlay } from "./ui/ModalOverlay";

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

  return (
    <ModalOverlay onClose={handleClose} className="flex flex-col h-[85vh] max-w-5xl">
      <div style={{ borderTop: "3px solid #818cf8" }} className="flex flex-col h-full rounded-sm overflow-hidden">
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
          <DiffViewer loading={loading} error={error} files={files} />
        </div>
      </div>
    </ModalOverlay>
  );
}
