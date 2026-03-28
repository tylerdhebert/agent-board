// Shared utilities for rendering unified diffs

export interface FileDiff {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
}

export function parseDiff(fullDiff: string): FileDiff[] {
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

export function lineColor(line: string): string {
  if (line.startsWith("+")) return "#4ade80";
  if (line.startsWith("-")) return "#f87171";
  if (line.startsWith("@@")) return "#818cf8";
  return "#94a3b8";
}

export function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export function dirname(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}
