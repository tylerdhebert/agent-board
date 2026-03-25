import { useBoardStore } from "../store";
import { useShortcutHint } from "../hooks/useShortcutHint";
import { ShortcutBadge } from "./ShortcutBadge";

export function Header() {
  const wsStatus = useBoardStore((s) => s.wsStatus);
  const pendingInputRequests = useBoardStore((s) => s.pendingInputRequests);
  const setAdminPanelOpen = useBoardStore((s) => s.setAdminPanelOpen);
  const adminHint = useShortcutHint("toggle-admin");

  const statusColor =
    wsStatus === "connected"
      ? "#22c55e"
      : wsStatus === "connecting"
      ? "#f59e0b"
      : "#ef4444";

  const statusLabel =
    wsStatus === "connected"
      ? "LIVE"
      : wsStatus === "connecting"
      ? "CONNECTING"
      : "OFFLINE";

  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e1e2a] bg-[#0a0a0f] shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[#e2e8f0] font-mono font-bold text-base tracking-tight">
          agent-board
        </span>
        <span className="text-[#2a2a38] font-mono">|</span>
        <span className="text-[12px] font-mono text-[#475569]">
          task monitor
        </span>
      </div>

      <div className="flex items-center gap-4">
        {pendingInputRequests.size > 0 && (
          <span className="text-[12px] font-mono text-red-400 animate-pulse">
            {pendingInputRequests.size} input{pendingInputRequests.size > 1 ? "s" : ""} pending
          </span>
        )}
        <button
          onClick={() => setAdminPanelOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-mono text-[#475569] hover:text-[#94a3b8] border border-[#2a2a38] hover:border-[#3a3a4a] rounded-sm transition-colors"
        >
          <span>⚙</span>
          <span>Admin</span>
          <ShortcutBadge shortcut={adminHint} />
        </button>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          <span
            className="text-[12px] font-mono uppercase tracking-wider"
            style={{ color: statusColor }}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </header>
  );
}
