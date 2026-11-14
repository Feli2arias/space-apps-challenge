import { describe, expect, it } from "vitest";
import type { RotationReading } from "@/lib/rotation/compare";
import { ROTATIONS_GAP_RESULT, ROTATIONS_RESULT } from "./fixtures";
import { planNotes } from "./notes";

function reading(result: typeof ROTATIONS_RESULT, id: string): RotationReading {
  const found = result.readings.find((item) => item.planId === id);
  if (!found) throw new Error(`no reading ${id}`);
  return found;
}

const codes = (notes: readonly { code: string }[]) => notes.map((note) => note.code);

describe("planNotes", () => {
  it("for maize: evidence from another region, a known host and bare rainy months", () => {
    const notes = planNotes(reading(ROTATIONS_RESULT, "current"), false, true);
    expect(codes(notes.unknown)).toEqual(["no-local-evidence", "cover-declared"]);
    expect(codes(notes.review)).toEqual(["still-example", "check-calendar", "cover-rainy", "host-risk"]);
    expect(notes.review.find((note) => note.code === "cover-rainy")?.months).toEqual([9]);
  });

  it("for a cover crop: not studied, host status unknown, ask about local experience", () => {
    const notes = planNotes(reading(ROTATIONS_RESULT, "alt-c"), false, false);
    expect(codes(notes.unknown)).toEqual(["not-studied", "host-unknown", "cover-declared"]);
    expect(codes(notes.review)).toEqual(["check-calendar", "local-experience"]);
  });

  it("for an unknown crop with incomplete rain: says both, invents no host question", () => {
    const notes = planNotes(reading(ROTATIONS_GAP_RESULT, "current"), true, false);
    expect(codes(notes.unknown)).toEqual(["crop-unknown", "cover-declared", "rain-incomplete"]);
    expect(codes(notes.review)).toEqual(["check-calendar"]);
  });

  it("flags a range that straddles the current practice", () => {
    const base = reading(ROTATIONS_RESULT, "alt-b");
    const exposure = base.exposure;
    if (!exposure) throw new Error("fixture has exposure");
    const straddling = { ...base, exposure: { ...exposure, relativeRange: { low: 0.9, high: 1.1 } } };
    expect(codes(planNotes(straddling, false, false).unknown)).toContain("range-crosses");
    expect(codes(planNotes(base, false, false).unknown)).not.toContain("range-crosses");
  });
});
