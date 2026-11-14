import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cacheKey, FileCache, LayeredCache, MemoryCache, roundCoordinate } from "./cache";

const T0 = new Date("2026-11-14T12:00:00Z");
const later = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe("cacheKey", () => {
  it("is stable for the same parts and differs when a part changes", () => {
    const base = { source: "rain", ring: [[1, 2]], period: { start: "2021-01-01" } };
    expect(cacheKey(base)).toBe(cacheKey({ ...base }));
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, source: "soil" }));
    expect(cacheKey(base)).toMatch(/^[a-f0-9]{40}$/);
  });
});

describe("roundCoordinate", () => {
  it("removes differences far below a metre", () => {
    expect(roundCoordinate(10.950000049)).toBe(roundCoordinate(10.95));
    expect(roundCoordinate(10.95001)).not.toBe(roundCoordinate(10.95));
  });
});

describe("MemoryCache", () => {
  it("returns what was stored, with the date it was stored", async () => {
    const cache = new MemoryCache();
    await cache.set("k", { total: 0 }, 60, T0);
    const entry = await cache.get<{ total: number }>("k", later(10));
    expect(entry?.value).toEqual({ total: 0 });
    expect(entry?.storedAt).toBe(T0.toISOString());
  });

  it("forgets entries once they expire", async () => {
    const cache = new MemoryCache();
    await cache.set("k", 1, 60, T0);
    expect(await cache.get("k", later(59))).not.toBeNull();
    expect(await cache.get("k", later(60))).toBeNull();
  });

  it("drops the least recently used entry when full", async () => {
    const cache = new MemoryCache(2);
    await cache.set("a", 1, 60, T0);
    await cache.set("b", 2, 60, T0);
    await cache.get("a", T0);
    await cache.set("c", 3, 60, T0);
    expect(await cache.get("b", T0)).toBeNull();
    expect(await cache.get("a", T0)).not.toBeNull();
    expect(await cache.get("c", T0)).not.toBeNull();
  });

  it("is a miss for an unknown key", async () => {
    expect(await new MemoryCache().get("missing", T0)).toBeNull();
  });
});

describe("FileCache", () => {
  let directory = "";
  const key = cacheKey({ any: "thing" });

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "bts-cache-test-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("survives a new instance pointing at the same folder", async () => {
    await new FileCache(directory).set(key, { ok: true }, 60, T0);
    const entry = await new FileCache(directory).get<{ ok: boolean }>(key, later(1));
    expect(entry?.value).toEqual({ ok: true });
    expect(entry?.storedAt).toBe(T0.toISOString());
  });

  it("ignores expired entries", async () => {
    const cache = new FileCache(directory);
    await cache.set(key, 1, 60, T0);
    expect(await cache.get(key, later(61))).toBeNull();
  });

  it("refuses keys that are not plain hashes", async () => {
    const cache = new FileCache(directory);
    await cache.set("../escape", 1, 60, T0);
    expect(await readdir(directory)).toEqual([]);
    expect(await cache.get("../escape", T0)).toBeNull();
  });

  it("treats a corrupt file as a miss", async () => {
    await writeFile(path.join(directory, `${key}.json`), "{not json", "utf8");
    expect(await new FileCache(directory).get(key, T0)).toBeNull();
  });

  it("treats a file stored under another key as a miss", async () => {
    const other = cacheKey({ other: true });
    await new FileCache(directory).set(other, 1, 60, T0);
    const { rename } = await import("node:fs/promises");
    await rename(path.join(directory, `${other}.json`), path.join(directory, `${key}.json`));
    expect(await new FileCache(directory).get(key, T0)).toBeNull();
  });

  it("never writes and never expires when read-only", async () => {
    await new FileCache(directory).set(key, "seed", 60, T0);
    const seed = new FileCache(directory, { readOnly: true });
    expect((await seed.get(key, later(10_000)))?.value).toBe("seed");
    const untouched = cacheKey({ untouched: true });
    await seed.set(untouched, 1, 60, T0);
    expect(await seed.get(untouched, T0)).toBeNull();
  });

  it("is a miss when the folder does not exist", async () => {
    expect(await new FileCache(path.join(directory, "nope")).get(key, T0)).toBeNull();
  });
});

describe("LayeredCache", () => {
  it("reads from a slower layer and keeps the original date", async () => {
    const slow = new MemoryCache();
    await slow.set("k", "value", 600, T0);
    const layered = new LayeredCache(new MemoryCache(), [slow]);
    const entry = await layered.get<string>("k", later(100));
    expect(entry?.value).toBe("value");
    expect(entry?.storedAt).toBe(T0.toISOString());
  });

  it("writes to every layer", async () => {
    const slow = new MemoryCache();
    const layered = new LayeredCache(new MemoryCache(), [slow]);
    await layered.set("k", 7, 60, T0);
    expect((await slow.get<number>("k", T0))?.value).toBe(7);
  });

  it("is a miss when no layer has the key", async () => {
    expect(await new LayeredCache(new MemoryCache(), [new MemoryCache()]).get("k", T0)).toBeNull();
  });
});
