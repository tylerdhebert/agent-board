/**
 * Shared Tailwind class helpers for admin section components.
 * Centralises the repeated class combinations so individual sections
 * stay DRY and the design stays consistent.
 */

/** Monospace text input, with optional invalid (red-border) state and width override. */
export function inputCls(invalid = false, width = "w-full"): string {
  return `${width} bg-[#0a0a0f] border rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none transition-colors ${
    invalid
      ? "border-[#f87171] focus:border-[#f87171]"
      : "border-[#2a2a38] focus:border-[#6366f1]"
  }`;
}

/** Full-width monospace select. */
export const selectCls =
  "w-full bg-[#0a0a0f] border border-[#2a2a38] rounded-sm px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] transition-colors cursor-pointer";

/** Small section heading label (e.g. "New Status", "Existing Repos (3)"). */
export const sectionHeadingCls =
  "text-[11px] font-mono text-[#475569] uppercase tracking-wider mb-3";

/** Ghost cancel button used next to dangerous confirmation actions. */
export const cancelBtnCls =
  "text-[11px] font-mono text-[#64748b] hover:text-[#94a3b8] transition-colors";

/** Destructive confirm button (red, used for Delete/Confirm actions). */
export const confirmDeleteBtnCls =
  "px-2 py-0.5 bg-[#3b1f1f] border border-[#7f1d1d] hover:bg-[#5c1f1f] text-[#f87171] font-mono text-[11px] rounded-sm transition-colors";

/** Primary action button (indigo). Disabled state included via CSS. */
export const primaryBtnCls =
  "px-4 py-2 bg-[#6366f1] hover:bg-[#818cf8] disabled:bg-[#1e1e2a] disabled:text-[#475569] text-white font-mono text-xs rounded-sm transition-colors";
