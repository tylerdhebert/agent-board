import { useState } from "react";

export function NotificationPrompt() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "granted"
  );
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || permission !== "default") return null;

  const handleEnable = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-full max-w-xs bg-[#1a1a24] border border-[#3a3a4a] rounded-sm shadow-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none shrink-0">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-[#e2e8f0]">
            Enable notifications
          </p>
          <p className="text-xs font-mono text-[#64748b] mt-1 leading-relaxed">
            Get alerted when an agent requests your input, even when this tab is in the background.
          </p>
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleEnable}
              className="px-3 py-1.5 bg-[#6366f1] hover:bg-[#818cf8] text-white font-mono text-xs rounded-sm transition-colors"
            >
              Enable
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-[#64748b] hover:text-[#94a3b8] font-mono text-xs transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
