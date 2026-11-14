import { cacheKey, roundCoordinate, type CacheStore } from "./cache";
import { SourceError, toSourceErrorInfo } from "./errors";
import { logSourceFailure } from "./log";
import { lastFullYears } from "./period";
import {
  SOURCE_IDS,
  type Analysis,
  type AnalysisArea,
  type AnalysisEvent,
  type AnalysisRequest,
  type AnalysisSource,
  type AnalysisStatus,
  type DateRange,
  type SourceDataMap,
  type SourceId,
  type SourcePayload,
  type SourceResult,
} from "./types";

/**
 * Runs every data source for one area, each on its own, and reports what
 * happens as it happens. One source failing never stops the others: the
 * analysis ends as "complete", "partial" or "failed".
 */

/** Bump when the shape of an analysis changes, so old cached results are not reused. */
export const ENGINE_VERSION = "1.0.0";

/** A single source may take at most this long before it is counted as timed out. */
const SOURCE_BUDGET_MS = 230_000;

export type SourceRegistry = { readonly [K in SourceId]: AnalysisSource<K> };

export interface RunAnalysisOptions {
  readonly request: AnalysisRequest;
  readonly area: AnalysisArea;
  readonly sources: SourceRegistry;
  readonly cache: CacheStore;
  /** Cancels everything when the person leaves or changes the selection. */
  readonly signal: AbortSignal;
  readonly emit: (event: AnalysisEvent) => void;
  /** The clock is passed in so results are reproducible in tests. */
  readonly now: () => Date;
}

/** What is kept in the cache for one source: the payload and when it was obtained. */
interface CachedSource<K extends SourceId> {
  readonly payload: SourcePayload<SourceDataMap[K]>;
  readonly durationMs: number;
}

function ringForKey(area: AnalysisArea): readonly (readonly [number, number])[] {
  return area.polygon.coordinates[0].map(
    ([lon, lat]) => [roundCoordinate(lon), roundCoordinate(lat)] as const,
  );
}

/** The same area and period always give the same id, so a result can be found again. */
export function analysisId(area: AnalysisArea, period: DateRange): string {
  return cacheKey({ engine: ENGINE_VERSION, ring: ringForKey(area), period }).slice(0, 16);
}

function sourceCacheKey(source: AnalysisSource, area: AnalysisArea, period: DateRange): string {
  return cacheKey({
    source: source.id,
    version: source.cacheVersion,
    product: source.product.id,
    productVersion: source.product.version,
    ring: ringForKey(area),
    // Static products ignore the period, so it must not split their cache.
    period: source.isStatic ? null : period,
  });
}

function fromPayload<K extends SourceId>(
  source: AnalysisSource<K>,
  payload: SourcePayload<SourceDataMap[K]>,
  meta: { readonly retrievedAt: string; readonly fromCache: boolean; readonly durationMs: number },
): SourceResult<SourceDataMap[K]> {
  return {
    source: source.id,
    status: payload.status,
    product: source.product,
    scope: payload.scope,
    period: payload.period,
    metrics: payload.metrics,
    data: payload.data,
    quality: payload.quality,
    limitations: payload.limitations,
    conversions: payload.conversions,
    error: null,
    ...meta,
  };
}

function fromError<K extends SourceId>(
  source: AnalysisSource<K>,
  error: unknown,
  meta: { readonly retrievedAt: string; readonly durationMs: number },
): SourceResult<SourceDataMap[K]> {
  return {
    source: source.id,
    status: "error",
    product: source.product,
    scope: null,
    period: null,
    metrics: [],
    data: null,
    quality: null,
    limitations: [],
    conversions: [],
    error: toSourceErrorInfo(error),
    fromCache: false,
    ...meta,
  };
}

async function runWithBudget<K extends SourceId>(
  source: AnalysisSource<K>,
  options: RunAnalysisOptions,
  period: DateRange,
): Promise<SourcePayload<SourceDataMap[K]>> {
  const budget = AbortSignal.timeout(SOURCE_BUDGET_MS);
  const signal = AbortSignal.any([options.signal, budget]);
  try {
    return await source.run({
      area: options.area,
      period,
      signal,
      reportProgress: (progress) =>
        options.emit({ type: "source-progress", source: source.id, progress }),
    });
  } catch (error) {
    // Distinguish "we ran out of time" from "the person cancelled".
    if (budget.aborted && !options.signal.aborted) {
      throw new SourceError(
        "timeout",
        `The ${source.id} source did not finish within ${SOURCE_BUDGET_MS / 1000} seconds.`,
        { cause: error },
      );
    }
    throw error;
  }
}

