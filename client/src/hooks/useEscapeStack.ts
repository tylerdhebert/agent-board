import { useEffect } from "react";

// Module-level stack of close callbacks
const stack: (() => void)[] = [];

export const escapeStack = {
  push: (fn: () => void) => stack.push(fn),
  pop: (fn: () => void) => {
    const idx = stack.lastIndexOf(fn);
    if (idx !== -1) stack.splice(idx, 1);
  },
  trigger: () => {
    if (stack.length > 0) stack[stack.length - 1]();
  },
};

// Hook: registers onClose when mounted, unregisters when unmounted
export function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    escapeStack.push(onClose);
    return () => escapeStack.pop(onClose);
  }, [onClose]);
}
