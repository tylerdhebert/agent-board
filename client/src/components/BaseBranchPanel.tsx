import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Feature, Repo, Commit, BuildResult } from "../api/types";
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

  // Features in this epic that have both a repo and a branch
  const epicFeatures = allFeatures.filter(
    (f) => f.epicId === epicId && f.repoId && f.branchName
  );

  // If a specific feature is selected in the sidebar, only show that one
  const visibleFeatures =
    hierarchyFilter.type === "feature"
      ? epicFeatures.filter((f) => f.id === hierarchyFilter.id)
      : epicFeatures;

  return (
    <>
      <div className="w-72 shrink-0 flex flex-col bg-[#0d0d14] border-l border-[#1e1e2a] overflow-y-auto">
        {/* Panel header */}
        <div className="px-3 py-2.5 border-b border-[#1e1e2a] shrink-0">
          <span className="text-[11px] font-mono text-[#475569] uppercase tracking-wider">
            Branch Commits
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {visibleFeatures.length === 0 ? (
            <div className="px-3 py-4 text-[11px] font-mono text-[#334155]">
              {epicFeatures.length === 0
                ? "No features with a branch configured."
                : "Selected feature has no branch configured."}
            </div>
          ) : (
            visibleFeatures.map((feature) => {
              const repo = allRepos.find((r) => r.id === feature.repoId);
              return (
                <FeatureSection
                  key={feature.id}
                  feature={feature}
                  repo={repo ?? null}
                  onCommitClick={(commit) => setSelectedCommit({ featureId: feature.id, commit })}
                />
              );
            })
          )}
        </div>
      </div>

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

  const hasBuildCommand = !!(repo?.buildCommand);

  return (
    <div className="border-b border-[#1e1e2a] last:border-b-0">
      {/* Feature header */}
      <div className="px-3 py-2 bg-[#111118] sticky top-0 z-10">
        <p className="text-[11px] font-mono font-semibold text-[#94a3b8] truncate">
          {feature.title}
        </p>
        <p className="text-[10px] font-mono text-[#475569] mt-0.5">
          {repo && <span>{repo.name} / </span>}
          <span className="text-[#818cf8]">⎇ {feature.branchName}</span>
        </p>

        {/* Build controls */}
        {hasBuildCommand && (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setBuildOutputExpanded(false);
                triggerBuildMutation.mutate();
              }}
              disabled={triggerBuildMutation.isPending || buildResult?.status === "running"}
              className="px-2 py-0.5 bg-[#1a1a2e] border border-[#2a2a4a] hover:border-[#6366f1] disabled:opacity-50 text-[#818cf8] font-mono text-[10px] rounded-sm transition-colors"
            >
              {buildResult?.status === "running" ? "Building..." : "Run Build"}
            </button>

            {buildResult && (
              <button
                onClick={() => setBuildOutputExpanded((v) => !v)}
                className={`flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] rounded-sm border transition-colors ${
                  buildResult.status === "running"
                    ? "border-[#2a2a4a] text-[#64748b] animate-pulse"
                    : buildResult.status === "passed"
                    ? "border-[#1a3a1a] text-[#4ade80] hover:border-[#4ade80]"
                    : "border-[#3a1a1a] text-[#f87171] hover:border-[#f87171]"
                }`}
              >
                {buildResult.status === "running" && (
                  <span className="w-2 h-2 rounded-full bg-[#64748b] animate-pulse inline-block" />
                )}
                {buildResult.status === "passed" && <span>&#10003;</span>}
                {buildResult.status === "failed" && <span>&#10007;</span>}
                <span className="capitalize">{buildResult.status}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Build output */}
      {buildResult && buildOutputExpanded && buildResult.output && (
        <div className="px-3 py-2 bg-[#0a0a0f] border-b border-[#1e1e2a]">
          <pre className="text-[10px] font-mono text-[#94a3b8] whitespace-pre-wrap break-all max-h-48 overflow-y-auto leading-relaxed">
            {buildResult.output}
          </pre>
        </div>
      )}

      {/* Commits */}
      {isLoading ? (
        <div className="px-3 py-3 space-y-1.5">
          <div className="h-3 bg-[#1a1a24] rounded animate-pulse" />
          <div className="h-3 bg-[#1a1a24] rounded animate-pulse w-4/5" />
        </div>
      ) : commits.length === 0 ? (
        <div className="px-3 py-3 text-[11px] font-mono text-[#334155]">
          No commits ahead of {repo?.baseBranch ?? "base"}.
        </div>
      ) : (
        <div className="flex flex-col">
          {commits.map((commit) => (
            <button
              key={commit.hash}
              onClick={() => onCommitClick(commit)}
              className="text-left px-3 py-2.5 border-b border-[#1a1a24] last:border-b-0 hover:bg-[#111118] transition-colors group"
            >
              <p className="text-[12px] font-mono text-[#cbd5e1] leading-snug line-clamp-2 group-hover:text-[#e2e8f0]">
                {commit.subject}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-mono text-[#475569] truncate">
                  {commit.author}
                </span>
                <span className="text-[10px] font-mono text-[#334155]">·</span>
                <span className="text-[10px] font-mono text-[#334155] shrink-0">
                  {formatCommitDate(commit.date)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
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
