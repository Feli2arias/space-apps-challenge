/**
 * A small limiter so one visitor cannot flood the open data services through
 * this API. It counts requests per client inside a sliding window.
 *
 * The counts live in the memory of one server process. On a serverless host
 * each instance counts on its own, so this is a courtesy limit, not a wall.
 */

export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Seconds until another request will be accepted. Zero when allowed. */
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  check(clientId: string, now: Date): RateLimitDecision;
}

const MAX_TRACKED_CLIENTS = 5_000;

export function createRateLimiter(maxRequests: number, windowSeconds: number): RateLimiter {
  const windowMs = windowSeconds * 1000;
  const hits = new Map<string, readonly number[]>();

  return {
    check(clientId, now) {
      const time = now.getTime();
      const recent = (hits.get(clientId) ?? []).filter((hit) => time - hit < windowMs);

      if (recent.length >= maxRequests) {
        hits.set(clientId, recent);
        const retryAfterMs = windowMs - (time - recent[0]);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
      }

      // Forget the oldest client when the table is full, so memory stays bounded.
      if (!hits.has(clientId) && hits.size >= MAX_TRACKED_CLIENTS) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      hits.set(clientId, [...recent, time]);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

/** Best available identifier of the caller: the first address a proxy reports. */
export function clientIdFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}
