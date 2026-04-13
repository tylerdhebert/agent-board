import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import { api } from "../api/client";
import type { Card, CardWithComments, DependencyInfo, Status, WorkflowStatus } from "../api/types";
import { TypeBadge } from "./TypeBadge";
import { StatusBadge } from "./StatusBadge";
import { DiffModal } from "./DiffModal";
import { ConflictDetailsModal } from "./ConflictDetailsModal";
import { formatTimestamp } from "../lib/formatUtils";
import { ModalOverlay } from "./ui/ModalOverlay";

interface Props {
  statuses: Status[];
  workflowStatuses?: WorkflowStatus[];
}

export function CardModal({ statuses, workflowStatuses }: Props) {
  const queryClient = useQueryClient();
  const selectedCardId = useBoardStore((s) => s.selectedCardId);
  const setOpenModal = useBoardStore((s) => s.setOpenModal);
  const setSelectedCardId = useBoardStore((s) => s.setSelectedCardId);

  const [commentBody, setCommentBody] = useState("");
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [selectedBlockerId, setSelectedBlockerId] = useState("");

  const { data: card, isLoading } = useQuery<CardWithComments>({
    queryKey: ["card", selectedCardId],
    queryFn: async () => {
      const { data } = await api.api.cards({ id: selectedCardId! }).get();
      return data!;
    },
    enabled: !!selectedCardId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (statusId: string) => {
      const { data } = await (api.api.cards({ id: selectedCardId! }) as any).move.post({ statusId });
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["card", selectedCardId] });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async () => {
      await api.api.cards({ id: selectedCardId! }).delete();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      handleClose();
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      const { data } = await api.api.cards({ id: selectedCardId! }).comments.post({ body, author: "user" });
      return data!;
    },
    onSuccess: () => {
      setCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["card", selectedCardId] });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.api.cards({ id: selectedCardId! }).merge.post({});
      if (error) {
        const val = (error as any).value;
        if (val?.conflict) throw new Error(val.message ?? "Merge conflict");
        throw new Error(val?.error ?? "Merge failed");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["card", selectedCardId] });
      handleClose();
    },
    onError: (err: Error) => {
      setMergeError(err.message);
    },
  });

  const { data: deps } = useQuery<DependencyInfo>({
    queryKey: ["card-deps", selectedCardId],
    queryFn: async () => {
      const { data } = await (api.api.cards({ id: selectedCardId! }) as any).dependencies.get();
      return (data as DependencyInfo) ?? { blockers: [], blocking: [] };
    },
    enabled: !!selectedCardId,
  });

  const { data: allCards = [] } = useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data } = await api.api.cards.get();
      return (data as Card[]) ?? [];
    },
    staleTime: 30_000,
  });

  const { data: repoBranches = [] } = useQuery<string[]>({
    queryKey: ["repo-branches", card?.repoId],
    queryFn: async () => {
      const { data } = await (api.api.repos({ id: card!.repoId! }) as any).branches.get();
      return (data as { branches: string[] })?.branches ?? [];
    },
    enabled: !!(card?.repoId && card?.branchName),
    staleTime: 30_000,
  });

  const addBlockerMutation = useMutation({
    mutationFn: async (blockerCardId: string) => {
      const { data, error } = await (api.api.cards({ id: selectedCardId! }) as any).dependencies.post({ blockerCardId });
      if (error) throw new Error("Failed to add blocker");
      return data;
    },
    onSuccess: () => {
      setSelectedBlockerId("");
      queryClient.invalidateQueries({ queryKey: ["card-deps", selectedCardId] });
    },
  });

  const removeBlockerMutation = useMutation({
    mutationFn: async (blockerCardId: string) => {
      await (api.api.cards({ id: selectedCardId! }) as any).dependencies({ blockerCardId }).delete();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-deps", selectedCardId] });
    },
  });

  const clearConflictMutation = useMutation({
    mutationFn: async () => {
      await api.api.cards({ id: selectedCardId! }).patch({ conflictedAt: null, conflictDetails: null } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["card", selectedCardId] });
    },
  });

  const recheckConflictMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (api.api.cards({ id: selectedCardId! }) as any)["recheck-conflicts"].post();
      if (error) throw new Error("Recheck failed");
      return data as { hasConflicts: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["card", selectedCardId] });
    },
  });

  const handleClose = useCallback(() => {
    setOpenModal(null);
    setSelectedCardId(null);
    setSelectedStatusId(null);
    setShowDeleteConfirm(false);
    setShowDiff(false);
    setShowConflicts(false);
    setMergeError(null);
  }, [setOpenModal, setSelectedCardId]);

  useEscapeToClose(handleClose);

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatusId = e.target.value;
    setSelectedStatusId(newStatusId);
    updateStatusMutation.mutate(newStatusId);
  }

  function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    addCommentMutation.mutate(commentBody.trim());
  }

  const currentStatusId = selectedStatusId ?? card?.statusId;
  const currentStatus = statuses.find((s) => s.id === currentStatusId);
  const cardStatus = statuses.find((s) => s.id === card?.statusId);
  const statusOptions = (() => {
    if (!workflowStatuses || workflowStatuses.length === 0) return statuses;
    const inWorkflow = workflowStatuses
      .map((ws) => statuses.find((status) => status.id === ws.statusId))
      .filter((status): status is Status => Boolean(status));
    if (!cardStatus) return inWorkflow;
    return inWorkflow.some((status) => status.id === cardStatus.id)
      ? inWorkflow
      : [cardStatus, ...inWorkflow];
  })();
  const isReadyToMerge = workflowStatuses
    ? workflowStatuses.some((ws) => ws.statusId === card?.statusId && ws.triggersMerge)
    : cardStatus?.name.toLowerCase() === "ready to merge";

  const availableBlockers = allCards.filter((c) => c.id !== selectedCardId && !deps?.blockers.some((b) => b.id === c.id));

  return (
    <>
      <ModalOverlay onClose={handleClose} className="flex max-h-[92vh] max-w-6xl flex-col overflow-hidden">
        <div
          className="flex max-h-[92vh] flex-col overflow-hidden rounded-[24px]"
          style={currentStatus ? { boxShadow: `inset 0 3px 0 ${currentStatus.color}` } : undefined}
        >
          <div className="border-b border-[var(--border-soft)] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="section-kicker mb-3">
                  <span className="section-kicker__dot" />
                  Card Detail
                </div>

                {isLoading ? (
                  <div className="space-y-3">
                    <div className="h-4 w-24 rounded-full bg-[var(--panel-hover)] animate-pulse" />
                    <div className="h-10 w-2/3 rounded-full bg-[var(--panel-hover)] animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {card && <TypeBadge type={card.type} />}
                      {currentStatus && <StatusBadge status={currentStatus} />}
                      <span className="stat-pill">{card?.ref ?? card?.id}</span>
                    </div>
                    <h2 className="display-title text-4xl leading-none">{card?.title}</h2>
                  </>
                )}
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

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {isLoading ? (
              <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
                <div className="space-y-4">
                  <div className="surface-panel h-40 animate-pulse" />
                  <div className="surface-panel h-48 animate-pulse" />
                </div>
                <div className="surface-panel h-72 animate-pulse" />
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
                <div className="space-y-5">
                  {card?.description && (
                    <SectionCard title="Description">
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
                        {card.description}
                      </p>
                    </SectionCard>
                  )}

                  {(card?.plan || card?.latestUpdate || card?.blockedReason || card?.handoffSummary) && (
                    <SectionCard title="Workflow State">
                      <div className="space-y-3">
                        {card.plan && <WorkflowField label="Plan" value={card.plan} />}
                        {card.latestUpdate && <WorkflowField label="Latest Update" value={card.latestUpdate} />}
                        {card.blockedReason && <WorkflowField label="Blocked Reason" value={card.blockedReason} tone="danger" />}
                        {card.handoffSummary && <WorkflowField label="Handoff Summary" value={card.handoffSummary} tone="success" />}
                      </div>
                    </SectionCard>
                  )}

                  <SectionCard title={`Blockers (${deps?.blockers.length ?? 0})`}>
                    <div className="space-y-2">
                      {deps?.blockers.length ? (
                        deps.blockers.map((blocker) => {
                          const isDone = blocker.statusName.toLowerCase() === "done";
                          return (
                            <div
                              key={blocker.id}
                              className="flex items-center gap-3 rounded-[18px] border border-[var(--border-soft)] bg-[var(--panel-ink)] px-3 py-3"
                            >
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${isDone ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-mono text-[var(--text-faint)]">
                                  {blocker.ref ?? blocker.id}
                                </p>
                                <p className={`truncate text-[12px] font-semibold ${isDone ? "line-through text-[var(--text-faint)]" : "text-[var(--text-primary)]"}`}>
                                  {blocker.title}
                                </p>
                                <p className="mt-1 text-[10px] font-mono text-[var(--text-faint)]">{blocker.statusName}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeBlockerMutation.mutate(blocker.id)}
                                disabled={removeBlockerMutation.isPending}
                                className="action-button action-button--ghost shrink-0 !px-2.5 !py-1.5 !text-[0.56rem]"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-[11px] font-mono text-[var(--text-dim)]">No blockers are currently attached.</p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <select
                        value={selectedBlockerId}
                        onChange={(e) => setSelectedBlockerId(e.target.value)}
                        className="field-shell flex-1 cursor-pointer px-3 py-3 text-xs"
                      >
                        <option value="">Add a blocker...</option>
                        {availableBlockers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {(c.ref ?? c.id)} - {c.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedBlockerId) addBlockerMutation.mutate(selectedBlockerId);
                        }}
                        disabled={!selectedBlockerId || addBlockerMutation.isPending}
                        className="action-button action-button--muted shrink-0"
                      >
                        {addBlockerMutation.isPending ? "Adding" : "Add"}
                      </button>
                    </div>
                  </SectionCard>

                  <SectionCard title={`Comments (${card?.comments.length ?? 0})`}>
                    <div className="space-y-3">
                      {card?.comments.length ? (
                        card.comments.map((comment) => {
                          const isAgent = comment.author === "agent";
                          const authorLabel = isAgent ? (comment.agentId ?? "Agent") : "User";
                          return (
                            <div
                              key={comment.id}
                              className="rounded-[20px] border px-4 py-3"
                              style={{
                                borderColor: isAgent ? "var(--accent-border)" : "rgba(74, 222, 128, 0.3)",
                                background: isAgent ? "var(--accent-surface)" : "var(--success-soft)",
                              }}
                            >
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="meta-label" style={{ color: isAgent ? "var(--accent-strong)" : "var(--success)" }}>
                                  {authorLabel}
                                </span>
                                <span className="text-[10px] font-mono text-[var(--text-faint)]">
                                  {formatTimestamp(comment.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                                {comment.body}
                              </p>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-[11px] font-mono text-[var(--text-dim)]">No comments yet.</p>
                      )}
                    </div>

                    <form onSubmit={handleCommentSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Add a comment..."
                        className="field-shell flex-1 px-3 py-3 text-xs"
                      />
                      <button
                        type="submit"
                        disabled={!commentBody.trim() || addCommentMutation.isPending}
                        className="action-button action-button--accent shrink-0"
                      >
                        {addCommentMutation.isPending ? "Sending" : "Send"}
                      </button>
                    </form>
                  </SectionCard>
                </div>

                <div className="space-y-5">
                  <SectionCard title="Overview">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                      <MetaItem label="Ref" value={card?.ref ?? card?.id ?? "-"} />

                      <div>
                        <div className="meta-label mb-2">Status</div>
                        <select
                          value={currentStatusId ?? ""}
                          onChange={handleStatusChange}
                          className="field-shell w-full cursor-pointer px-3 py-3 text-xs"
                        >
                          {statusOptions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <MetaItem label="Agent" value={card?.agentId ?? "Unassigned"} />
                      <MetaItem label="Created" value={card ? formatTimestamp(card.createdAt) : "-"} />
                      <MetaItem label="Updated" value={card ? formatTimestamp(card.updatedAt) : "-"} />
                    </div>
                  </SectionCard>

                  {card?.branchName && (
                    <SectionCard title="Branch">
                      <div className="mb-3 rounded-[18px] border border-[var(--accent-border)] bg-[var(--accent-surface)] px-4 py-3">
                        <p className="text-[13px] font-semibold text-[var(--accent-strong)]">{card.branchName}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setShowDiff(true)}
                          className="action-button action-button--muted"
                        >
                          View Diff
                        </button>
                        {isReadyToMerge && (
                          <button
                            type="button"
                            onClick={() => {
                              setMergeError(null);
                              mergeMutation.mutate();
                            }}
                            disabled={mergeMutation.isPending}
                            className="action-button action-button--success"
                          >
                            {mergeMutation.isPending ? "Merging" : "Merge"}
                          </button>
                        )}
                      </div>
                      {mergeError && <p className="mt-3 text-[11px] font-mono text-[var(--danger)]">{mergeError}</p>}
                    </SectionCard>
                  )}

                  {card?.conflictedAt && (
                    <SectionCard title="Conflict State">
                      <div
                        className="rounded-[18px] border bg-[var(--warning-soft)] px-4 py-4"
                        style={{ borderColor: "rgba(245, 158, 11, 0.4)" }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="meta-label" style={{ color: "var(--warning)" }}>
                            Merge Conflict
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-faint)]">
                            {formatTimestamp(card.conflictedAt)}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                          This card has recorded conflict details and needs review before merging.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setShowConflicts(true)}
                            className="action-button action-button--warning"
                          >
                            View Conflicts
                          </button>
                          <button
                            type="button"
                            onClick={() => recheckConflictMutation.mutate()}
                            disabled={recheckConflictMutation.isPending}
                            className="action-button action-button--success"
                          >
                            {recheckConflictMutation.isPending ? "Checking" : "Re-check"}
                          </button>
                          <button
                            type="button"
                            onClick={() => clearConflictMutation.mutate()}
                            disabled={clearConflictMutation.isPending}
                            className="action-button action-button--ghost"
                          >
                            {clearConflictMutation.isPending ? "Clearing" : "Clear"}
                          </button>
                        </div>
                      </div>
                    </SectionCard>
                  )}

                  <SectionCard title="Danger Zone">
                    {!showDeleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="action-button action-button--danger"
                      >
                        Delete Card
                      </button>
                    ) : (
                      <div
                        className="rounded-[18px] border bg-[var(--danger-soft)] px-4 py-4"
                        style={{ borderColor: "rgba(248, 113, 113, 0.35)" }}
                      >
                        <p className="text-sm text-[var(--text-primary)]">Delete this card permanently?</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(false)}
                            className="action-button action-button--ghost"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCardMutation.mutate()}
                            disabled={deleteCardMutation.isPending}
                            className="action-button action-button--danger"
                          >
                            {deleteCardMutation.isPending ? "Deleting" : "Confirm Delete"}
                          </button>
                        </div>
                      </div>
                    )}
                  </SectionCard>
                </div>
              </div>
            )}
          </div>
        </div>
      </ModalOverlay>

      {showDiff && card?.branchName && card?.repoId && (
        <DiffModal
          cardId={card.id}
          cardTitle={card.title}
          branchName={card.branchName}
          repoId={card.repoId}
          availableBranches={repoBranches}
          onClose={() => setShowDiff(false)}
        />
      )}

      {showConflicts && card?.conflictedAt && <ConflictDetailsModal card={card} onClose={() => setShowConflicts(false)} />}
    </>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-panel px-4 py-4">
      <div className="meta-label mb-3">{title}</div>
      {children}
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--panel-ink)] px-4 py-3">
      <div className="meta-label mb-2">{label}</div>
      <div className="text-sm text-[var(--text-secondary)] break-words">{value}</div>
    </div>
  );
}

function WorkflowField({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-400/30 bg-red-400/10"
      : tone === "success"
        ? "border-emerald-400/30 bg-emerald-400/10"
        : "border-[var(--border-soft)] bg-[var(--panel-ink)]";

  return (
    <div className={`rounded-[18px] border px-4 py-3 ${toneClass}`}>
      <div className="meta-label mb-2">{label}</div>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">{value}</p>
    </div>
  );
}
