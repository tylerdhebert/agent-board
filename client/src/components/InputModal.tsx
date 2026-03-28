import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import { useEscapeToClose } from "../hooks/useEscapeStack";
import { api } from "../api/client";
import type { InputRequest, Question } from "../api/types";
import { useCountdown } from "../hooks/useCountdown";

interface Props {
  request: InputRequest;
}

export function InputModal({ request }: Props) {
  const queryClient = useQueryClient();
  const setOpenModal = useBoardStore((s) => s.setOpenModal);
  const setActiveInputRequestId = useBoardStore(
    (s) => s.setActiveInputRequestId
  );
  const removePendingInputRequest = useBoardStore(
    (s) => s.removePendingInputRequest
  );
  const removePulsingCard = useBoardStore((s) => s.removePulsingCard);

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const q of request.questions) {
      if (q.default !== undefined) defaults[q.id] = q.default;
    }
    return defaults;
  });

  const secondsRemaining = useCountdown(
    request.requestedAt,
    request.timeoutSecs
  );

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate all questions answered
    const unanswered = request.questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) return;
    submitMutation.mutate();
  };

  const allAnswered = request.questions.every((q) => answers[q.id] !== undefined && answers[q.id] !== "");

  const progressPct = (secondsRemaining / request.timeoutSecs) * 100;
  const timedOut = secondsRemaining === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-[#111118] border border-[#ef4444]/40 rounded-sm shadow-2xl flex flex-col"
        style={{ borderTop: "3px solid #ef4444" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Countdown bar */}
        <div className="h-1 bg-[#1a1a24] overflow-hidden">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${progressPct}%`,
              backgroundColor: progressPct > 50 ? "#22c55e" : progressPct > 20 ? "#f59e0b" : "#ef4444",
            }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2a]">
          <div>
            <h2 className="text-sm font-mono font-bold text-[#ef4444] uppercase tracking-wider">
              Agent Input Required
            </h2>
            <p className="text-[10px] font-mono text-[#475569] mt-0.5">
              card: <span className="text-[#94a3b8]">{request.cardId}</span>
            </p>
          </div>
          <div className="text-right">
            <span
              className={`text-sm font-mono font-bold ${
                secondsRemaining < 60
                  ? "text-red-400"
                  : secondsRemaining < 300
                  ? "text-amber-400"
                  : "text-[#94a3b8]"
              }`}
            >
              {formatTime(secondsRemaining)}
            </span>
            <p className="text-[10px] font-mono text-[#475569]">remaining</p>
          </div>
        </div>

        {/* Questions */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {timedOut ? (
            <div className="text-center py-6">
              <p className="text-sm font-mono text-red-400">Request timed out.</p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-3 text-xs font-mono text-[#475569] hover:text-[#94a3b8] transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {request.questions.map((question, idx) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  index={idx + 1}
                  value={answers[question.id] ?? ""}
                  onChange={(val) =>
                    setAnswers((prev) => ({ ...prev, [question.id]: val }))
                  }
                />
              ))}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2 border border-[#2a2a38] hover:border-[#3a3a4a] text-[#64748b] hover:text-[#94a3b8] font-mono text-xs rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!allAnswered || submitMutation.isPending}
                  className="flex-1 py-2 bg-[#ef4444] hover:bg-[#f87171] disabled:bg-[#1e1e2a] disabled:text-[#475569] text-white font-mono text-xs font-bold rounded-sm transition-colors"
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit Answers"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
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
    <div className="space-y-1.5">
      <label className="block text-xs font-mono text-[#e2e8f0]">
        <span className="text-[#475569] mr-2">{index}.</span>
        {question.prompt}
      </label>

      {question.type === "yesno" && (
        <div className="flex gap-2">
          {["yes", "no"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex-1 py-2 font-mono text-xs font-bold uppercase rounded-sm border transition-colors ${
                value === opt
                  ? opt === "yes"
                    ? "bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e]"
                    : "bg-[#ef4444]/20 border-[#ef4444] text-[#ef4444]"
                  : "border-[#2a2a38] text-[#64748b] hover:border-[#3a3a4a] hover:text-[#94a3b8]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {question.type === "text" && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.default ?? "Enter your answer..."}
          className="w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none focus:border-[#6366f1] transition-colors"
        />
      )}

      {question.type === "choice" && question.options && (
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-1.5 font-mono text-xs rounded-sm border transition-colors ${
                value === opt
                  ? "bg-[#6366f1]/20 border-[#6366f1] text-[#818cf8]"
                  : "border-[#2a2a38] text-[#64748b] hover:border-[#3a3a4a] hover:text-[#94a3b8]"
              }`}
            >
              {opt}
            </button>
          ))}
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
