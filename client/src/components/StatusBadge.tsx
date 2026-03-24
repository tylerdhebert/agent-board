import type { Status } from "../api/types";

interface Props {
  status: Status;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: Props) {
  const px = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded font-mono font-medium uppercase tracking-wider ${px}`}
      style={{
        backgroundColor: `${status.color}22`,
        color: status.color,
        border: `1px solid ${status.color}44`,
      }}
    >
      {status.name}
    </span>
  );
}
