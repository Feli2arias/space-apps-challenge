import { describe, expect, it } from "vitest";

import { RAIN_METRIC_IDS, RAIN_QUALITY_NOTES } from "./rain-stats";
import { RAIN_LIMITATIONS, RAIN_STAGES } from "./rain";
import { rainMessages } from "./rain.messages";

/**
 * The catalogue cannot import the source (it runs in the browser), so this
 * test is what keeps the two in step: every code the source can emit must have
 * words in both languages, and the catalogue must not describe codes that do
 * not exist.
 */
describe.each(["es", "en"] as const)("rain messages (%s)", (locale) => {
  const messages = rainMessages[locale];
  const sorted = (values: readonly string[]): string[] => [...values].sort();

  it("has a label and a help sentence for exactly the metrics the source emits", () => {
    expect(sorted(Object.keys(messages.metrics))).toEqual(sorted(Object.values(RAIN_METRIC_IDS)));
    for (const text of Object.values(messages.metrics)) {
      expect(text.label.trim()).not.toBe("");
      expect(text.help.trim()).not.toBe("");
    }
  });

  it("has a sentence for exactly the limitations, quality notes and stages the source emits", () => {
    expect(sorted(Object.keys(messages.limitations))).toEqual(sorted(Object.values(RAIN_LIMITATIONS)));
    expect(sorted(Object.keys(messages.qualityNotes))).toEqual(sorted(Object.values(RAIN_QUALITY_NOTES)));
    expect(sorted(Object.keys(messages.stages))).toEqual(sorted(Object.values(RAIN_STAGES)));
    // The source converts no unit, so there is nothing to document here.
    expect(messages.conversions).toEqual({});
  });

  it("says that the numbers describe the surroundings, not the plot", () => {
    expect(Object.keys(messages.scope)).toEqual(["regional"]);
    expect(messages.scope.regional).toMatch(/10 km/);
  });

  it("leaves no text empty", () => {
    const texts = [
      messages.title,
      messages.summary,
      messages.noData,
      ...Object.values(messages.limitations),
      ...Object.values(messages.qualityNotes),
      ...Object.values(messages.stages),
    ];
    expect(texts.every((text) => text.trim().length > 0)).toBe(true);
  });
});
