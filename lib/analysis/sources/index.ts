import type { AnalysisSource, SourceId } from "../types";
import { climateSource } from "./climate";
import { rainSource } from "./rain";
import { soilSource } from "./soil";
import { terrainSource } from "./terrain";
import { vegetationSource } from "./vegetation";

/** Every data source the analysis can query. Server-side only. */
export const SOURCES: { readonly [K in SourceId]: AnalysisSource<K> } = {
  rain: rainSource,
  vegetation: vegetationSource,
  terrain: terrainSource,
  soil: soilSource,
  climate: climateSource,
};
