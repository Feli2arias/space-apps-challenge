import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { bufferArea } from "../geometry";
import type { AnalysisArea } from "../types";
import { parseSearchPage } from "./landsat-stac";
import type { LandsatScene } from "./landsat-stac";

/**
 * Loads the captured fixtures for the Landsat tests. Used by tests only.
 *
 * Everything under __fixtures__/landsat-* is a real answer of the Planetary
 * Computer, captured on 2026-11-14 for the test area (a 200 m square centred
 * on lat 10.95, lon -84.72, Los Chiles, Costa Rica) with the same requests the
 * source builds. Nothing in those files was written by hand.
 */

export const TEST_AREA: AnalysisArea = bufferArea({ lat: 10.95, lon: -84.72 }, 200);

/** The five scenes of landsat-stac-items.json and what each one is there for. */
export const SCENE_ID = {
  /** Fully clear over the plot, delivered in UTM zone 16N. */
  clear16: "LC09_L2SP_015053_20251210_02_T1",
  /** The same satellite pass as `clear16`, next row of the orbit, delivered in UTM zone 17N. */
  clear17: "LC09_L2SP_015052_20251210_02_T1",
  /** Clouds over part of the plot. */
  partlyCloudy: "LC09_L2SP_015053_20250225_02_T1",
  /** Clouds over the whole plot. */
  cloudy: "LC09_L2SP_015053_20250329_02_T1",
  /** Tier 2: a bright cloud that the quality band reports as clear. */
  tier2: "LC09_L2SP_015052_20250414_02_T2",
} as const;

const fixtureUrl = (name: string): URL => new URL(`./__fixtures__/${name}`, import.meta.url);

export function fixtureText(name: string): string {
  return readFileSync(fileURLToPath(fixtureUrl(name)), "utf8");
}

export function fixtureJson(name: string): unknown {
  return JSON.parse(fixtureText(name)) as unknown;
}

export function fixtureBytes(name: string): ArrayBuffer {
  const buffer = readFileSync(fileURLToPath(fixtureUrl(name)));
  // A fresh copy: Node may hand back a view on a shared pool.
  return new Uint8Array(buffer).buffer;
}

export function fixtureScenes(): readonly LandsatScene[] {
  return parseSearchPage(fixtureJson("landsat-stac-items.json")).scenes;
}

export function fixtureScene(id: string): LandsatScene {
  const scene = fixtureScenes().find((candidate) => candidate.id === id);
  if (!scene) throw new Error(`Scene ${id} is not in the fixture.`);
  return scene;
}

export const windowFixtureName = (sceneId: string): string => `landsat-window-${sceneId}.tif`;
