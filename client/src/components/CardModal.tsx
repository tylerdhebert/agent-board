import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import { api } from "../api/client";
import type { CardWithComments, Status, WorkflowStatus } from "../api/types";
import { TypeBadge } from "./TypeBadge";
import { DiffModal } from "./DiffModal";

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
  const [mergeError, setMergeError] = useState<string | null>(null);

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
      const { data } = await api.api.cards({ id: selectedCardId! }).patch({ statusId });
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

  const handleClose = useCallback(() => {
    setOpenModal(null);
    setSelectedCardId(null);
    setSelectedStatusId(null);
    setShowDeleteConfirm(false);
    setShowDiff(false);
    setMergeError(null);
  }, [setOpenModal, setSelectedCardId]);

  useEscapeToClose(handleClose);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatusId = e.target.value;
    setSelectedStatusId(newStatusId);
    updateStatusMutation.mutate(newStatusId);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    addCommentMutation.mutate(commentBody.trim());
  };

  const currentStatusId = selectedStatusId ?? card?.statusId;
  const currentStatus = statuses.find((s) => s.id === currentStatusId);
  const cardStatus = statuses.find((s) => s.id === card?.statusId);
  // Prefer triggersMerge from workflow statuses; fall back to name check
  const isReadyToMerge = workflowStatuses
    ? workflowStatuses.some((ws) => ws.statusId === card?.statusId && ws.triggersMerge)
    : cardStatus?.name.toLowerCase() === "ready to merge";

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-2xl mx-4 bg-[#111118] border border-[#2a2a38] rounded-sm shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        style={currentStatus ? { borderTop: `3px solid ${currentStatus.color}` } : {}}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-[#1e1e2a]">
          <div className="flex-1 min-w-0 pr-4">
            {isLoading ? (
              <div className="h-5 bg-[#1a1a24] rounded animate-pulse w-2/3" />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  {card && <TypeBadge type={card.type} />}
                  <span className="text-[10px] font-mono text-[#475569]">
                    {card?.id}
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-[#e2e8f0] leading-snug">
                  {card?.title}
                </h2>
              </>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-[#475569] hover:text-[#94a3b8] font-mono text-lg leading-none transition-colors shrink-0"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-3 bg-[#1a1a24] rounded animate-pulse" />
              <div className="h-3 bg-[#1a1a24] rounded animate-pulse w-4/5" />
            </div>
          ) : (
            <>
              {/* Meta row */}
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-[#475569] font-mono uppercase tracking-wider block mb-1">
                    Status
                  </span>
                  <select
                    value={currentStatusId ?? ""}
                    onChange={handleStatusChange}
                    className="w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-2 py-1 font-mono text-[11px] text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] cursor-pointer"
                  >
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[#475569] font-mono uppercase tracking-wider block mb-1">
                    Agent
                  </span>
                  <span className="font-mono text-[#94a3b8]">
                    {card?.agentId ?? "—"}
                  </span>
                </div>
                {card?.branchName && (
                  <div className="col-span-2">
                    <span className="text-[#475569] font-mono uppercase tracking-wider block mb-1">
                      Branch
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#818cf8] bg-[#1a1a2e] px-2 py-0.5 rounded-sm border border-[#2a2a4a]">
                        ⎇ {card.branchName}
                      </span>
                      <button
                        onClick={() => setShowDiff(true)}
                        className="px-2 py-0.5 bg-[#1a1a2e] border border-[#2a2a4a] hover:border-[#818cf8] text-[#818cf8] font-mono text-[11px] rounded-sm transition-colors"
                      >
                        View Diff
                      </button>
                      {isReadyToMerge && (
                        <button
                          onClick={() => {
                            setMergeError(null);
                            mergeMutation.mutate();
                          }}
                          disabled={mergeMutation.isPending}
                          className="px-2 py-0.5 bg-[#1a2e1a] border border-[#2a4a2a] hover:border-[#4ade80] disabled:opacity-50 text-[#4ade80] font-mono text-[11px] rounded-sm transition-colors"
                        >
                          {mergeMutation.isPending ? "Merging..." : "Merge"}
                        </button>
                      )}
                    </div>
                    {mergeError && (
                      <p className="mt-1.5 text-[11px] font-mono text-[#f87171] leading-relaxed">
                        {mergeError}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <span className="text-[#475569] font-mono uppercase tracking-wider block mb-1">
                    Created
                  </span>
                  <span className="font-mono text-[#94a3b8]">
                    {card ? formatTimestamp(card.createdAt) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[#475569] font-mono uppercase tracking-wider block mb-1">
                    Updated
                  </span>
                  <span className="font-mono text-[#94a3b8]">
                    {card ? formatTimestamp(card.updatedAt) : "—"}
                  </span>
                </div>
              </div>

              {/* Description */}
              {card?.description && (
                <div>
                  <span className="text-[#475569] font-mono uppercase tracking-wider text-[10px] block mb-1.5">
                    Description
                  </span>
                  <p className="text-[#94a3b8] text-xs leading-relaxed whitespace-pre-wrap">
                    {card.description}
                  </p>
                </div>
              )}

              {/* Comments */}
              <div>
                <span className="text-[#475569] font-mono uppercase tracking-wider text-[10px] block mb-2">
                  Comments ({card?.comments.length ?? 0})
                </span>
                <div className="space-y-2">
                  {card?.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`rounded-sm p-2.5 border-l-2 ${
                        comment.author === "agent"
                          ? "bg-[#0d0d14] border-[#6366f1]"
                          : "bg-[#0d1117] border-[#22c55e]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-mono font-bold uppercase ${
                            comment.author === "agent"
                              ? "text-[#818cf8]"
                              : "text-[#4ade80]"
                          }`}
                        >
                          {comment.author === "agent" ? "AGENT" : "USER"}
                        </span>
                        <span className="text-[10px] font-mono text-[#475569]">
                          {formatTimestamp(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[#cbd5e1] leading-relaxed whitespace-pre-wrap">
                        {comment.body}
                      </p>
                    </div>
                  ))}
                  {card?.comments.length === 0 && (
                    <div className="text-[11px] font-mono text-[#334155] py-2">
                      No comments yet.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Comment input */}
        <div className="p-4 border-t border-[#1e1e2a]">
          <form onSubmit={handleCommentSubmit} className="flex gap-2">
            <input
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none focus:border-[#6366f1] transition-colors"
            />
            <button
              type="submit"
              disabled={!commentBody.trim() || addCommentMutation.isPending}
              className="px-3 py-2 bg-[#6366f1] hover:bg-[#818cf8] disabled:bg-[#1e1e2a] disabled:text-[#475569] text-white font-mono text-xs rounded-sm transition-colors"
            >
              {addCommentMutation.isPending ? "..." : "Send"}
            </button>
          </form>
        </div>

        {/* Delete card section */}
        <div className="px-4 pb-4 border-t border-[#1e1e2a] pt-3">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[11px] font-mono text-[#64748b] hover:text-[#f87171] transition-colors"
            >
              Delete card
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-[#f87171]">
                Are you sure?
              </span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCardMutation.mutate()}
                disabled={deleteCardMutation.isPending}
                className="px-2.5 py-1 bg-[#3b1f1f] border border-[#7f1d1d] hover:bg-[#5c1f1f] disabled:opacity-50 text-[#f87171] font-mono text-[11px] rounded-sm transition-colors"
              >
                {deleteCardMutation.isPending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

    {showDiff && card?.branchName && (
      <DiffModal
        cardId={card.id}
        cardTitle={card.title}
        branchName={card.branchName}
        onClose={() => setShowDiff(false)}
      />
    )}
    </>
  );
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
