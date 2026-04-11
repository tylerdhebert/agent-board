import { useCallback, useEffect, useState } from "react";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import { api } from "../api/client";
import { parseDiff, type FileDiff } from "../lib/diffUtils";
import { DiffViewer } from "./DiffViewer";
import { ModalOverlay } from "./ui/ModalOverlay";
import { Combobox } from "./ui/Combobox";

interface DiffModalProps {
  cardId: string;
  cardTitle: string;
  branchName: string;
  repoId: string;
  availableBranches: string[];
  onClose: () => void;
}

interface DiffData {
  diff: string;
  stat: string;
  baseBranch: string;
  branchName: string;
}

export function DiffModal({ cardId, cardTitle, branchName, repoId, availableBranches, onClose }: DiffModalProps) {
  void repoId;
  const [data, setData] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = let server decide (uses currently checked-out branch)
  // string = explicit user selection
  const [selectedBase, setSelectedBase] = useState<string | null>(null);

  const handleClose = useCallback(() => onClose(), [onClose]);
  useEscapeToClose(handleClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchDiff = selectedBase !== null
      ? (api.api.cards({ id: cardId }) as any).diff.get({ query: { baseBranch: selectedBase } })
      : api.api.cards({ id: cardId }).diff.get();

    fetchDiff.then(({ data: responseData, error: responseError }: any) => {
      if (cancelled) return;
      if (responseError) {
        setError(responseError.value?.error ?? "Failed to load diff");
      } else {
        setData(responseData as DiffData);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [cardId, selectedBase]);

  const files: FileDiff[] = data ? parseDiff(data.diff) : [];
  const comboboxValue = selectedBase ?? data?.baseBranch ?? "";

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
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="stat-pill">{branchName}</span>
                {!loading && files.length > 0 && (
                  <span className="stat-pill">{files.length} file{files.length === 1 ? "" : "s"}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[var(--text-faint)]">diff against</span>
                <Combobox
                  options={availableBranches}
                  value={comboboxValue}
                  onChange={(branch) => setSelectedBase(branch)}
                  placeholder="branch..."
                  className="w-48"
                />
              </div>
              <h2 className="display-title mt-3 text-3xl leading-none">{cardTitle}</h2>
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
