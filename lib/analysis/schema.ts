import { z } from "zod";
import { bufferArea, isSelfIntersecting, polygonArea } from "./geometry";
import {
  ANALYSIS_LIMITS,
  SOURCE_IDS,
  type AnalysisArea,
  type AnalysisRequest,
  type ApiError,
} from "./types";

/**
 * Validation of what the browser sends to POST /api/analysis.
 * Nothing from the request is trusted: shape, ranges and geometry are all
 * checked here before any external service is called.
 */

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

const literalUnion = <T extends number>(values: readonly T[]) =>
  z.number().refine((value): value is T => (values as readonly number[]).includes(value));

const bufferSchema = z.strictObject({
  kind: z.literal("buffer"),
  center: z.strictObject({ lat: latitude, lon: longitude }),
  sideMeters: literalUnion(ANALYSIS_LIMITS.bufferSidesMeters),
});

const polygonSchema = z.strictObject({
  kind: z.literal("polygon"),
  // One extra position is allowed because the ring may arrive already closed.
  ring: z
    .array(z.tuple([longitude, latitude]))
    .min(ANALYSIS_LIMITS.minPolygonVertices)
    .max(ANALYSIS_LIMITS.maxPolygonVertices + 1),
});

const requestSchema = z.strictObject({
  area: z.discriminatedUnion("kind", [bufferSchema, polygonSchema]),
  years: literalUnion(ANALYSIS_LIMITS.yearsOptions),
  refresh: z.array(z.enum(SOURCE_IDS)).max(SOURCE_IDS.length).optional(),
});

type Issue = NonNullable<ApiError["issues"]>[number];

export type ParsedRequest =
  | { readonly ok: true; readonly request: AnalysisRequest; readonly area: AnalysisArea }
  | { readonly ok: false; readonly issues: readonly Issue[] };

function distinctVertices(ring: readonly (readonly [number, number])[]): number {
  return new Set(ring.map(([lon, lat]) => `${lon},${lat}`)).size;
}

function geometryIssues(area: AnalysisArea, vertices: number): Issue[] {
  const issues: Issue[] = [];
  if (vertices < ANALYSIS_LIMITS.minPolygonVertices) {
    issues.push({ path: "area.ring", message: "The outline needs at least three different points." });
  }
  if (vertices > ANALYSIS_LIMITS.maxPolygonVertices) {
    issues.push({
      path: "area.ring",
      message: `The outline can have at most ${ANALYSIS_LIMITS.maxPolygonVertices} points.`,
    });
  }
  if (isSelfIntersecting(area.polygon.coordinates[0])) {
    issues.push({ path: "area.ring", message: "The outline crosses itself." });
  }
  if (area.areaHectares < ANALYSIS_LIMITS.minAreaHectares) {
    issues.push({
      path: "area",
      message: `The area must be at least ${ANALYSIS_LIMITS.minAreaHectares} hectares.`,
    });
  }
  if (area.areaHectares > ANALYSIS_LIMITS.maxAreaHectares) {
    issues.push({
      path: "area",
      message: `The area must be at most ${ANALYSIS_LIMITS.maxAreaHectares} hectares.`,
    });
  }
  return issues;
}

/** Checks a request body and, when it is valid, builds the area to analyse. */
export function parseAnalysisRequest(input: unknown): ParsedRequest {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const request: AnalysisRequest = parsed.data;
  if (request.area.kind === "buffer") {
    return { ok: true, request, area: bufferArea(request.area.center, request.area.sideMeters) };
  }

  const area = polygonArea(request.area.ring);
  const issues = geometryIssues(area, distinctVertices(request.area.ring));
  return issues.length > 0 ? { ok: false, issues } : { ok: true, request, area };
}
