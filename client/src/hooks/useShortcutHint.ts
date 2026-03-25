import { useQueryClient } from "@tanstack/react-query";
import { useBoardStore } from "../store";
import type { KeyboardShortcut } from "../api/types";

export function useShortcutHint(actionId: string): string | null {
  const ctrlHeld = useBoardStore((s) => s.ctrlHeld);
  const queryClient = useQueryClient();

  if (!ctrlHeld) return null;

  const shortcuts = queryClient.getQueryData<KeyboardShortcut[]>(["shortcuts"]) ?? [];
  const match = shortcuts.find((s) => s.action === actionId);
  return match?.shortcut ?? null;
}
