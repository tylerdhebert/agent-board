import { useCallback, useState } from "react";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import type { Card } from "../api/types";
import { ModalOverlay } from "./ui/ModalOverlay";
import { basename } from "../lib/diffUtils";

interface Props {
  card: Card;
  onClose: () => void;
}

interface ConflictFile {
  header: string;
  filename: string;
  content: string;
}

const FILE_SECTION_HEADERS = [
  "changed in both",
  "added in remote",
  "removed in remote",
  "added in local",
  "removed in local",
];

function parseMergeTree(output: string): ConflictFile[] {
  if (!output.trim()) return [];

  const lines = output.split("\n");
  const files: ConflictFile[] = [];
  let currentHeader = "";
  let currentFilename = "";
  let currentLines: string[] = [];
  let inContent = false;

  const flush = () => {
    if (!currentHeader) return;
    files.push({
      header: currentHeader,
      filename: currentFilename || "(unknown)",
      content: currentLines.join("\n"),
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const matchedHeader = FILE_SECTION_HEADERS.find((h) => trimmed === h);
    if (matchedHeader) {
      flush();
      currentHeader = matchedHeader;
      currentFilename = "";
      currentLines = [];
      inContent = false;
      continue;
    }

    if (currentHeader && !inContent) {
      const filenameMatch = line.match(/filename\s+(\S+)/);
      if (filenameMatch) {
        currentFilename = filenameMatch[1];
      }
      if (line.startsWith("@@") || line.startsWith("<<<<<<<") || line.startsWith("+") || line.startsWith("-")) {
        inContent = true;
        currentLines.push(line);
      }
    } else if (inContent) {
      currentLines.push(line);
    }
  }

  flush();
  return files;
}

function conflictLineStyle(line: string): { color: string; background: string } {
  if (line.startsWith("<<<<<<<")) {
    return { color: "var(--danger)", background: "var(--danger-soft)" };
  }
  if (line.startsWith("=======")) {
    return { color: "var(--warning)", background: "var(--warning-soft)" };
  }
  if (line.startsWith(">>>>>>>")) {
    return { color: "var(--success)", background: "var(--success-soft)" };
  }
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return { color: "var(--success)", background: "var(--success-soft)" };
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return { color: "var(--danger)", background: "var(--danger-soft)" };
  }
  return { color: "var(--text-secondary)", background: "transparent" };
}

export function ConflictDetailsModal({ card, onClose }: Props) {
  const handleClose = useCallback(() => onClose(), [onClose]);
  useEscapeToClose(handleClose);

  const files = parseMergeTree(card.conflictDetails ?? "");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  function toggleCollapse(index: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <ModalOverlay onClose={handleClose} zIndex="z-[60]" className="flex h-[85vh] max-w-6xl flex-col overflow-hidden">
      <div className="flex h-full flex-col overflow-hidden rounded-[24px]">
        <div className="border-b border-[var(--border-soft)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="section-kicker mb-3">
                <span className="section-kicker__dot" />
                Conflict Review
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="stat-pill">{files.length} file{files.length === 1 ? "" : "s"} affected</span>
                <span className="stat-pill">merge state</span>
              </div>
              <h2 className="display-title text-3xl leading-none">{card.title}</h2>
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

        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          {files.length === 0 ? (
            <div className="surface-panel px-5 py-6 text-center">
              <div className="meta-label mb-3">Conflict Parser</div>
              <p className="text-sm text-[var(--text-dim)]">
                No parsed conflict sections were found. Raw output may be empty or unparseable.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file, index) => {
                const isCollapsed = collapsed.has(index);
                return (
                  <div key={index} className="surface-panel overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(index)}
                      className="flex w-full items-center gap-3 border-b border-[var(--border-soft)] px-4 py-3 text-left transition-colors hover:bg-[var(--accent-surface)]"
                    >
                      <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-[var(--warning)]">
                        {isCollapsed ? "open" : "hide"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">
                          {basename(file.filename)}
                        </p>
                        <p className="truncate text-[10px] font-mono text-[var(--text-faint)]">
                          {file.filename}
                        </p>
                      </div>
                      <span className="stat-pill capitalize">{file.header}</span>
                    </button>

                    {!isCollapsed && (
                      <pre className="overflow-x-auto bg-[var(--panel-ink)] p-4 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        {file.content.split("\n").map((line, lineIndex) => {
                          const { color, background } = conflictLineStyle(line);
                          return (
                            <span
                              key={lineIndex}
                              style={{
                                color,
                                backgroundColor: background,
                                display: "block",
                                paddingInline: "0.75rem",
                                borderRadius: "0.45rem",
                              }}
                            >
                              {line || "\u00a0"}
                            </span>
                          );
                        })}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
