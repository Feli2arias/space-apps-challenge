import { describe, expect, it } from "vitest";
import { checkAnswer } from "./chat";
import type { AnalysisFacts } from "./facts";
import { checkReading } from "./reading";

const facts: AnalysisFacts = {
  area: { latitude: 10.95, longitude: -84.72, hectares: 4, definedBy: "buffer" },
  period: { start: "2021-01-01", end: "2025-12-31" },
  sources: [
    { source: "rain", title: "Lluvia", status: "ok", scopeNote: "Dato regional.", limitations: [] },
    { source: "soil", title: "Suelo", status: "ok", scopeNote: "Modelo.", limitations: [] },
    { source: "terrain", title: "Relieve", status: "error", scopeNote: null, limitations: [] },
  ],
  facts: [
    { source: "rain", label: "Lluvia anual media", value: "2 392 mm/año", when: null, scope: "regional" },
    { source: "soil", label: "pH", value: "pH 5,3", when: null, scope: "pixel" },
  ],
  monthly: [],
  allowedNumbers: [2392.2, 5.3, 2021, 2022, 2023, 2024, 2025, 4],
};

function reading(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    summary: "En la región llueven 2 392 mm/año y el modelo de suelo indica pH 5,3.",
    favorable: [{ title: "Lluvia abundante", text: "Llueven 2 392 mm/año en la región.", basedOn: ["rain"] }],
    alerts: [{ title: "Suelo ácido", text: "El modelo indica pH 5,3; puede limitar nutrientes.", basedOn: ["soil"] }],
    toCheck: [],
    ...overrides,
  });
}

describe("checkReading", () => {
  it("accepts a reading whose figures and sources come from the analysis", () => {
    const check = checkReading(reading(), facts, "es");
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.value.favorable).toHaveLength(1);
    expect(check.value.toCheck).toEqual([]);
  });

  it("rejects more points in a list than the limit", () => {
    const point = { title: "T", text: "Texto.", basedOn: ["rain"] };
    const check = checkReading(reading({ favorable: [point, point, point, point] }), facts, "es");
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.problem).toContain("favorable");
  });

  it("rejects a point resting on a source without results", () => {
    const check = checkReading(
      reading({ toCheck: [{ title: "Pendiente", text: "Revisa la pendiente.", basedOn: ["terrain"] }] }),
      facts,
      "es",
    );
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.problem).toContain("terrain");
  });

  it("rejects a figure that is not in the analysis, in the summary or in a point", () => {
    const inSummary = checkReading(reading({ summary: "Llueven 3 000 mm/año." }), facts, "es");
    expect(inSummary.ok).toBe(false);
    const inPoint = checkReading(
      reading({ alerts: [{ title: "Suelo", text: "Conviene llegar a pH 6,5.", basedOn: ["soil"] }] }),
      facts,
      "es",
    );
    expect(inPoint.ok).toBe(false);
    if (inPoint.ok) return;
    expect(inPoint.problem).toContain("6,5");
  });
});

describe("checkAnswer", () => {
  const answer = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({ answer: "El modelo indica pH 5,3.", answerable: true, basedOn: ["soil"], ...overrides });

  it("accepts an answer built from the analysis", () => {
    const check = checkAnswer(answer(), facts, "es");
    expect(check).toEqual({
      ok: true,
      value: { answer: "El modelo indica pH 5,3.", answerable: true, basedOn: ["soil"] },
    });
  });

  it("accepts saying the analysis does not have the information", () => {
    const check = checkAnswer(
      answer({ answer: "Este análisis no tiene ese dato.", answerable: false, basedOn: [] }),
      facts,
      "es",
    );
    expect(check.ok).toBe(true);
  });

  it("rejects an answer with a figure of its own", () => {
    const check = checkAnswer(answer({ answer: "Aplica 200 kg por hectárea." }), facts, "es");
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.problem).toContain("200");
  });

  it("rejects an answer leaning on a source without results, or with another shape", () => {
    expect(checkAnswer(answer({ basedOn: ["terrain"] }), facts, "es").ok).toBe(false);
    expect(checkAnswer(JSON.stringify({ text: "hola" }), facts, "es").ok).toBe(false);
    expect(checkAnswer("hola", facts, "es").ok).toBe(false);
  });
});
