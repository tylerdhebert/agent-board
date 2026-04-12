import { join } from "path";

const decoder = new TextDecoder();

export function git(
  args: string[],
  cwd: string
): { stdout: string; stderr: string; exitCode: number } {
  const proc = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    stdout: decoder.decode(proc.stdout),
    stderr: decoder.decode(proc.stderr),
    exitCode: proc.exitCode ?? 1,
  };
}

export function worktreePath(repoPath: string, branchName: string): string {
  return join(repoPath, "..", ".git-worktrees", branchName);
}

export function currentCheckedOutBranch(repoPath: string): string | null {
  const result = git(["rev-parse", "--abbrev-ref", "HEAD"], repoPath);
  if (result.exitCode !== 0) return null;
  const branch = result.stdout.trim();
  if (!branch || branch === "HEAD") return null;
  return branch;
}
