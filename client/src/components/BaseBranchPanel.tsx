import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { BuildResult, Commit, Feature, Repo } from "../api/types";
import { CommitDiffModal } from "./CommitDiffModal";
import { useBoardStore } from "../store";

interface Props {
  epicId: string;
}

export function BaseBranchPanel({ epicId }: Props) {
  const [selectedCommit, setSelectedCommit] = useState<{ featureId: string; commit: Commit } | null>(null);
  const hierarchyFilter = useBoardStore((s) => s.hierarchyFilter);

  const { data: allFeatures = [] } = useQuery<Feature[]>({
    queryKey: ["features"],
    queryFn: async () => {
      const { data } = await api.api.features.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: allRepos = [] } = useQuery<Repo[]>({
    queryKey: ["repos"],
    queryFn: async () => {
      const { data } = await api.api.repos.get();
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const epicFeatures = allFeatures.filter((f) => f.epicId === epicId && f.repoId && f.branchName);
  const visibleFeatures =
    hierarchyFilter.type === "feature"
      ? epicFeatures.filter((f) => f.id === hierarchyFilter.id)
      : epicFeatures;

  return (
    <>
      <aside className="surface-panel surface-panel--soft hidden w-[282px] shrink-0 overflow-hidden xl:flex xl:flex-col">
        <div className="border-b border-[var(--border-soft)] px-4 py-3">
          <div className="meta-label mb-1.5">Branches</div>
          <h3 className="text-[0.95rem] font-semibold text-[var(--text-primary)]">
            Branch monitor
          </h3>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
            Commits and build health for the branches attached to this epic.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5">
          {visibleFeatures.length === 0 ? (
            <div className="surface-panel bg-transparent px-4 py-5 text-[11px] font-mono text-[var(--text-dim)]">
              {epicFeatures.length === 0
                ? "No features in this epic have a configured repo branch."
                : "The selected feature does not have a configured repo branch."}
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleFeatures.map((feature) => {
                const repo = allRepos.find((r) => r.id === feature.repoId);
                return (
                  <FeatureSection
                    key={feature.id}
                    feature={feature}
                    repo={repo ?? null}
                    onCommitClick={(commit) => setSelectedCommit({ featureId: feature.id, commit })}
                  />
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {selectedCommit && (
        <CommitDiffModal
          featureId={selectedCommit.featureId}
          commit={selectedCommit.commit}
          onClose={() => setSelectedCommit(null)}
        />
      )}
    </>
  );
}

interface FeatureSectionProps {
  feature: Feature;
  repo: Repo | null;
  onCommitClick: (commit: Commit) => void;
}

function FeatureSection({ feature, repo, onCommitClick }: FeatureSectionProps) {
  const queryClient = useQueryClient();
  const [buildOutputExpanded, setBuildOutputExpanded] = useState(false);

  const { data: commits = [], isLoading } = useQuery<Commit[]>({
    queryKey: ["feature-commits", feature.id],
    queryFn: async () => {
      const { data } = await (api.api.features({ id: feature.id }) as any).commits.get();
      return (data as Commit[]) ?? [];
    },
    staleTime: 30_000,
    enabled: !!(feature.repoId && feature.branchName),
  });

  const { data: buildResult } = useQuery<BuildResult | null>({
    queryKey: ["build-result", feature.id],
    queryFn: async () => {
      const { data } = await (api.api.features({ id: feature.id }) as any).build.get();
      return (data as BuildResult) ?? null;
    },
    staleTime: 10_000,
    refetchInterval: (query) => {
      const data = query.state.data as BuildResult | null | undefined;
      return data?.status === "running" ? 3000 : false;
    },
  });

  const triggerBuildMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (api.api.features({ id: feature.id }) as any).build.post({});
      if (error) throw new Error("Failed to trigger build");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["build-result", feature.id] });
    },
  });

  const hasBuildCommand = !!repo?.buildCommand;
  const buildLabel =
    buildResult?.status === "passed"
      ? "action-button action-button--success !px-3 !py-1.5 !text-[0.58rem]"
      : buildResult?.status === "failed"
        ? "action-button action-button--danger !px-3 !py-1.5 !text-[0.58rem]"
        : "action-button action-button--muted !px-3 !py-1.5 !text-[0.58rem]";

  return (
    <section className="surface-panel overflow-hidden">
      <div className="border-b border-[var(--border-soft)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{feature.title}</p>
            <p className="mt-1 truncate text-[10px] font-mono text-[var(--text-faint)]">
              {repo?.name ?? "unassigned repo"} / {feature.branchName}
            </p>
          </div>
          {hasBuildCommand && (
            <button
              type="button"
              onClick={() => {
                setBuildOutputExpanded(false);
                triggerBuildMutation.mutate();
              }}
              disabled={triggerBuildMutation.isPending || buildResult?.status === "running"}
              className="action-button action-button--accent shrink-0 !px-3 !py-1.5 !text-[0.58rem]"
            >
              {buildResult?.status === "running" ? "Building" : "Run build"}
            </button>
          )}
        </div>

        {buildResult && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBuildOutputExpanded((v) => !v)}
              className={buildLabel}
            >
              {buildResult.status}
            </button>
            {repo?.baseBranch && <span className="stat-pill">base {repo.baseBranch}</span>}
          </div>
        )}
      </div>

      {buildResult && buildOutputExpanded && buildResult.output && (
        <div className="border-b border-[var(--border-soft)] bg-[var(--panel-ink)] px-4 py-3">
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-[var(--text-secondary)]">
            {buildResult.output}
          </pre>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2 px-4 py-4">
          <div className="h-3 rounded-full bg-[var(--panel-hover)] animate-pulse" />
          <div className="h-3 w-4/5 rounded-full bg-[var(--panel-hover)] animate-pulse" />
        </div>
      ) : commits.length === 0 ? (
        <div className="px-4 py-4 text-[11px] font-mono text-[var(--text-dim)]">
          No commits ahead of {repo?.baseBranch ?? "base"}.
        </div>
      ) : (
        <div className="space-y-2 p-2">
          {commits.map((commit) => (
            <button
              key={commit.hash}
              type="button"
              onClick={() => onCommitClick(commit)}
              className="w-full rounded-[14px] border border-[var(--border-soft)] px-3 py-3 text-left transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--accent-surface)]"
            >
              <p className="line-clamp-2 text-[12px] font-mono leading-snug text-[var(--text-secondary)]">
                {commit.subject}
              </p>
              <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-[var(--text-faint)]">
                <span className="truncate">{commit.author}</span>
                <span>|</span>
                <span className="shrink-0">{formatCommitDate(commit.date)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function formatCommitDate(iso: string): string {
  const date = new Date(iso);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
