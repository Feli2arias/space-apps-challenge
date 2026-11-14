/**
 * Words for the results panel and the loading screen, in Spanish and English.
 *
 * This dictionary holds the panel's own chrome only: status, headings, table
 * headers, error explanations. Everything that names a metric, a limitation or
 * a quality note of a data source comes from that source's message catalogue
 * (`lib/analysis/sources/messages.ts`).
 *
 * Sentences with a `{name}` in them are templates: `fill` replaces each
 * placeholder with a value that is already formatted for the language.
 */

import type {
  Aggregation,
  AnalysisStatus,
  SlopeClass,
  SoilDepth,
  SoilProperty,
  SourceErrorCode,
  SourceId,
  TemporalResolution,
} from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";

export type LoaderStateKey = "waiting" | "running" | "done" | "failed";

interface StatusWords {
  /** Short word for the tag. */
  readonly tag: string;
  readonly title: string;
  readonly body: string;
}

interface ScopeWords {
  /** Short name shown in the tag. */
  readonly tag: string;
  /** Used when the source's catalogue has no sentence for this scope. */
  readonly sentence: string;
}

export interface ResultsDictionary {
  readonly locale: Locale;
  readonly panelLabel: string;
  /** Written wherever a value does not exist. Never replaced by a zero. */
  readonly missing: string;
  readonly status: Readonly<Record<AnalysisStatus, StatusWords>>;
  readonly header: {
    readonly sourcesWithData: string;
    readonly location: string;
    readonly coordinates: string;
    readonly area: string;
    readonly areaBuffer: string;
    readonly areaPolygon: string;
    readonly areaSize: string;
    readonly period: string;
    readonly periodNote: string;
    readonly missingTitle: string;
    readonly missingError: string;
    readonly missingNoData: string;
  };
  /** Used only when a source's catalogue has no title. */
  readonly sourceNames: Readonly<Record<SourceId, string>>;
  readonly sourceStatus: {
    readonly noData: string;
    readonly error: string;
    readonly retrying: string;
  };
  readonly scope: {
    readonly heading: string;
    /** "parcel" when the person drew the outline of the plot. */
    readonly parcelPolygon: ScopeWords;
    /** "parcel" when the area is a square around a point. */
    readonly parcelBuffer: ScopeWords;
    readonly pixel: ScopeWords;
    readonly regional: ScopeWords;
    readonly unknown: ScopeWords;
  };
  readonly aggregation: Readonly<Record<Aggregation, string>>;
  readonly metrics: {
    readonly heading: string;
    readonly none: string;
    readonly at: string;
  };
  readonly provenance: {
    readonly cached: string;
    readonly fresh: string;
    readonly cachedUndated: string;
    readonly freshUndated: string;
  };
  readonly noData: {
    readonly fallback: string;
    readonly examined: string;
    readonly examinedPeriod: string;
    readonly examinedObservations: string;
    readonly examinedValidOnly: string;
    readonly examinedUnknown: string;
  };
  readonly error: {
    readonly title: string;
    readonly codes: Readonly<Record<SourceErrorCode, string>>;
    readonly unknownCode: string;
    readonly notRetryable: string;
    readonly retry: string;
    readonly retrying: string;
    readonly retryLabel: string;
  };
  readonly details: {
    readonly summary: string;
    readonly product: string;
    readonly version: string;
    readonly provider: string;
    readonly accessedVia: string;
    readonly pixelSize: string;
    readonly temporalResolution: string;
    readonly documentation: string;
    readonly documentationLink: string;
    readonly period: string;
    readonly periodStatic: string;
    readonly quality: string;
    readonly validOfExpected: string;
    readonly validOnly: string;
    readonly coverage: string;
    readonly qualityNotes: string;
    readonly limitations: string;
    readonly conversions: string;
    readonly errorDetail: string;
    readonly duration: string;
    readonly noneDeclared: string;
  };
  readonly temporal: Readonly<Record<TemporalResolution, string>>;
  readonly rain: {
    readonly range: string;
    readonly empty: string;
  };
  readonly vegetation: {
    readonly scenes: string;
    readonly months: string;
    readonly clearRule: string;
    readonly pixels: string;
    readonly threshold: string;
    readonly tableToggle: string;
    readonly columnMonth: string;
    readonly columnNdvi: string;
    readonly columnScenes: string;
    readonly scenesOfTotal: string;
    readonly noScenes: string;
    readonly empty: string;
  };
  readonly terrain: {
    readonly slopeTitle: string;
    readonly slopeCaption: string;
    readonly classes: Readonly<Record<SlopeClass, string>>;
    readonly rangeBetween: string;
    readonly rangeFrom: string;
    readonly samples: string;
    readonly empty: string;
  };
  readonly soil: {
    readonly tableTitle: string;
    readonly columnProperty: string;
    readonly properties: Readonly<Record<SoilProperty, string>>;
    readonly depths: Readonly<Record<SoilDepth, string>>;
    readonly empty: string;
  };
  readonly climate: {
    readonly tableTitle: string;
    readonly columnMonth: string;
    readonly columnMean: string;
    readonly columnMax: string;
    readonly columnMin: string;
    readonly unitNote: string;
    readonly gridElevation: string;
    readonly empty: string;
  };
  readonly elevationCheck: {
    readonly title: string;
    readonly body: string;
  };
  readonly loader: {
    readonly sourcesLabel: string;
    readonly states: Readonly<Record<LoaderStateKey, string>>;
  };
}

