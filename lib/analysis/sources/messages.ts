import type { LocalizedSourceMessages, SourceId } from "../types";
import { climateMessages } from "./climate.messages";
import { rainMessages } from "./rain.messages";
import { soilMessages } from "./soil.messages";
import { terrainMessages } from "./terrain.messages";
import { vegetationMessages } from "./vegetation.messages";

/**
 * Words for every code the sources emit, in both languages.
 * Safe to import from the browser: these files contain text only.
 */
export const SOURCE_MESSAGES: Readonly<Record<SourceId, LocalizedSourceMessages>> = {
  rain: rainMessages,
  vegetation: vegetationMessages,
  terrain: terrainMessages,
  soil: soilMessages,
  climate: climateMessages,
};
