import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import { api } from "../api/client";
import type { InputRequest, Question } from "../api/types";
import { useCountdown } from "../hooks/useCountdown";
import { ModalOverlay } from "./ui/ModalOverlay";

interface Props {
  request: InputRequest;
}

export function InputModal({ request }: Props) {
  const queryClient = useQueryClient();
  const setOpenModal = useBoardStore((s) => s.setOpenModal);
  const setActiveInputRequestId = useBoardStore((s) => s.setActiveInputRequestId);
  const removePendingInputRequest = useBoardStore((s) => s.removePendingInputRequest);
  const removePulsingCard = useBoardStore((s) => s.removePulsingCard);

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const q of request.questions) {
      if (q.default !== undefined) defaults[q.id] = q.default;
    }
    return defaults;
  });

  const secondsRemaining = useCountdown(request.requestedAt, request.timeoutSecs);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (api.api.input({ id: request.id }) as any).answer.post({ answers });
      if (error) throw new Error("Failed to submit answers");
      return data;
    },
    onSuccess: () => {
      removePendingInputRequest(request.id);
      removePulsingCard(request.cardId);
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["input", "pending"] });
      handleClose();
    },
  });

  const handleClose = useCallback(() => {
    setOpenModal(null);
    setActiveInputRequestId(null);
  }, [setOpenModal, setActiveInputRequestId]);

  useEscapeToClose(handleClose);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const unanswered = request.questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) return;
    submitMutation.mutate();
  }

  const allAnswered = request.questions.every((q) => answers[q.id] !== undefined && answers[q.id] !== "");
  const progressPct = Math.max(0, (secondsRemaining / request.timeoutSecs) * 100);
  const timedOut = secondsRemaining === 0;
  const timerColor =
    progressPct > 50 ? "var(--success)" : progressPct > 20 ? "var(--warning)" : "var(--danger)";

  return (
    <ModalOverlay
      onClose={handleClose}
      className="flex max-h-[min(92vh,60rem)] max-w-3xl flex-col overflow-hidden"
    >
      <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px]">
        <div className="h-1.5 bg-[var(--panel-ink)]">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{ width: `${progressPct}%`, backgroundColor: timerColor }}
          />
        </div>

        <div className="border-b border-[var(--border-soft)] px-5 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="section-kicker mb-3">
                <span className="section-kicker__dot" />
                Human Decision Required
              </div>
              <h2 className="display-title text-3xl leading-none">Agent Input</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                The agent is paused on card <span className="text-[var(--text-primary)]">{request.cardId}</span> and needs a human answer to keep moving.
              </p>
            </div>

            <div className="surface-panel surface-panel--soft min-w-[180px] px-4 py-3 text-right">
              <div className="meta-label mb-2">Time Remaining</div>
              <div className="text-2xl font-semibold" style={{ color: timerColor }}>
                {formatTime(secondsRemaining)}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.26em] text-[var(--text-faint)]">
                response window
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-5 p-5">
          {timedOut ? (
            <div className="surface-panel px-5 py-8 text-center">
              <div className="meta-label mb-3">Request Closed</div>
              <p className="text-base text-[var(--danger)]">This input request timed out.</p>
              <button
                type="button"
                onClick={handleClose}
                className="action-button action-button--ghost mt-4"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="grid min-h-0 gap-4 overflow-y-auto pr-1">
                {request.questions.map((question, idx) => (
                  <QuestionField
                    key={question.id}
                    question={question}
                    index={idx + 1}
                    value={answers[question.id] ?? ""}
                    onChange={(val) => setAnswers((prev) => ({ ...prev, [question.id]: val }))}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="action-button action-button--ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!allAnswered || submitMutation.isPending}
                  className="action-button action-button--accent"
                >
                  {submitMutation.isPending ? "Submitting" : "Submit Answers"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </ModalOverlay>
  );
}

interface QuestionFieldProps {
  question: Question;
  index: number;
  value: string;
  onChange: (val: string) => void;
}

function QuestionField({ question, index, value, onChange }: QuestionFieldProps) {
  return (
    <div className="surface-panel px-4 py-4">
      <label className="block">
        <span className="meta-label">Question {index}</span>
        <div className="mt-2 text-sm text-[var(--text-primary)]">{question.prompt}</div>
      </label>

      {question.type === "yesno" && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {["yes", "no"].map((opt) => {
            const active = value === opt;
            const yes = opt === "yes";
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`rounded-[18px] border px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.2em] transition-colors ${
                  active
                    ? yes
                      ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
                      : "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
                    : "border-[var(--border)] bg-[var(--panel-ink)] text-[var(--text-muted)] hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === "text" && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.default ?? "Enter your answer..."}
          className="field-shell mt-4 px-3 py-3 text-xs"
        />
      )}

      {question.type === "choice" && question.options && (
        <div className="mt-4 flex flex-wrap gap-2">
          {question.options.map((opt) => {
            const active = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`rounded-full border px-3 py-2 font-mono text-xs transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-surface)] text-[var(--accent-strong)]"
                    : "border-[var(--border)] bg-[var(--panel-ink)] text-[var(--text-muted)] hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
