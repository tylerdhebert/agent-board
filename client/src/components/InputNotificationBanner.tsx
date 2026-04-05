import { useBoardStore } from "../store";
import type { InputRequest } from "../api/types";
import { useCountdown } from "../hooks/useCountdown";

interface Props {
  requests: InputRequest[];
  embedded?: boolean;
}

export function InputNotificationBanner({ requests, embedded = false }: Props) {
  if (embedded) {
    return (
      <section className="surface-panel surface-panel--soft overflow-hidden">
        <div className="border-b border-[var(--border-soft)] px-4 py-3">
          <div className="meta-label mb-1.5">Input Queue</div>
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">
            {requests.length === 0 ? "No pending decisions" : `${requests.length} human handoff${requests.length === 1 ? "" : "s"}`}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
            Questions from agents that need a decision before work can continue.
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="px-4 py-5 text-[11px] font-mono text-[var(--text-dim)]">
            Nothing is waiting for input right now.
          </div>
        ) : (
          <div className="space-y-2.5 p-2.5">
            {requests.map((req) => (
              <InputNotification key={req.id} request={req} compact />
            ))}
          </div>
        )}
      </section>
    );
  }

  if (requests.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex max-w-sm flex-col gap-3">
      {requests.map((req) => (
        <InputNotification key={req.id} request={req} />
      ))}
    </div>
  );
}

function InputNotification({ request, compact = false }: { request: InputRequest; compact?: boolean }) {
  const setOpenModal = useBoardStore((s) => s.setOpenModal);
  const setActiveInputRequestId = useBoardStore((s) => s.setActiveInputRequestId);
  const secondsRemaining = useCountdown(request.requestedAt, request.timeoutSecs);

  const handleClick = () => {
    setActiveInputRequestId(request.id);
    setOpenModal("input");
  };

  const urgencyClass =
    secondsRemaining < 60
      ? "border-red-400/40 bg-red-500/12"
      : secondsRemaining < 300
      ? "border-amber-400/40 bg-amber-500/12"
      : "border-[var(--danger-soft)] bg-[var(--panel-raised)]";

  return (
    <button
      onClick={handleClick}
      className={`w-full border text-left transition-all hover:-translate-y-0.5 hover:bg-[var(--panel-hover)] ${
        compact
          ? "rounded-[18px] p-3.5"
          : "rounded-[24px] p-4 shadow-[0_24px_50px_rgba(0,0,0,0.18)]"
      } ${urgencyClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="section-kicker !mb-0">
          <span className="section-kicker__dot" />
          Input Needed
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
          {formatTime(secondsRemaining)}
        </span>
      </div>

      <p className={`mt-3 ${compact ? "text-[13px]" : "text-[14px]"} font-semibold leading-snug text-[var(--text-primary)]`}>
        {request.questions[0]?.prompt ?? "Agent is waiting for input"}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--panel)] px-2.5 py-1">
          card {request.cardId}
        </span>
        {request.questions.length > 1 && (
          <span className="rounded-full border border-[var(--border-soft)] bg-[var(--panel)] px-2.5 py-1">
            +{request.questions.length - 1} more
          </span>
        )}
      </div>
    </button>
  );
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
