import { type FileDiff, lineColor, basename, dirname } from "../lib/diffUtils";

interface DiffViewerProps {
  files: FileDiff[];
  selectedFile: FileDiff | null;
  onSelectPath: (path: string) => void;
}

/**
 * Shared diff-rendering component used by DiffModal and CommitDiffModal.
 * Renders the file-list sidebar on the left and the syntax-colored diff
 * viewer on the right.
 */
export function DiffViewer({ files, selectedFile, onSelectPath }: DiffViewerProps) {
  return (
    <>
      {/* File list sidebar */}
      <div className="w-56 shrink-0 border-r border-[#1e1e2a] overflow-y-auto flex flex-col">
        {files.map((file) => {
          const active = file.path === selectedFile?.path;
          return (
            <button
              key={file.path}
              onClick={() => onSelectPath(file.path)}
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
                {dirname(file.path)}
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
  );
}
