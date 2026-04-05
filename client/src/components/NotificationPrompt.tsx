import { useState } from "react";

export function NotificationPrompt({ embedded = false }: { embedded?: boolean }) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "granted"
  );
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || permission !== "default") return null;

  const handleEnable = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  if (embedded) {
    return (
      <section className="surface-panel surface-panel--soft overflow-hidden">
        <div className="border-b border-[var(--border-soft)] px-4 py-3">
          <div className="meta-label mb-1.5">Attention Layer</div>
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">
            Enable desktop notifications
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
            Stay alerted when an agent needs a decision, even if this tab drifts into the
            background.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-4">
          <button
            onClick={handleEnable}
            className="action-button action-button--accent !px-4 !py-2 !text-[0.6rem]"
          >
            Enable
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="action-button action-button--ghost !px-4 !py-2 !text-[0.6rem]"
          >
            Not now
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-full max-w-sm rounded-[24px] border border-[var(--border)] bg-[var(--panel-raised)] p-5 shadow-[0_26px_60px_rgba(0,0,0,0.18)]">
      <div className="section-kicker mb-3">
        <span className="section-kicker__dot" />
        Attention Layer
      </div>
      <div className="flex items-start gap-4">
        <div className="brand-mark !h-11 !w-11 !rounded-[16px]">
          <span className="brand-mark__glyph">AL</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            Enable notifications
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
            Stay alerted when an agent needs a decision, even if this tab drifts into the
            background.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleEnable}
              className="chrome-button !border-[var(--accent)] !bg-[var(--accent)] !px-4 !py-2 !normal-case !tracking-normal !text-white"
            >
              Enable
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="chrome-button !px-4 !py-2 !normal-case !tracking-normal"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