async function runSource<K extends SourceId>(
  source: AnalysisSource<K>,
  options: RunAnalysisOptions,
  period: DateRange,
): Promise<SourceResult<SourceDataMap[K]>> {
  const key = sourceCacheKey(source, options.area, period);

  // A good cached result is always used. Failures and incomplete answers are
  // never cached, so sending the request again is what retries them; a visitor
  // cannot force fresh queries or replace a result other people rely on.
  const cached = await options.cache.get<CachedSource<K>>(key, options.now());
  if (cached) {
    options.emit({ type: "source-started", source: source.id, fromCache: true });
    return fromPayload(source, cached.value.payload, {
      retrievedAt: cached.storedAt,
      fromCache: true,
      durationMs: cached.value.durationMs,
    });
  }

  options.emit({ type: "source-started", source: source.id, fromCache: false });
  const startedAt = options.now();
  const elapsed = () => options.now().getTime() - startedAt.getTime();

  try {
    const payload = await runWithBudget(source, options, period);
    const durationMs = elapsed();
    // Errors and incomplete answers are never cached: the next attempt should
    // query the service again instead of repeating a temporary failure.
    if (!payload.incomplete) {
      const entry: CachedSource<K> = { payload, durationMs };
      await options.cache.set(key, entry, source.cacheTtlSeconds, startedAt);
    }
    return fromPayload(source, payload, {
      retrievedAt: startedAt.toISOString(),
      fromCache: false,
      durationMs,
    });
  } catch (error) {
    return fromError(source, error, { retrievedAt: startedAt.toISOString(), durationMs: elapsed() });
  }
}

function overallStatus(results: readonly SourceResult[]): AnalysisStatus {
  const failed = results.filter((result) => result.status === "error").length;
  if (failed === 0) return "complete";
  return failed === results.length ? "failed" : "partial";
}

export async function runAnalysis(options: RunAnalysisOptions): Promise<Analysis> {
  const requestedAt = options.now();
  const period = lastFullYears(options.request.years, requestedAt);
  const id = analysisId(options.area, period);

  options.emit({
    type: "accepted",
    analysisId: id,
    area: options.area,
    period,
    sources: SOURCE_IDS,
  });

  const settle = async <K extends SourceId>(sourceId: K): Promise<SourceResult<SourceDataMap[K]>> => {
    const result = await runSource(options.sources[sourceId], options, period);
    // A cancelled run is the person's choice, not a failure worth recording.
    if (result.error && result.error.code !== "aborted") {
      logSourceFailure(id, sourceId, result.error, result.durationMs);
    }
    options.emit({ type: "source-finished", source: sourceId, result });
    return result;
  };

  const [rain, vegetation, terrain, soil, climate] = await Promise.all([
    settle("rain"),
    settle("vegetation"),
    settle("terrain"),
    settle("soil"),
    settle("climate"),
  ]);

  const analysis: Analysis = {
    id,
    status: overallStatus([rain, vegetation, terrain, soil, climate]),
    area: options.area,
    period,
    requestedAt: requestedAt.toISOString(),
    completedAt: options.now().toISOString(),
    engineVersion: ENGINE_VERSION,
    sources: { rain, vegetation, terrain, soil, climate },
  };

  options.emit({ type: "done", analysis });
  return analysis;
}

/**
 * Reads back the sources of an analysis that are already in the cache, without
 * querying anything. Sources that are not cached are simply absent. Used by
 * features that explain an analysis the person has just seen.
 */
export async function readCachedSources(
  area: AnalysisArea,
  period: DateRange,
  sources: SourceRegistry,
  cache: CacheStore,
  now: Date,
): Promise<{ readonly [K in SourceId]?: SourceResult<SourceDataMap[K]> }> {
  const read = async <K extends SourceId>(
    source: AnalysisSource<K>,
  ): Promise<SourceResult<SourceDataMap[K]> | null> => {
    const cached = await cache.get<CachedSource<K>>(sourceCacheKey(source, area, period), now);
    if (!cached) return null;
    return fromPayload(source, cached.value.payload, {
      retrievedAt: cached.storedAt,
      fromCache: true,
      durationMs: cached.value.durationMs,
    });
  };

  const [rain, vegetation, terrain, soil, climate] = await Promise.all([
    read(sources.rain),
    read(sources.vegetation),
    read(sources.terrain),
    read(sources.soil),
    read(sources.climate),
  ]);

  return {
    ...(rain ? { rain } : {}),
    ...(vegetation ? { vegetation } : {}),
    ...(terrain ? { terrain } : {}),
    ...(soil ? { soil } : {}),
    ...(climate ? { climate } : {}),
  };
}