const es: ResultsDictionary = {
  locale: "es",
  panelLabel: "Resultados del análisis",
  missing: "sin dato",
  status: {
    complete: {
      tag: "Completo",
      title: "Análisis completo",
      body: "Todas las fuentes respondieron con datos para este terreno.",
    },
    partial: {
      tag: "Parcial",
      title: "Análisis parcial",
      body: "Algunas fuentes no dieron datos. Abajo ves lo que sí se obtuvo y lo que falta.",
    },
    failed: {
      tag: "Sin resultados",
      title: "No se pudo analizar el terreno",
      body: "Ninguna fuente entregó datos. Puedes reintentar cada una más abajo.",
    },
  },
  header: {
    sourcesWithData: "{count} de {total} fuentes con datos",
    location: "Ubicación",
    coordinates: "Lat {lat}, Lon {lon}",
    area: "Área analizada",
    areaBuffer: "Cuadrado de {side} de lado alrededor del punto",
    areaPolygon: "Contorno dibujado en el mapa",
    areaSize: "Tamaño: {hectares}",
    period: "Período analizado",
    periodNote: "El relieve y el suelo no cambian con el período.",
    missingTitle: "Lo que falta",
    missingError: "{source}: no se pudo consultar.",
    missingNoData: "{source}: sin observaciones válidas.",
  },
  sourceNames: {
    rain: "Lluvia",
    vegetation: "Vegetación",
    terrain: "Relieve",
    soil: "Suelo",
    climate: "Clima",
  },
  sourceStatus: {
    noData: "Sin datos",
    error: "No disponible",
    retrying: "Consultando",
  },
  scope: {
    heading: "Estos números describen",
    parcelPolygon: {
      tag: "Tu parcela",
      sentence: "Se calcularon con los píxeles que caen dentro del contorno que dibujaste.",
    },
    parcelBuffer: {
      tag: "El cuadrado analizado",
      sentence:
        "Se calcularon con los píxeles que caen dentro del cuadrado alrededor del punto. No es el lindero real de una finca.",
    },
    pixel: {
      tag: "Un solo píxel",
      sentence:
        "Es el valor del píxel que contiene el punto elegido, no un promedio de toda el área.",
    },
    regional: {
      tag: "La región, no tu parcela",
      sentence:
        "El píxel de este producto es más grande que el área analizada. El dato describe los alrededores y no es una medición de la parcela.",
    },
    unknown: {
      tag: "Alcance no indicado",
      sentence: "La fuente no indicó si el dato es de la parcela o de la región.",
    },
  },
  aggregation: {
    mean: "promedio",
    sum: "suma",
    min: "mínimo",
    max: "máximo",
    median: "mediana",
    count: "conteo",
    share: "proporción",
    "coefficient-of-variation": "variación relativa",
    value: "valor",
  },
  metrics: {
    heading: "Datos principales",
    none: "Esta fuente no entregó cifras resumidas.",
    at: "Corresponde a {moment}",
  },
  provenance: {
    cached: "Dato guardado. Se obtuvo el {date}.",
    fresh: "Consultado el {date}.",
    cachedUndated: "Dato guardado de una consulta anterior.",
    freshUndated: "Consultado para este análisis.",
  },
  noData: {
    fallback:
      "El servicio respondió, pero no hubo observaciones válidas para esta área y este período.",
    examined: "Lo que se revisó",
    examinedPeriod: "Período: {period}.",
    examinedObservations: "{valid} de {expected} observaciones resultaron válidas.",
    examinedValidOnly: "Observaciones válidas: {valid}.",
    examinedUnknown: "La fuente no informó cuántas observaciones revisó.",
  },
  error: {
    title: "No se pudo obtener este dato",
    codes: {
      timeout: "El servicio de datos tardó demasiado en responder.",
      network: "No se pudo conectar con el servicio de datos.",
      "rate-limited":
        "El servicio de datos recibió demasiadas consultas. Espera un momento y vuelve a intentar.",
      "upstream-error": "El servicio de datos respondió con un error.",
      "bad-response": "El servicio de datos respondió con algo que no se pudo leer.",
      "no-coverage": "Este producto no cubre la ubicación elegida.",
      aborted: "La consulta se canceló antes de terminar.",
      "not-configured": "Esta fuente todavía no está configurada en el servidor.",
      "not-implemented": "Esta fuente todavía no está conectada.",
      unexpected: "Ocurrió un error inesperado al consultar esta fuente.",
    },
    unknownCode: "No se pudo consultar esta fuente (código: {code}).",
    notRetryable: "Reintentar no lo resuelve por ahora.",
    retry: "Reintentar",
    retrying: "Consultando de nuevo…",
    retryLabel: "Reintentar {source}",
  },
  details: {
    summary: "Fuentes y limitaciones",
    product: "Producto",
    version: "Versión",
    provider: "Quién lo produce",
    accessedVia: "Se consultó a través de",
    pixelSize: "Tamaño del píxel",
    temporalResolution: "Frecuencia de los datos",
    documentation: "Documentación",
    documentationLink: "Documentación oficial del producto",
    period: "Período de los datos",
    periodStatic: "No depende del período",
    quality: "Calidad",
    validOfExpected: "{valid} de {expected} observaciones válidas",
    validOnly: "{valid} observaciones válidas",
    coverage: "cobertura de {coverage}",
    qualityNotes: "Notas de calidad",
    limitations: "Limitaciones",
    conversions: "Conversiones de unidades",
    errorDetail: "Detalle técnico del error",
    duration: "Tiempo de consulta",
    noneDeclared: "Ninguna declarada",
  },
  temporal: {
    daily: "Diaria",
    monthly: "Mensual",
    "per-scene": "Por escena (cada pasada del satélite)",
    climatology: "Promedio de muchos años",
    static: "Fija, no cambia con el tiempo",
  },
  rain: {
    range: "entre {min} y {max}",
    empty: "No hay serie mensual de lluvia para mostrar.",
  },
  vegetation: {
    scenes: "{usable} de {total} escenas utilizables",
    months: "{usable} de {total} meses con observación utilizable",
    clearRule: "Una escena cuenta cuando al menos {share} del área está despejada.",
    pixels: "Píxeles de Landsat dentro del área: {count}.",
    threshold:
      "Con un NDVI menor que {value}, la señal es compatible con poca o ninguna vegetación. El índice no dice qué cultivo hay ni si está sano.",
    tableToggle: "Ver los valores mes a mes",
    columnMonth: "Mes",
    columnNdvi: "NDVI",
    columnScenes: "Escenas",
    scenesOfTotal: "{usable} de {total}",
    noScenes: "ninguna",
    empty: "No hay observaciones de vegetación para mostrar.",
  },
  terrain: {
    slopeTitle: "Cómo se reparte la pendiente",
    slopeCaption: "Parte de los puntos de elevación que cae en cada clase de pendiente.",
    classes: {
      flat: "Plano",
      gentle: "Suave",
      moderate: "Moderado",
      steep: "Fuerte",
    },
    rangeBetween: "de {from} a {to} %",
    rangeFrom: "{from} % o más",
    samples: "{valid} de {samples} puntos de elevación con valor, uno cada {spacing}.",
    empty: "No hay clases de pendiente para mostrar.",
  },
  soil: {
    tableTitle: "Propiedades por profundidad",
    columnProperty: "Propiedad",
    properties: {
      clay: "Arcilla",
      sand: "Arena",
      silt: "Limo",
      phh2o: "pH en agua",
      soc: "Carbono orgánico",
    },
    depths: {
      "0-5cm": "0–5 cm",
      "5-15cm": "5–15 cm",
      "15-30cm": "15–30 cm",
    },
    empty: "No hay capas de suelo para mostrar.",
  },
  climate: {
    tableTitle: "Temperatura de cada mes",
    columnMonth: "Mes",
    columnMean: "Media",
    columnMax: "Máxima",
    columnMin: "Mínima",
    unitNote: "Valores en °C.",
    gridElevation: "La celda del producto corresponde a una altitud de {elevation}.",
    empty: "No hay temperaturas mensuales para mostrar.",
  },
  elevationCheck: {
    title: "La temperatura es de otra altitud",
    body: "La temperatura regional corresponde a una celda a {grid} de altitud. El área analizada está en promedio a {terrain}: {difference} de diferencia. La temperatura real del terreno puede ser distinta de la que se muestra.",
  },
  loader: {
    sourcesLabel: "Estado de cada fuente",
    states: {
      waiting: "En espera",
      running: "Consultando",
      done: "Listo",
      failed: "Falló",
    },
  },
};

