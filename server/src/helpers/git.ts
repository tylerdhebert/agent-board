/**
 * Shared helpers for parsing git log/show output.
 *
 * Both epics.ts and features.ts use `--format=%H|%ae|%s|%ai` — these helpers
 * parse that exact format.
 */

export interface CommitSummary {
  hash: string;
  author: string;
  subject: string;
  date: string;
}

export interface CommitDetail extends CommitSummary {
  diff: string;
}

/**
 * Parses the output of `git log --format=%H|%ae|%s|%ai` into an array of
 * commit summary objects.
 *
 * @param stdout - Raw stdout from the git log command
 */
export function parseCommitLog(stdout: string): CommitSummary[] {
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, author, subject, date] = line.split("|");
      return { hash, author, subject, date };
    });
}

/**
 * Parses the output of `git show --format=%H|%ae|%s|%ai --patch` into a
 * commit detail object (summary fields + full diff).
 *
 * @param stdout - Raw stdout from the git show command
 */
export function parseCommitDetail(stdout: string): CommitDetail {
  const diffMarker = "diff --git";
  const diffIndex = stdout.indexOf(diffMarker);
  const header = diffIndex === -1 ? stdout : stdout.slice(0, diffIndex);
  const diff = diffIndex === -1 ? "" : stdout.slice(diffIndex);

  const headerLine = header.trim().split("\n").find((l) => l.includes("|")) ?? "";
  const [hash, author, subject, date] = headerLine.split("|");

  return { hash, author, subject, date, diff };
}
