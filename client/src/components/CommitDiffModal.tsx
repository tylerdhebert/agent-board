import { useCallback, useEffect, useState } from "react";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import { api } from "../api/client";
import type { Commit, CommitDetail } from "../api/types";
import { parseDiff, type FileDiff } from "../lib/diffUtils";
import { formatTimestamp } from "../lib/formatUtils";
import { DiffViewer } from "./DiffViewer";
import { ModalOverlay } from "./ui/ModalOverlay";

interface Props {
  featureId: string;
  commit: Commit;
  onClose: () => void;
}

export function CommitDiffModal({ featureId, commit, onClose }: Props) {
  const [data, setData] = useState<CommitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    return () => {
      cancelled = true;
    };
  }, [featureId, commit.hash]);

  const files: FileDiff[] = data ? parseDiff(data.diff) : [];

  return (
    <ModalOverlay onClose={handleClose} className="flex h-[85vh] max-w-6xl flex-col overflow-hidden">
      <div className="flex h-full flex-col overflow-hidden rounded-[24px]">
        <div className="border-b border-[var(--border-soft)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="section-kicker mb-3">
                <span className="section-kicker__dot" />
                Commit Review
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="stat-pill">{commit.hash.slice(0, 8)}</span>
                <span className="stat-pill">{commit.author}</span>
                <span className="stat-pill">{formatTimestamp(commit.date)}</span>
                {!loading && files.length > 0 && (
                  <span className="stat-pill">{files.length} file{files.length === 1 ? "" : "s"}</span>
                )}
              </div>
              <h2 className="display-title text-3xl leading-none">{commit.subject}</h2>
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
