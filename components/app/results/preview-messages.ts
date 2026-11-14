/**
 * TEST SCAFFOLDING — NOT PRODUCT TEXT.
 *
 * A stand-in message catalogue for the layout preview page, so the panel can be
 * checked with sentences of realistic length before the real catalogues exist.
 * Every sentence says it is a sample. Some codes used by the sample analyses
 * are left out on purpose, to show how the panel falls back to the raw code.
 */

import type { DataScope, SourceId, SourceMessages } from "@/lib/analysis/types";
import { SOURCE_IDS } from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";
import type { SourceCatalogue } from "./messages";

const SAMPLE_METRIC_IDS: Readonly<Record<SourceId, readonly string[]>> = {
  rain: ["sample.rain.annualMean", "sample.rain.wettestMonth", "sample.rain.driestMonthTotal"],
  vegetation: ["sample.vegetation.latest", "sample.vegetation.usableScenes"],
  terrain: ["sample.terrain.elevationMean", "sample.terrain.slopeMean"],
  soil: ["sample.soil.clayTop"],
  climate: ["sample.climate.meanTemperature"],
};

const SCOPES: readonly DataScope[] = ["parcel", "pixel", "regional"];

function sampleMessages(source: SourceId, locale: Locale): SourceMessages {
  const es = locale === "es";
  const lastPart = (id: string) => id.split(".").at(-1) ?? id;
  return {
    title: es ? `Muestra: ${source}` : `Sample: ${source}`,
    summary: es
      ? "Texto de muestra para probar el diseño. No describe ningún dato real."
      : "Sample text for testing the layout. It describes no real data.",
    scope: Object.fromEntries(
      SCOPES.map((scope) => [
        scope,
        es
          ? `Frase de muestra para el alcance «${scope}», de un largo parecido al real.`
          : `Sample sentence for the "${scope}" scope, about as long as a real one.`,
      ]),
    ),
    metrics: Object.fromEntries(
      SAMPLE_METRIC_IDS[source].map((id) => [
        id,
        {
          label: es ? `Etiqueta de muestra (${lastPart(id)})` : `Sample label (${lastPart(id)})`,
          help: es
            ? "Explicación de muestra, en una sola frase, de lo que diría esta cifra."
            : "Sample explanation, in one sentence, of what this figure would say.",
        },
      ]),
    ),
    limitations: {
      "sample-limitation": es
        ? "Limitación de muestra: esta frase solo sirve para ver cómo se acomoda el texto."
        : "Sample limitation: this sentence only shows how the text wraps.",
    },
    qualityNotes: {
      "sample-note": es ? "Nota de calidad de muestra." : "Sample quality note.",
    },
    conversions: {
      "sample-conversion": es
        ? "Conversión de muestra: unidad A × 1 = unidad B."
        : "Sample conversion: unit A × 1 = unit B.",
    },
    stages: {},
    noData: es
      ? "Texto de muestra para cuando la fuente respondió sin observaciones válidas."
      : "Sample text for when the source answered with no valid observations.",
  };
}

/** Sample catalogue for all five sources, in both languages. */
export const SAMPLE_MESSAGES: SourceCatalogue = Object.fromEntries(
  SOURCE_IDS.map((source) => [
    source,
    { es: sampleMessages(source, "es"), en: sampleMessages(source, "en") },
  ]),
);
