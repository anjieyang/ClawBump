const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const counters = new Map<string, { count: number; windowStartedAt: number }>();

export function assertRateLimit(key: string) {
  const now = Date.now();
  const current = counters.get(key);

  if (!current || now - current.windowStartedAt > WINDOW_MS) {
    counters.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  if (current.count >= MAX_REQUESTS) {
    throw new Error("Rate limit exceeded.");
  }

  current.count += 1;
  counters.set(key, current);
}

