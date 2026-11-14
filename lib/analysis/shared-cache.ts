import type { CacheEntry, CacheStore } from "./cache";

/**
 * A cache layer on a key-value store that every server instance shares.
 *
 * On a serverless host each route can run in its own instance with its own
 * memory and temp folder, so a result saved while analysing a plot would not
 * be found by the routes that describe it afterwards (the reading, the
 * recommendations, the report). This layer puts the entries where all of them
 * can read. Like the other layers it is an optimisation: when the store fails,
 * the entry simply counts as missing.
 */

/** The part of a shared store this layer needs (Vercel's Runtime Cache has this shape). */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, options?: { ttl?: number }): Promise<void>;
}

function isEntry(value: unknown, key: string): value is CacheEntry<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<CacheEntry<unknown>>;
  return (
    entry.key === key &&
    typeof entry.storedAt === "string" &&
    (entry.expiresAt === null || typeof entry.expiresAt === "string") &&
    "value" in entry
  );
}

export class SharedCache implements CacheStore {
  /**
   * The store is asked for on every use: on the host it only exists while a
   * request is being served, not when this module is first loaded.
   */
  constructor(private readonly store: () => KeyValueStore) {}

  async get<TValue>(key: string, now: Date): Promise<CacheEntry<TValue> | null> {
    try {
      const found = await this.store().get(key);
      if (!isEntry(found, key)) return null;
      if (found.expiresAt !== null && new Date(found.expiresAt).getTime() <= now.getTime()) return null;
      return found as CacheEntry<TValue>;
    } catch {
      return null;
    }
  }

  async set<TValue>(key: string, value: TValue, ttlSeconds: number, now: Date): Promise<void> {
    const entry: CacheEntry<TValue> = {
      key,
      storedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      value,
    };
    try {
      await this.store().set(key, entry, { ttl: Math.max(1, Math.round(ttlSeconds)) });
    } catch {
      // Failing to write must not fail the analysis.
    }
  }
}
