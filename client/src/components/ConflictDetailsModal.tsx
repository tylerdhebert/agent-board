import { useCallback, useState } from "react";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import type { Card } from "../api/types";

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
    if (currentHeader) {
      files.push({
        header: currentHeader,
        filename: currentFilename || "(unknown)",
        content: currentLines.join("\n"),
      });
    }
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
      // Look for filename in metadata lines like: "  our    mode #100644, sha1 <hash>, filename path/to/file.ts"
      const filenameMatch = line.match(/filename\s+(\S+)/);
      if (filenameMatch) {
        currentFilename = filenameMatch[1];
      }
      // Content starts at @@ lines or conflict markers
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
    return { color: "#f87171", background: "#3d1515" };
  }
  if (line.startsWith("=======")) {
    return { color: "#fbbf24", background: "#2d2d10" };
  }
  if (line.startsWith(">>>>>>>")) {
    return { color: "#4ade80", background: "#0d2d1a" };
  }
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return { color: "#4ade80", background: "#0d2d1a" };
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return { color: "#f87171", background: "#3d1515" };
  }
  return { color: "#64748b", background: "transparent" };
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export function ConflictDetailsModal({ card, onClose }: Props) {
  const handleClose = useCallback(() => onClose(), [onClose]);
  useEscapeToClose(handleClose);

  const files = parseMergeTree(card.conflictDetails ?? "");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggleCollapse = (index: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-5xl mx-4 bg-[#111118] border border-[#2a2a38] rounded-sm shadow-2xl flex flex-col h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        style={{ borderTop: "3px solid #f59e0b" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-[#1e1e2a] shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-[#f59e0b] bg-[#2d2000] px-2 py-0.5 rounded-sm border border-[#4a3800]">
                CONFLICT
              </span>
              <span className="text-[10px] font-mono text-[#475569]">
                {files.length} file{files.length !== 1 ? "s" : ""} affected
              </span>
            </div>
            <h2 className="text-sm font-semibold text-[#e2e8f0] leading-snug">
              Merge conflict details — {card.title}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-[#475569] hover:text-[#94a3b8] font-mono text-lg leading-none transition-colors shrink-0"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {files.length === 0 && (
            <p className="text-[#475569] font-mono text-xs">
              No parsed conflict sections found. Raw output may be empty or unparseable.
            </p>
          )}

          {files.map((file, index) => {
            const isCollapsed = collapsed.has(index);
            return (
              <div
                key={index}
                className="border border-[#2a2a38] rounded-sm overflow-hidden"
              >
                {/* File header */}
                <button
                  onClick={() => toggleCollapse(index)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-[#16161f] hover:bg-[#1c1c28] transition-colors text-left"
                >
                  <span className="text-[#f59e0b] font-mono text-[10px] shrink-0">
                    {isCollapsed ? "▶" : "▼"}
                  </span>
                  <span className="font-mono text-[11px] text-[#e2e8f0] truncate">
                    {basename(file.filename)}
                  </span>
                  {file.filename.includes("/") && (
                    <span className="font-mono text-[10px] text-[#475569] truncate">
                      {file.filename.slice(0, file.filename.lastIndexOf("/"))}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-[#64748b] shrink-0 capitalize">
                    {file.header}
                  </span>
                </button>

                {/* File content */}
                {!isCollapsed && (
                  <pre className="font-mono text-xs leading-relaxed bg-[#0a0a0f] overflow-x-auto p-0">
                    {file.content.split("\n").map((line, lineIndex) => {
                      const { color, background } = conflictLineStyle(line);
                      return (
                        <span
                          key={lineIndex}
                          style={{ color, backgroundColor: background, display: "block", paddingLeft: "12px", paddingRight: "12px" }}
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
      </div>
    </div>
  );
}
