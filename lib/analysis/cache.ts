import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Cache for source results, so the same place, period and product are not
 * queried twice. Three layers, read in order:
 *
 * 1. memory — fastest, lives as long as the server process;
 * 2. files  — survives restarts (a temp folder on serverless hosts);
 * 3. seed   — results computed in advance for the pilot plots and committed
 *             with the code, read-only, so the demo works without the network.
 *
 * Every entry remembers when the data was really obtained, and the interface
 * shows that date whenever a cached result is used.
 */

export interface CacheEntry<TValue> {
  readonly key: string;
  /** When the value was obtained from the upstream service (ISO 8601). */
  readonly storedAt: string;
  /** After this moment the entry is ignored. `null` means it never expires. */
  readonly expiresAt: string | null;
  readonly value: TValue;
}

export interface CacheStore {
  get<TValue>(key: string, now: Date): Promise<CacheEntry<TValue> | null>;
  set<TValue>(key: string, value: TValue, ttlSeconds: number, now: Date): Promise<void>;
}

const KEY_PATTERN = /^[a-f0-9]{16,64}$/;
const COORDINATE_DECIMALS = 6;

/** Builds a stable key from the parts that identify a query. */
export function cacheKey(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 40);
}

/** Rounds coordinates so that the same plot always produces the same key. */
export function roundCoordinate(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

function isExpired(entry: CacheEntry<unknown>, now: Date): boolean {
  return entry.expiresAt !== null && new Date(entry.expiresAt).getTime() <= now.getTime();
}

function isEntry(value: unknown): value is CacheEntry<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.key === "string" &&
    typeof candidate.storedAt === "string" &&
    (candidate.expiresAt === null || typeof candidate.expiresAt === "string") &&
    "value" in candidate
  );
}

function buildEntry<TValue>(key: string, value: TValue, ttlSeconds: number, now: Date): CacheEntry<TValue> {
  return {
    key,
    storedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    value,
  };
}

/** Keeps the most recently used entries in memory. */
export class MemoryCache implements CacheStore {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly maxEntries: number = 200) {}

  async get<TValue>(key: string, now: Date): Promise<CacheEntry<TValue> | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (isExpired(entry, now)) {
      this.entries.delete(key);
      return null;
    }
    // Re-insert so the entry counts as recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry as CacheEntry<TValue>;
  }

  async set<TValue>(key: string, value: TValue, ttlSeconds: number, now: Date): Promise<void> {
    this.remember(buildEntry(key, value, ttlSeconds, now));
  }

  /** Stores an entry that came from a slower layer, keeping its original date. */
  remember(entry: CacheEntry<unknown>): void {
    this.entries.delete(entry.key);
    this.entries.set(entry.key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

/** One JSON file per entry. With `readOnly`, entries never expire and nothing is written. */
export class FileCache implements CacheStore {
  constructor(
    private readonly directory: string,
    private readonly options: { readonly readOnly: boolean } = { readOnly: false },
  ) {}

  private fileFor(key: string): string | null {
    // Keys become file names, so anything that is not a plain hash is refused.
    return KEY_PATTERN.test(key) ? path.join(this.directory, `${key}.json`) : null;
  }

  async get<TValue>(key: string, now: Date): Promise<CacheEntry<TValue> | null> {
    const file = this.fileFor(key);
    if (!file) return null;
    try {
      const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
      if (!isEntry(parsed) || parsed.key !== key) return null;
      if (!this.options.readOnly && isExpired(parsed, now)) return null;
      return parsed as CacheEntry<TValue>;
    } catch {
      // A missing or unreadable file is simply a cache miss.
      return null;
    }
  }

  async set<TValue>(key: string, value: TValue, ttlSeconds: number, now: Date): Promise<void> {
    const file = this.fileFor(key);
    if (this.options.readOnly || !file) return;
    try {
      await mkdir(this.directory, { recursive: true });
      // Write to a temporary name first so a reader never sees half a file.
      const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temporary, JSON.stringify(buildEntry(key, value, ttlSeconds, now)), "utf8");
      await rename(temporary, file);
    } catch {
      // The cache is an optimisation: failing to write must not fail the analysis.
    }
  }
}

/** Reads through the layers in order and writes to every writable one. */
export class LayeredCache implements CacheStore {
  constructor(
    private readonly memory: MemoryCache,
    private readonly slower: readonly CacheStore[],
  ) {}

  async get<TValue>(key: string, now: Date): Promise<CacheEntry<TValue> | null> {
    const fromMemory = await this.memory.get<TValue>(key, now);
    if (fromMemory) return fromMemory;
    for (const layer of this.slower) {
      const entry = await layer.get<TValue>(key, now);
      if (entry) {
        this.memory.remember(entry);
        return entry;
      }
    }
    return null;
  }

  async set<TValue>(key: string, value: TValue, ttlSeconds: number, now: Date): Promise<void> {
    await this.memory.set(key, value, ttlSeconds, now);
    await Promise.all(this.slower.map((layer) => layer.set(key, value, ttlSeconds, now)));
  }
}

/** Folder with the results computed in advance for the pilot plots. */
export const SEED_DIRECTORY = path.join(process.cwd(), "data", "analysis-seed");

function writableDirectory(): string {
  const configured = process.env.ANALYSIS_CACHE_DIR;
  if (configured) return configured;
  // Serverless hosts only allow writing to the temp folder.
  return process.env.VERCEL
    ? path.join(tmpdir(), "before-the-seed-cache")
    : path.join(process.cwd(), ".cache", "analysis");
}

let sharedCache: CacheStore | null = null;

/** The cache used by the API. Created once per server process. */
export function getAnalysisCache(): CacheStore {
  sharedCache ??= new LayeredCache(new MemoryCache(), [
    new FileCache(writableDirectory()),
    new FileCache(SEED_DIRECTORY, { readOnly: true }),
  ]);
  return sharedCache;
}
