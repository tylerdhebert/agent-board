const TYPE_STYLES = {
  story: { label: "STORY", color: "#6366f1" },
  bug: { label: "BUG", color: "#ef4444" },
  task: { label: "TASK", color: "#64748b" },
};

interface Props {
  type: "story" | "bug" | "task";
}

export function TypeBadge({ type }: Props) {
  const { label, color } = TYPE_STYLES[type];
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider"
      style={{
        backgroundColor: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {label}
    </span>
  );
}
