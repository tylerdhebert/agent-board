import { join } from "path";

const decoder = new TextDecoder();

export function getRepoPath(): string {
  const repoPath = process.env.REPO_PATH;
  if (!repoPath) {
    throw new Error(
      "REPO_PATH environment variable is not set. Set it to the absolute path of the git repository."
    );
  }
  return repoPath;
}

export function git(
  args: string[],
  cwd?: string
): { stdout: string; stderr: string; exitCode: number } {
  const proc = Bun.spawnSync(["git", ...args], {
    cwd: cwd ?? getRepoPath(),
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    stdout: decoder.decode(proc.stdout),
    stderr: decoder.decode(proc.stderr),
    exitCode: proc.exitCode ?? 1,
  };
}

export function worktreePath(branchName: string): string {
  return join(getRepoPath(), "..", ".git-worktrees", branchName);
}
