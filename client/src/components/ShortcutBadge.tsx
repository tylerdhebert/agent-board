interface ShortcutBadgeProps {
  shortcut: string | null;
}

export function ShortcutBadge({ shortcut }: ShortcutBadgeProps) {
  if (!shortcut) return null;
  return (
    <kbd className="ml-1 px-1 py-0.5 text-[9px] font-mono bg-[#1e1e30] text-[#6366f1] border border-[#3a3a58] rounded leading-none pointer-events-none">
      {shortcut}
    </kbd>
  );
}
