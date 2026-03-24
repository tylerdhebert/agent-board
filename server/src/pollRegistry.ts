/**
 * pollRegistry — manages in-flight long-poll promises for input requests.
 *
 * When an agent POSTs to /api/input, the server parks a Promise here and
 * awaits it. When the user submits answers via /api/input/:id/answer, the
 * server calls resolve(answers). On timeout the server calls reject('timed_out').
 */

interface PollEntry {
  resolve: (answers: Record<string, string>) => void;
  reject: (reason: string) => void;
  timer: ReturnType<typeof setTimeout>;
}

const registry = new Map<string, PollEntry>();

export const pollRegistry = {
  /**
   * Register a new pending input request.
   * Returns a Promise that resolves when the user answers or rejects on timeout.
   */
  register(
    requestId: string,
    timeoutSecs: number,
    onTimeout: () => void
  ): Promise<Record<string, string>> {
    return new Promise<Record<string, string>>((resolve, reject) => {
      const timer = setTimeout(() => {
        registry.delete(requestId);
        onTimeout();
        reject("timed_out");
      }, timeoutSecs * 1000);

      registry.set(requestId, { resolve, reject, timer });
    });
  },

  /**
   * Resolve a pending request with user answers.
   * Returns true if the request was found, false if it had already been resolved/timed out.
   */
  answer(requestId: string, answers: Record<string, string>): boolean {
    const entry = registry.get(requestId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    registry.delete(requestId);
    entry.resolve(answers);
    return true;
  },

  /**
   * Force-timeout a pending request (e.g. on server shutdown).
   */
  timeout(requestId: string): boolean {
    const entry = registry.get(requestId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    registry.delete(requestId);
    entry.reject("timed_out");
    return true;
  },

  has(requestId: string): boolean {
    return registry.has(requestId);
  },

  get size() {
    return registry.size;
  },
};
