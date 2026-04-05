/**
 * Shared Tailwind class helpers for admin section components.
 */

export function inputCls(invalid = false, width = "w-full"): string {
  return `${width} rounded-[16px] border px-3 py-2.5 font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-faint)] bg-[var(--panel-ink)] focus:outline-none transition-colors ${
    invalid
      ? "border-[var(--danger)] focus:border-[var(--danger)]"
      : "border-[var(--border)] focus:border-[var(--accent)]"
  }`;
}

export const selectCls =
  "w-full rounded-[16px] border border-[var(--border)] bg-[var(--panel-ink)] px-3 py-2.5 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer";

export const sectionHeadingCls =
  "text-[11px] font-mono text-[var(--text-faint)] uppercase tracking-[0.28em] mb-3";

export const emptyStateCls =
  "text-[11px] font-mono text-[var(--text-dim)]";

export const cancelBtnCls =
  "text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors";

export const confirmDeleteBtnCls =
  "px-2.5 py-1 rounded-full border border-[var(--danger-soft)] bg-[var(--danger-soft)] text-[var(--danger)] hover:text-[var(--text-primary)] font-mono text-[11px] transition-colors";

export const primaryBtnCls =
  "px-4 py-2.5 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:bg-[var(--panel-soft)] disabled:text-[var(--text-faint)] text-white font-mono text-xs transition-colors";

export const adminListItemCls =
  "surface-panel surface-panel--soft rounded-[18px] px-3.5 py-3 flex items-start gap-3";

export const adminEditShellCls =
  "surface-panel surface-panel--raised rounded-[18px] px-3.5 py-3.5 space-y-2";

export const adminItemTitleCls =
  "text-[12px] font-mono text-[var(--text-primary)]";

export const adminItemMetaCls =
  "mt-0.5 text-[11px] font-mono text-[var(--text-muted)]";

export const adminItemSubtleCls =
  "mt-0.5 text-[10px] font-mono text-[var(--text-dim)]";

export const adminActionLinkCls =
  "text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors";

export function adminTagCls(active = false): string {
  return `inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-mono ${
    active
      ? "border-[var(--accent-border)] bg-[var(--accent-surface)] text-[var(--accent-strong)]"
      : "border-[var(--border-soft)] bg-[var(--panel-ink)] text-[var(--text-faint)]"
  }`;
}
