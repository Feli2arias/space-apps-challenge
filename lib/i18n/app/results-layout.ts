import type { SourceId } from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";

/** Words of the one-page results dashboard: topic names, cards, month grids and disclosures. */
export interface ResultsLayoutDictionary {
  /** Short name of each topic, used on the cards and by the AI blocks. */
  readonly sources: Readonly<Record<SourceId, string>>;
  /** Two words for what a figure describes, shown as a small tag. */
  readonly scopeShort: {
    readonly parcelPolygon: string;
    readonly parcelBuffer: string;
    readonly pixel: string;
    readonly regional: string;
    readonly unknown: string;
  };
  readonly help: {
    /** {label} */
    readonly metric: string;
    readonly scope: string;
  };
  readonly dashboard: {
    readonly dataHeading: string;
    readonly dataIntro: string;
    readonly showMore: string;
    readonly showLess: string;
    readonly moreFigures: string;
    readonly sourceAbsent: string;
  };
  /** The closed rotations section at the end of the page. */
  readonly rotations: {
    readonly title: string;
    readonly note: string;
  };
  readonly rainMonths: {
    readonly title: string;
    readonly caption: string;
  };
  readonly vegetationMonths: {
    readonly title: string;
    readonly caption: string;
    /** Written in a month with images but none clear. */
    readonly cloudy: string;
    /** Written in a month with no image at all. */
    readonly none: string;
    readonly cloudyLong: string;
    readonly noneLong: string;
  };
  readonly slopeShare: string;
}

const es: ResultsLayoutDictionary = {
  sources: {
    rain: "Lluvia",
    vegetation: "Vegetación",
    terrain: "Relieve",
    soil: "Suelo",
    climate: "Temperatura",
  },
  scopeShort: {
    parcelPolygon: "Tu parcela",
    parcelBuffer: "El cuadrado",
    pixel: "Un píxel",
    regional: "La región",
    unknown: "Sin indicar",
  },
  help: {
    metric: "Qué significa: {label}",
    scope: "Qué abarca este dato",
  },
  dashboard: {
    dataHeading: "Los datos del terreno",
    dataIntro: "Una tarjeta por fuente. Ábrela para ver el detalle mes a mes y de dónde sale cada dato.",
    showMore: "Ver más",
    showLess: "Ver menos",
    moreFigures: "Otras cifras",
    sourceAbsent: "La respuesta no trajo esta fuente.",
  },
  rotations: {
    title: "Rotaciones",
    note: "Compara tu práctica actual con dos alternativas, con ejemplos editables.",
  },
  rainMonths: {
    title: "Lluvia de cada mes",
    caption:
      "Promedio de cada mes en el período; debajo, del año más seco al más lluvioso. El color más intenso marca los meses más lluviosos.",
  },
  vegetationMonths: {
    title: "Verdor de cada mes (NDVI)",
    caption:
      "Cada casilla es un mes con su NDVI promedio; el color más intenso, más verdor. Los meses sin imagen despejada quedan vacíos: no se rellenan.",
    cloudy: "nubes",
    none: "—",
    cloudyLong: "hubo imágenes, ninguna despejada",
    noneLong: "sin imágenes",
  },
  slopeShare: "{share} del área",
};

const en: ResultsLayoutDictionary = {
  sources: {
    rain: "Rain",
    vegetation: "Vegetation",
    terrain: "Terrain",
    soil: "Soil",
    climate: "Temperature",
  },
  scopeShort: {
    parcelPolygon: "Your plot",
    parcelBuffer: "The square",
    pixel: "One pixel",
    regional: "The region",
    unknown: "Not stated",
  },
  help: {
    metric: "What it means: {label}",
    scope: "What this figure covers",
  },
  dashboard: {
    dataHeading: "The plot's data",
    dataIntro: "One card per source. Open it to see the month-by-month detail and where each figure comes from.",
    showMore: "See more",
    showLess: "See less",
    moreFigures: "Other figures",
    sourceAbsent: "The response did not include this source.",
  },
  rotations: {
    title: "Rotations",
    note: "Compare your current practice with two alternatives, using editable examples.",
  },
  rainMonths: {
    title: "Rain in each month",
    caption:
      "Each month's average over the period; below it, from the driest to the wettest year. The stronger colour marks the wetter months.",
  },
  vegetationMonths: {
    title: "Greenness in each month (NDVI)",
    caption:
      "Each cell is a month with its mean NDVI; the stronger colour, the greener. Months without a clear image stay empty: they are not filled in.",
    cloudy: "clouds",
    none: "—",
    cloudyLong: "images, none clear",
    noneLong: "no images",
  },
  slopeShare: "{share} of the area",
};

export const RESULTS_LAYOUT_DICTIONARY: Readonly<Record<Locale, ResultsLayoutDictionary>> = { es, en };

/** The layout words for a language; Spanish when the language is unknown. */
export function getResultsLayoutDictionary(locale: Locale): ResultsLayoutDictionary {
  return Object.hasOwn(RESULTS_LAYOUT_DICTIONARY, locale) ? RESULTS_LAYOUT_DICTIONARY[locale] : es;
}
