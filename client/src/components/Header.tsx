import { useEffect, useRef, useState } from "react";
import { useBoardStore, type AppTheme } from "../store";
import { useShortcutHint } from "../hooks/useShortcutHint";
import { ShortcutBadge } from "./ShortcutBadge";

const themeOrder: AppTheme[] = ["default", "night", "light", "summer", "winter", "grass", "wildflower", "wa"];

const themeLabels: Record<AppTheme, string> = {
  default: "Choco",
  night: "Night",
  light: "Light",
  summer: "Summer",
  winter: "Winter",
  grass: "Grass",
  wildflower: "Wildflower",
  wa: "W.A.",
};

export function Header() {
  const wsStatus = useBoardStore((s) => s.wsStatus);
  const pendingInputRequests = useBoardStore((s) => s.pendingInputRequests);
  const setAdminPanelOpen = useBoardStore((s) => s.setAdminPanelOpen);
  const theme = useBoardStore((s) => s.theme);
  const setTheme = useBoardStore((s) => s.setTheme);
  const adminHint = useShortcutHint("toggle-admin");
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!themeOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [themeOpen]);

  const statusColor =
    wsStatus === "connected"
      ? "var(--success)"
      : wsStatus === "connecting"
        ? "var(--warning)"
        : "var(--danger)";

  const statusLabel =
    wsStatus === "connected"
      ? "Live"
      : wsStatus === "connecting"
        ? "Connecting"
        : "Offline";

  return (
    <header className="app-header shrink-0">
      <div className="flex flex-col gap-2 px-3 py-2.5 md:flex-row md:items-center md:justify-between md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="brand-mark brand-mark--compact">
            <span className="brand-mark__glyph">AB</span>
          </div>

          <div className="min-w-0">
            <div className="header-note header-note--caps mb-1">Coordination Workbench</div>
            <div className="header-subline min-w-0">
              <h1 className="display-title text-[1.22rem] leading-none md:text-[1.42rem]">agent-board</h1>
              <span className="header-note">cards, blockers, queues, branches</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="header-status-row">
            <div className="header-status-chip">
              <span
                className="header-status-chip__dot"
                style={{ color: statusColor, backgroundColor: statusColor }}
              />
              <div>
                <div className="header-status-chip__label">Network</div>
                <div className="header-status-chip__value" style={{ color: statusColor }}>
                  {statusLabel}
                </div>
              </div>
            </div>

            <div className="header-status-chip">
              <span
                className={`header-status-chip__dot ${pendingInputRequests.size > 0 ? "animate-pulse" : ""}`}
                style={{
                  color: pendingInputRequests.size > 0 ? "var(--danger)" : "var(--accent)",
                  backgroundColor: pendingInputRequests.size > 0 ? "var(--danger)" : "var(--accent)",
                }}
              />
              <div>
                <div className="header-status-chip__label">Input</div>
                <div className="header-status-chip__value">{pendingInputRequests.size} pending</div>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <div ref={themeRef} className="theme-flyout">
              <button
                type="button"
                onClick={() => setThemeOpen((open) => !open)}
                className="theme-flyout__trigger"
                aria-label="Change theme"
                aria-expanded={themeOpen}
              >
                <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 3c-4.97 0-9 3.58-9 8 0 2.18.98 4.16 2.58 5.6.49.44.77 1.08.77 1.73V19a2 2 0 0 0 2 2h1.45c.49 0 .95-.22 1.26-.59l1.13-1.35c.31-.37.77-.59 1.26-.59H16a5 5 0 0 0 5-5c0-5.25-4.03-9.47-9-9.47Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="8.5" cy="10.5" r="1" fill="currentColor" />
                  <circle cx="12.5" cy="8.5" r="1" fill="currentColor" />
                  <circle cx="16" cy="11.5" r="1" fill="currentColor" />
                </svg>
              </button>

              {themeOpen && (
                <div className="theme-flyout__panel">
                  <div className="theme-flyout__header">Theme</div>
                  <div className="theme-flyout__list">
                    {themeOrder.map((option) => (
                      <button
                        key={option}
                        type="button"
                        data-active={theme === option}
                        className="theme-flyout__option"
                        onClick={() => {
                          setTheme(option);
                          setThemeOpen(false);
                        }}
                      >
                        <span className={`theme-switcher__swatch theme-switcher__swatch--${option}`} />
                        <span>{themeLabels[option]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setAdminPanelOpen(true)}
              className="chrome-button chrome-button--compact"
            >
              <svg className="h-[13px] w-[13px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19.4 13.5a7.9 7.9 0 0 0 .05-1.5l2-1.55-2-3.45-2.45.7a8.4 8.4 0 0 0-1.3-.75L15.35 4h-4.7l-.35 2.95c-.46.2-.89.45-1.3.75l-2.45-.7-2 3.45 2 1.55a7.9 7.9 0 0 0 0 1.5l-2 1.55 2 3.45 2.45-.7c.4.3.84.55 1.3.75L10.65 20h4.7l.35-2.95c.46-.2.9-.45 1.3-.75l2.45.7 2-3.45-2.05-1.55Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Admin</span>
              <ShortcutBadge shortcut={adminHint} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
