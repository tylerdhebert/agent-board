interface ShortcutBadgeProps {
  shortcut: string | null;
}

export function ShortcutBadge({ shortcut }: ShortcutBadgeProps) {
  if (!shortcut) return null;
  return (
    <kbd className="ml-1 rounded-full border border-[var(--accent-border)] bg-[var(--accent-surface)] px-2 py-0.5 text-[9px] font-mono leading-none text-[var(--accent-strong)] pointer-events-none">
      {shortcut}
    </kbd>
  );
}