const en: ResultsDictionary = {
  locale: "en",
  panelLabel: "Analysis results",
  missing: "no data",
  status: {
    complete: {
      tag: "Complete",
      title: "Complete analysis",
      body: "Every source answered with data for this land.",
    },
    partial: {
      tag: "Partial",
      title: "Partial analysis",
      body: "Some sources gave no data. Below you see what was obtained and what is missing.",
    },
    failed: {
      tag: "No results",
      title: "The land could not be analysed",
      body: "No source returned data. You can retry each one below.",
    },
  },
  header: {
    sourcesWithData: "{count} of {total} sources with data",
    location: "Location",
    coordinates: "Lat {lat}, Lon {lon}",
    area: "Area analysed",
    areaBuffer: "Square with {side} sides around the point",
    areaPolygon: "Outline drawn on the map",
    areaSize: "Size: {hectares}",
    period: "Period analysed",
    periodNote: "Terrain and soil do not change with the period.",
    missingTitle: "What is missing",
    missingError: "{source}: could not be queried.",
    missingNoData: "{source}: no valid observations.",
  },
  sourceNames: {
    rain: "Rain",
    vegetation: "Vegetation",
    terrain: "Terrain",
    soil: "Soil",
    climate: "Climate",
  },
  sourceStatus: {
    noData: "No data",
    error: "Unavailable",
    retrying: "Querying",
  },
  scope: {
    heading: "These numbers describe",
    parcelPolygon: {
      tag: "Your plot",
      sentence: "They were computed from the pixels that fall inside the outline you drew.",
    },
    parcelBuffer: {
      tag: "The analysed square",
      sentence:
        "They were computed from the pixels that fall inside the square around the point. It is not the real boundary of a farm.",
    },
    pixel: {
      tag: "A single pixel",
      sentence:
        "It is the value of the pixel that contains the chosen point, not an average of the whole area.",
    },
    regional: {
      tag: "The region, not your plot",
      sentence:
        "This product's pixel is larger than the analysed area. The figure describes the surroundings and is not a measurement of the plot.",
    },
    unknown: {
      tag: "Scope not stated",
      sentence: "The source did not say whether the figure is for the plot or for the region.",
    },
  },
  aggregation: {
    mean: "mean",
    sum: "sum",
    min: "minimum",
    max: "maximum",
    median: "median",
    count: "count",
    share: "share",
    "coefficient-of-variation": "relative variation",
    value: "value",
  },
  metrics: {
    heading: "Main figures",
    none: "This source returned no summary figures.",
    at: "Belongs to {moment}",
  },
  provenance: {
    cached: "Saved data. It was obtained on {date}.",
    fresh: "Queried on {date}.",
    cachedUndated: "Saved data from an earlier query.",
    freshUndated: "Queried for this analysis.",
  },
  noData: {
    fallback: "The service answered, but there were no valid observations for this area and period.",
    examined: "What was examined",
    examinedPeriod: "Period: {period}.",
    examinedObservations: "{valid} of {expected} observations were valid.",
    examinedValidOnly: "Valid observations: {valid}.",
    examinedUnknown: "The source did not report how many observations it examined.",
  },
  error: {
    title: "This figure could not be obtained",
    codes: {
      timeout: "The data service took too long to answer.",
      network: "The data service could not be reached.",
      "rate-limited": "The data service received too many queries. Wait a moment and try again.",
      "upstream-error": "The data service answered with an error.",
      "bad-response": "The data service answered with something that could not be read.",
      "no-coverage": "This product does not cover the chosen location.",
      aborted: "The query was cancelled before it finished.",
      "not-configured": "This source is not configured on the server yet.",
      "not-implemented": "This source is not connected yet.",
      unexpected: "An unexpected error happened while querying this source.",
    },
    unknownCode: "This source could not be queried (code: {code}).",
    notRetryable: "Retrying will not fix it for now.",
    retry: "Retry",
    retrying: "Querying again…",
    retryLabel: "Retry {source}",
  },
  details: {
    summary: "Sources and limitations",
    product: "Product",
    version: "Version",
    provider: "Produced by",
    accessedVia: "Accessed via",
    pixelSize: "Pixel size",
    temporalResolution: "How often the data comes",
    documentation: "Documentation",
    documentationLink: "Official product documentation",
    period: "Period of the data",
    periodStatic: "Does not depend on the period",
    quality: "Quality",
    validOfExpected: "{valid} of {expected} valid observations",
    validOnly: "{valid} valid observations",
    coverage: "{coverage} coverage",
    qualityNotes: "Quality notes",
    limitations: "Limitations",
    conversions: "Unit conversions",
    errorDetail: "Technical detail of the error",
    duration: "Query time",
    noneDeclared: "None declared",
  },
  temporal: {
    daily: "Daily",
    monthly: "Monthly",
    "per-scene": "Per scene (each satellite pass)",
    climatology: "Average of many years",
    static: "Fixed, does not change over time",
  },
  rain: {
    range: "between {min} and {max}",
    empty: "There is no monthly rain series to show.",
  },
  vegetation: {
    scenes: "{usable} of {total} scenes usable",
    months: "{usable} of {total} months with a usable observation",
    clearRule: "A scene counts when at least {share} of the area is clear.",
    pixels: "Landsat pixels inside the area: {count}.",
    threshold:
      "With an NDVI below {value}, the signal is compatible with little or no vegetation. The index does not say which crop is there or whether it is healthy.",
    tableToggle: "See the values month by month",
    columnMonth: "Month",
    columnNdvi: "NDVI",
    columnScenes: "Scenes",
    scenesOfTotal: "{usable} of {total}",
    noScenes: "none",
    empty: "There are no vegetation observations to show.",
  },
  terrain: {
    slopeTitle: "How the slope is spread",
    slopeCaption: "Share of the elevation points that falls in each slope class.",
    classes: {
      flat: "Flat",
      gentle: "Gentle",
      moderate: "Moderate",
      steep: "Steep",
    },
    rangeBetween: "{from} to {to}%",
    rangeFrom: "{from}% or more",
    samples: "{valid} of {samples} elevation points with a value, one every {spacing}.",
    empty: "There are no slope classes to show.",
  },
  soil: {
    tableTitle: "Properties by depth",
    columnProperty: "Property",
    properties: {
      clay: "Clay",
      sand: "Sand",
      silt: "Silt",
      phh2o: "pH in water",
      soc: "Organic carbon",
    },
    depths: {
      "0-5cm": "0–5 cm",
      "5-15cm": "5–15 cm",
      "15-30cm": "15–30 cm",
    },
    empty: "There are no soil layers to show.",
  },
  climate: {
    tableTitle: "Temperature in each month",
    columnMonth: "Month",
    columnMean: "Mean",
    columnMax: "Maximum",
    columnMin: "Minimum",
    unitNote: "Values in °C.",
    gridElevation: "The product's grid cell corresponds to an altitude of {elevation}.",
    empty: "There are no monthly temperatures to show.",
  },
  elevationCheck: {
    title: "The temperature is for another altitude",
    body: "The regional temperature corresponds to a grid cell at {grid} of altitude. The analysed area is at {terrain} on average: a difference of {difference}. The real temperature on the land may differ from the one shown.",
  },
  loader: {
    sourcesLabel: "State of each source",
    states: {
      waiting: "Waiting",
      running: "Querying",
      done: "Done",
      failed: "Failed",
    },
  },
};

export const RESULTS_DICTIONARY: Readonly<Record<Locale, ResultsDictionary>> = { es, en };

/** The dictionary for a language. Falls back to Spanish, the site's default. */
export function getResultsDictionary(locale: Locale): ResultsDictionary {
  return RESULTS_DICTIONARY[locale] ?? RESULTS_DICTIONARY.es;
}

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

/**
 * Replaces each `{name}` in a template with its value. A placeholder with no
 * value is left as written, so a missing value is visible instead of silent.
 */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(PLACEHOLDER_PATTERN, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}

/** Names of the placeholders in a template, in order of appearance. */
export function placeholdersOf(template: string): readonly string[] {
  return Array.from(template.matchAll(PLACEHOLDER_PATTERN), (match) => match[1]);
}
