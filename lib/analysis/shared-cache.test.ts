import { describe, expect, it } from "vitest";
import { SharedCache, type KeyValueStore } from "./shared-cache";

const KEY = "0123456789abcdef0123";
const NOW = new Date("2026-11-14T12:00:00.000Z");

function memoryStore(): KeyValueStore & { readonly saved: Map<string, unknown>; lastTtl: number | undefined } {
  const saved = new Map<string, unknown>();
  return {
    saved,
    lastTtl: undefined,
    async get(key) {
      return saved.get(key) ?? null;
    },
    async set(key, value, options) {
      this.lastTtl = options?.ttl;
      saved.set(key, value);
    },
  };
}

describe("SharedCache", () => {
  it("gives back what another instance saved, with the date it was obtained", async () => {
    const store = memoryStore();
    await new SharedCache(() => store).set(KEY, { clay: 39.6 }, 3600, NOW);

    const other = new SharedCache(() => store);
    const entry = await other.get<{ clay: number }>(KEY, new Date(NOW.getTime() + 60_000));

    expect(entry?.value).toEqual({ clay: 39.6 });
    expect(entry?.storedAt).toBe(NOW.toISOString());
    expect(store.lastTtl).toBe(3600);
  });

  it("ignores an entry past its expiry", async () => {
    const store = memoryStore();
    const cache = new SharedCache(() => store);
    await cache.set(KEY, "value", 60, NOW);
    expect(await cache.get(KEY, new Date(NOW.getTime() + 61_000))).toBeNull();
  });

  it("treats a missing or malformed entry as missing", async () => {
    const store = memoryStore();
    const cache = new SharedCache(() => store);
    expect(await cache.get(KEY, NOW)).toBeNull();
    store.saved.set(KEY, { key: "another-key", storedAt: "x", expiresAt: null, value: 1 });
    expect(await cache.get(KEY, NOW)).toBeNull();
    store.saved.set(KEY, "not an entry");
    expect(await cache.get(KEY, NOW)).toBeNull();
  });

  it("never fails when the store is down", async () => {
    const broken = new SharedCache(() => {
      throw new Error("No cache in this context.");
    });
    await expect(broken.set(KEY, 1, 60, NOW)).resolves.toBeUndefined();
    await expect(broken.get(KEY, NOW)).resolves.toBeNull();
  });
});
