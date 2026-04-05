import { useBoardStore } from "../store";
import type { InputRequest } from "../api/types";
import { ChatWidget } from "./ChatWidget";
import { DailySummaryBar } from "./DailySummaryBar";
import { InputNotificationBanner } from "./InputNotificationBanner";
import { NotificationPrompt } from "./NotificationPrompt";

interface WorkbenchSidebarProps {
  requests: InputRequest[];
}

export function WorkbenchSidebar({ requests }: WorkbenchSidebarProps) {
  const wsStatus = useBoardStore((s) => s.wsStatus);
  const selectedEpicId = useBoardStore((s) => s.selectedEpicId);

  const networkLabel =
    wsStatus === "connected"
      ? "Live"
      : wsStatus === "connecting"
        ? "Connecting"
        : "Offline";

  return (
    <aside className="workbench-rail">
      <section className="surface-panel surface-panel--soft workbench-rail__hero">
        <div className="meta-label mb-2">Workbench</div>
        <h2 className="text-[1rem] font-semibold text-[var(--text-primary)]">
          Coordination stack
        </h2>
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
          Keep approvals, daily momentum, and agent conversations visible without pulling focus
          from the board.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <SignalPill
            label="Network"
            value={networkLabel}
            tone={
              wsStatus === "connected"
                ? "success"
                : wsStatus === "connecting"
                  ? "warning"
                  : "danger"
            }
          />
          <SignalPill
            label="Input"
            value={requests.length === 0 ? "Clear" : `${requests.length} waiting`}
            tone={requests.length === 0 ? "neutral" : "warning"}
          />
          <SignalPill
            label="Mode"
            value={selectedEpicId ? "Epic board" : "Epic picker"}
            tone="neutral"
          />
        </div>
      </section>

      <div className="workbench-rail__stack">
        <InputNotificationBanner requests={requests} embedded />
        <NotificationPrompt embedded />
        <DailySummaryBar embedded />
        <ChatWidget embedded />
      </div>
    </aside>
  );
}

function SignalPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <div className={`workbench-signal workbench-signal--${tone}`}>
      <div className="workbench-signal__label">{label}</div>
      <div className="workbench-signal__value">{value}</div>
    </div>
  );
}
