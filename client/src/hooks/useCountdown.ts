import { useState, useEffect } from "react";

/**
 * Returns the number of seconds remaining from `startedAt` + `totalSecs`.
 * Updates every second. Returns 0 when expired.
 */
export function useCountdown(requestedAt: string, totalSecs: number): number {
  const expiresAt = new Date(requestedAt).getTime() + totalSecs * 1000;

  const calc = () => {
    const remaining = Math.max(
      0,
      Math.floor((expiresAt - Date.now()) / 1000)
    );
    return remaining;
  };

  const [remaining, setRemaining] = useState(calc);

  useEffect(() => {
    const tick = () => setRemaining(calc());
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return remaining;
}
