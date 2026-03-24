import { useBoardStore } from "../store";
import type { InputRequest } from "../api/types";
import { useCountdown } from "../hooks/useCountdown";

interface Props {
  requests: InputRequest[];
}

export function InputNotificationBanner({ requests }: Props) {
  if (requests.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 max-w-xs">
      {requests.map((req) => (
        <InputNotification key={req.id} request={req} />
      ))}
    </div>
  );
}

function InputNotification({ request }: { request: InputRequest }) {
  const setOpenModal = useBoardStore((s) => s.setOpenModal);
  const setActiveInputRequestId = useBoardStore(
    (s) => s.setActiveInputRequestId
  );
  const secondsRemaining = useCountdown(request.requestedAt, request.timeoutSecs);

  const handleClick = () => {
    setActiveInputRequestId(request.id);
    setOpenModal("input");
  };

  const urgency =
    secondsRemaining < 60
      ? "border-red-500 bg-red-950/40"
      : secondsRemaining < 300
      ? "border-amber-500 bg-amber-950/40"
      : "border-[#ef4444]/60 bg-[#1a0a0a]";

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left rounded-sm border px-3 py-2.5 transition-colors hover:brightness-110 shadow-lg ${urgency}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider animate-pulse">
          INPUT NEEDED
        </span>
        <span
          className={`text-[10px] font-mono font-bold ${
            secondsRemaining < 60
              ? "text-red-400"
              : secondsRemaining < 300
              ? "text-amber-400"
              : "text-[#94a3b8]"
          }`}
        >
          {formatTime(secondsRemaining)}
        </span>
      </div>
      <p className="text-[11px] font-mono text-[#e2e8f0] leading-snug truncate">
        {request.questions[0]?.prompt ?? "Agent is waiting for input"}
      </p>
      {request.questions.length > 1 && (
        <p className="text-[10px] font-mono text-[#64748b] mt-0.5">
          +{request.questions.length - 1} more question{request.questions.length > 2 ? "s" : ""}
        </p>
      )}
      <p className="text-[10px] font-mono text-[#475569] mt-1 truncate">
        card: {request.cardId}
      </p>
    </button>
  );
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
