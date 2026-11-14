import { describe, expect, it } from "vitest";

import { buildRejectMask, isClearQa, REJECTED_QA_FLAGS } from "./landsat-qa";
import type { QaBitfield } from "./landsat-stac";
import { fixtureScene, SCENE_ID } from "./landsat-test-fixtures";

/** The bit description of a real scene, as the STAC item publishes it. */
const bitfields = fixtureScene(SCENE_ID.clear16).qaBitfields;

/** Quality values that occur in the captured rasters (see landsat-ndvi.test.ts). */
const QA_CLEAR = 21824; // clear bit set, every confidence "low"
const QA_CLOUD = 22280; // cloud bit set, cloud confidence "high"
const QA_DILATED_CLOUD = 21762; // dilated-cloud bit set
const QA_FILL = 1; // fill bit only: the corner of the raster

describe("buildRejectMask", () => {
  it("builds the mask from the scene's own bit description", () => {
    // fill 0, dilated cloud 1, cirrus 2, cloud 3, cloud shadow 4, snow 5.
    expect(buildRejectMask(bitfields)).toBe(0b111111);
  });

  it("does not include the clear, water or confidence fields", () => {
    const mask = buildRejectMask(bitfields) ?? 0;
    const bit = (name: string): number => 1 << (bitfields.find((field) => field.name === name)?.offset ?? -1);
    for (const name of ["clear", "water", "cloud_confidence", "cirrus_confidence"]) {
      expect(mask & bit(name)).toBe(0);
    }
  });

  it("follows the positions given, not fixed ones", () => {
    const moved: readonly QaBitfield[] = REJECTED_QA_FLAGS.map((name, index) => ({
      name,
      offset: index + 8,
      length: 1,
    }));
    expect(buildRejectMask(moved)).toBe(0b111111 << 8);
  });

  it("returns null when a flag is missing, so the scene is not trusted", () => {
    expect(buildRejectMask(bitfields.filter((field) => field.name !== "cloud_shadow"))).toBeNull();
    expect(buildRejectMask([])).toBeNull();
  });

  it("returns null when a flag sits beyond the 16 bits of the band", () => {
    const beyond = bitfields.map((field) => (field.name === "snow" ? { ...field, offset: 33 } : field));
    expect(buildRejectMask(beyond)).toBeNull();
  });

  it("returns null when a flag is not a single bit", () => {
    const widened = bitfields.map((field) => (field.name === "cloud" ? { ...field, length: 2 } : field));
    expect(buildRejectMask(widened)).toBeNull();
  });
});

describe("isClearQa", () => {
  const mask = 0b111111;

  it("accepts the clear value and rejects cloud, dilated cloud and fill", () => {
    expect(isClearQa(QA_CLEAR, mask)).toBe(true);
    expect(isClearQa(QA_CLOUD, mask)).toBe(false);
    expect(isClearQa(QA_DILATED_CLOUD, mask)).toBe(false);
    expect(isClearQa(QA_FILL, mask)).toBe(false);
  });

  it("rejects each flag on its own", () => {
    for (let bit = 0; bit < REJECTED_QA_FLAGS.length; bit += 1) {
      expect(isClearQa(1 << bit, mask)).toBe(false);
    }
  });

  it("keeps water: a flooded field is still an observation of the plot", () => {
    const water = 1 << 7;
    expect(isClearQa(water, mask)).toBe(true);
  });

  it("ignores medium or high confidence fields when the flag itself is not set", () => {
    const highCloudConfidenceOnly = 0b11 << 8;
    expect(isClearQa(highCloudConfidenceOnly, mask)).toBe(true);
  });
});
