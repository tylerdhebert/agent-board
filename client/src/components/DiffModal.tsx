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

    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const files: FileDiff[] = data ? parseDiff(data.diff) : [];

  return (
    <ModalOverlay onClose={handleClose} className="flex h-[85vh] max-w-6xl flex-col overflow-hidden">
      <div className="flex h-full flex-col overflow-hidden rounded-[24px]">
        <div className="border-b border-[var(--border-soft)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="section-kicker mb-3">
                <span className="section-kicker__dot" />
                Branch Review
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="stat-pill">{branchName}</span>
                {!loading && files.length > 0 && (
                  <span className="stat-pill">{files.length} file{files.length === 1 ? "" : "s"}</span>
                )}
              </div>
              <h2 className="display-title text-3xl leading-none">{cardTitle}</h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="action-button action-button--ghost shrink-0 !px-3 !py-2 !text-[0.62rem]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <DiffViewer loading={loading} error={error} files={files} />
        </div>
      </div>
    </ModalOverlay>
  );
}
