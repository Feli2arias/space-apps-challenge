import type { Locale } from "@/lib/site";

/**
 * Sentence templates for the plain report that opens each source tab, the
 * "Terreno escaneado" box, and friendlier labels for the main figures.
 * Templates are filled only with values read from the analysis; a sentence
 * whose values are missing is left out, never filled with a zero.
 */
export interface ReportDictionary {
  /** Where the numbers come from, said inside the sentence. */
  readonly where: {
    readonly parcelPolygon: string;
    readonly parcelBuffer: string;
    readonly pixel: string;
    readonly regional: string;
    readonly unknown: string;
  };
  readonly rain: {
    /** {where} {amount} */
    readonly annual: string;
    /** {wettest} {driest} */
    readonly months: string;
    readonly wettestOnly: string;
    readonly driestOnly: string;
  };
  readonly vegetation: {
    /** {where} {examined} {usable} */
    readonly scenes: string;
    readonly scenesOne: string;
    /** {where} {usable} */
    readonly usableOnly: string;
    readonly noneLow: string;
    /** {share} {threshold} */
    readonly someLow: string;
  };
  readonly terrain: {
    /** {where} {elevation} {slope} */
    readonly both: string;
    readonly elevationOnly: string;
    readonly slopeOnly: string;
    /** {name} */
    readonly commonClass: string;
  };
  readonly soil: {
    /** {where} {parts} */
    readonly texture: string;
    /** {value} */
    readonly clay: string;
    readonly sand: string;
    readonly silt: string;
    /** {ph} {kind} */
    readonly ph: string;
    readonly acid: string;
    readonly neutral: string;
    readonly alkaline: string;
  };
  readonly climate: {
    /** {where} {mean} */
    readonly mean: string;
    /** {warmest} {coolest} */
    readonly months: string;
    readonly warmestOnly: string;
    readonly coolestOnly: string;
  };
  readonly empty: string;
  readonly noData: string;
  readonly failed: string;
  /** Friendlier names for the main figures; the catalogue's name is used for the rest. */
  readonly labels: Readonly<Record<string, string>>;
  /** One plain line under each highlighted figure: what the measure is, never a verdict. */
  readonly explain: Readonly<Record<string, string>>;
  readonly plot: {
    readonly title: string;
    readonly placeLoading: string;
    readonly noPlace: string;
    /** {attribution} */
    readonly placeSource: string;
    readonly areaSquare: string;
    readonly areaOutline: string;
    readonly analyseAnother: string;
    readonly backToResults: string;
    /** {coordinates} */
    readonly backNote: string;
    readonly missing: string;
    /** What the small button of the box does, when it is open and when it is closed. */
    readonly collapse: string;
    readonly expand: string;
    /** Written on the button when the box is closed. */
    readonly expandShort: string;
  };
}

const es: ReportDictionary = {
  where: {
    parcelPolygon: "dentro de tu parcela",
    parcelBuffer: "dentro del cuadrado analizado",
    pixel: "en el píxel que contiene el punto",
    regional: "en la región alrededor del terreno",
    unknown: "en el área consultada",
  },
  rain: {
    annual: "Llueve unos {amount} al año {where}.",
    months: "El mes más lluvioso es {wettest} y el más seco, {driest}.",
    wettestOnly: "El mes más lluvioso es {wettest}.",
    driestOnly: "El mes más seco es {driest}.",
  },
  vegetation: {
    scenes: "De {examined} pasadas del satélite revisadas {where}, {usable} mostraron el terreno sin nubes.",
    scenesOne: "De {examined} pasada del satélite revisada {where}, {usable} mostró el terreno sin nubes.",
    usableOnly: "{usable} pasadas del satélite mostraron el terreno sin nubes {where}.",
    noneLow: "En ninguna de ellas el verdor fue bajo.",
    someLow:
      "En el {share} de ellas el verdor fue bajo (NDVI menor que {threshold}), algo compatible con poca o ninguna vegetación.",
  },
  terrain: {
    both: "El terreno {where} está a unos {elevation} de altura y tiene una pendiente media de {slope}.",
    elevationOnly: "El terreno {where} está a unos {elevation} de altura.",
    slopeOnly: "El terreno {where} tiene una pendiente media de {slope}.",
    commonClass: "La clase de pendiente más frecuente es «{name}».",
  },
  soil: {
    texture: "El suelo {where} tiene {parts}.",
    clay: "{value} de arcilla",
    sand: "{value} de arena",
    silt: "{value} de limo",
    ph: "Su pH es {ph}: {kind}.",
    acid: "ácido (menos de 7)",
    neutral: "neutro (igual a 7)",
    alkaline: "alcalino (más de 7)",
  },
  climate: {
    mean: "La temperatura media {where} es de {mean}.",
    months: "El mes más cálido es {warmest} y el más fresco, {coolest}.",
    warmestOnly: "El mes más cálido es {warmest}.",
    coolestOnly: "El mes más fresco es {coolest}.",
  },
  empty: "Esta fuente respondió, pero sin las cifras necesarias para resumirla en una frase.",
  noData: "No hubo observaciones válidas para este terreno en el período.",
  failed: "No se pudo consultar. Puedes reintentarlo en su pestaña.",
  labels: {
    "rain.annualMean": "Lluvia en un año",
    "rain.wettestMonth": "Mes más lluvioso",
    "rain.driestMonth": "Mes más seco",
    "rain.interannualCv": "Cuánto cambia de un año a otro",
    "vegetation.ndviMean": "Verdor medio (NDVI)",
    "vegetation.ndviLatest": "Verdor más reciente (NDVI)",
    "vegetation.usableObservations": "Imágenes sin nubes",
    "vegetation.monthsWithoutObservation": "Meses sin imagen clara",
    "terrain.elevationMean": "Altura media",
    "terrain.slopeMeanPercent": "Pendiente media",
    "terrain.slopeMaxPercent": "Pendiente máxima",
    "terrain.relief": "Desnivel",
    "soil.clay": "Arcilla",
    "soil.sand": "Arena",
    "soil.silt": "Limo",
    "soil.ph": "pH",
    "soil.organicCarbon": "Carbono orgánico",
    "climate.annualMeanTemperature": "Temperatura media",
    "climate.warmestMonth": "Mes más cálido",
    "climate.coolestMonth": "Mes más fresco",
  },
  explain: {
    "rain.annualMean": "Promedio de lluvia de un año completo en el período.",
    "rain.wettestMonth": "El mes que, en promedio, recibe más lluvia.",
    "rain.driestMonth": "El mes que, en promedio, recibe menos lluvia.",
    "rain.interannualCv": "Cuánto cambia el total de un año a otro.",
    "vegetation.ndviMean": "Índice de verdor visto por satélite: cuanto más alto, más verde.",
    "vegetation.ndviLatest": "El verdor en la última imagen despejada.",
    "vegetation.usableObservations": "Pasadas del satélite en que el terreno se vio sin nubes.",
    "vegetation.monthsWithoutObservation": "Meses del período sin ninguna imagen despejada.",
    "terrain.elevationMean": "Altura promedio sobre el nivel del mar.",
    "terrain.slopeMeanPercent": "Inclinación promedio: metros que sube por cada 100 m.",
    "terrain.slopeMaxPercent": "La inclinación más fuerte medida en el área.",
    "terrain.relief": "Diferencia entre el punto más alto y el más bajo.",
    "soil.ph": "Acidez del suelo: menos de 7 es ácido; más de 7, alcalino.",
    "soil.clay": "Parte de partículas más finas en la capa superior.",
    "soil.sand": "Parte de partículas más gruesas en la capa superior.",
    "soil.silt": "Parte de partículas intermedias en la capa superior.",
    "soil.organicCarbon": "Carbono que viene de restos de plantas y animales.",
    "climate.annualMeanTemperature": "Temperatura promedio del aire a lo largo del año.",
    "climate.warmestMonth": "El mes con la temperatura media más alta.",
    "climate.coolestMonth": "El mes con la temperatura media más baja.",
  },
  plot: {
    title: "Terreno escaneado",
    placeLoading: "Buscando el nombre del lugar…",
    noPlace: "Sin localidad conocida en este punto",
    placeSource: "Lugar: {attribution}",
    areaSquare: "cuadrado de {side} de lado",
    areaOutline: "contorno dibujado",
    analyseAnother: "Analizar otro terreno",
    backToResults: "Volver a los resultados",
    backNote: "Tienes resultados de {coordinates}. Elige otro lugar o vuelve a ellos.",
    missing: "Falta",
    collapse: "Ocultar los datos del terreno",
    expand: "Mostrar los datos del terreno",
    expandShort: "Mostrar",
  },
};

const en: ReportDictionary = {
  where: {
    parcelPolygon: "inside your plot",
    parcelBuffer: "inside the analysed square",
    pixel: "in the pixel that contains the point",
    regional: "in the region around the plot",
    unknown: "in the area queried",
  },
  rain: {
    annual: "About {amount} of rain falls per year {where}.",
    months: "The wettest month is {wettest} and the driest, {driest}.",
    wettestOnly: "The wettest month is {wettest}.",
    driestOnly: "The driest month is {driest}.",
  },
  vegetation: {
    scenes: "Of {examined} satellite passes checked {where}, {usable} showed the plot free of clouds.",
    scenesOne: "Of {examined} satellite pass checked {where}, {usable} showed the plot free of clouds.",
    usableOnly: "{usable} satellite passes showed the plot free of clouds {where}.",
    noneLow: "In none of them was the greenness low.",
    someLow:
      "In {share} of them the greenness was low (NDVI below {threshold}), which fits little or no vegetation.",
  },
  terrain: {
    both: "The land {where} sits at about {elevation} and has a mean slope of {slope}.",
    elevationOnly: "The land {where} sits at about {elevation}.",
    slopeOnly: "The land {where} has a mean slope of {slope}.",
    commonClass: "The most common slope class is “{name}”.",
  },
  soil: {
    texture: "The soil {where} has {parts}.",
    clay: "{value} clay",
    sand: "{value} sand",
    silt: "{value} silt",
    ph: "Its pH is {ph}: {kind}.",
    acid: "acidic (below 7)",
    neutral: "neutral (exactly 7)",
    alkaline: "alkaline (above 7)",
  },
  climate: {
    mean: "The mean temperature {where} is {mean}.",
    months: "The warmest month is {warmest} and the coolest, {coolest}.",
    warmestOnly: "The warmest month is {warmest}.",
    coolestOnly: "The coolest month is {coolest}.",
  },
  empty: "This source answered, but without the figures needed to sum it up in a sentence.",
  noData: "There were no valid observations for this plot in the period.",
  failed: "It could not be queried. You can retry it in its tab.",
  labels: {
    "rain.annualMean": "Rain in a year",
    "rain.wettestMonth": "Wettest month",
    "rain.driestMonth": "Driest month",
    "rain.interannualCv": "How much it changes year to year",
    "vegetation.ndviMean": "Mean greenness (NDVI)",
    "vegetation.ndviLatest": "Latest greenness (NDVI)",
    "vegetation.usableObservations": "Cloud-free images",
    "vegetation.monthsWithoutObservation": "Months without a clear image",
    "terrain.elevationMean": "Mean height",
    "terrain.slopeMeanPercent": "Mean slope",
    "terrain.slopeMaxPercent": "Steepest slope",
    "terrain.relief": "Height difference",
    "soil.clay": "Clay",
    "soil.sand": "Sand",
    "soil.silt": "Silt",
    "soil.ph": "pH",
    "soil.organicCarbon": "Organic carbon",
    "climate.annualMeanTemperature": "Mean temperature",
    "climate.warmestMonth": "Warmest month",
    "climate.coolestMonth": "Coolest month",
  },
  explain: {
    "rain.annualMean": "Average rain over a full year in the period.",
    "rain.wettestMonth": "The month that gets the most rain on average.",
    "rain.driestMonth": "The month that gets the least rain on average.",
    "rain.interannualCv": "How much the total changes from one year to the next.",
    "vegetation.ndviMean": "Greenness index seen by satellite: the higher, the greener.",
    "vegetation.ndviLatest": "Greenness in the latest clear image.",
    "vegetation.usableObservations": "Satellite passes in which the plot was seen without clouds.",
    "vegetation.monthsWithoutObservation": "Months of the period with no clear image at all.",
    "terrain.elevationMean": "Average height above sea level.",
    "terrain.slopeMeanPercent": "Average incline: metres of rise per 100 m.",
    "terrain.slopeMaxPercent": "The steepest incline measured in the area.",
    "terrain.relief": "Difference between the highest and lowest point.",
    "soil.ph": "Soil acidity: below 7 is acidic; above 7, alkaline.",
    "soil.clay": "Share of the finest particles in the top layer.",
    "soil.sand": "Share of the coarsest particles in the top layer.",
    "soil.silt": "Share of mid-sized particles in the top layer.",
    "soil.organicCarbon": "Carbon that comes from plant and animal remains.",
    "climate.annualMeanTemperature": "Average air temperature through the year.",
    "climate.warmestMonth": "The month with the highest mean temperature.",
    "climate.coolestMonth": "The month with the lowest mean temperature.",
  },
  plot: {
    title: "Scanned plot",
    placeLoading: "Looking up the place name…",
    noPlace: "No known place at this point",
    placeSource: "Place: {attribution}",
    areaSquare: "square of {side} per side",
    areaOutline: "drawn outline",
    analyseAnother: "Analyse another plot",
    backToResults: "Back to the results",
    backNote: "You have results for {coordinates}. Choose another place or go back to them.",
    missing: "Missing",
    collapse: "Hide the plot details",
    expand: "Show the plot details",
    expandShort: "Show",
  },
};

export const REPORT_DICTIONARY: Readonly<Record<Locale, ReportDictionary>> = { es, en };

/** The report words for a language; Spanish when the language is unknown. */
export function getReportDictionary(locale: Locale): ReportDictionary {
  return Object.hasOwn(REPORT_DICTIONARY, locale) ? REPORT_DICTIONARY[locale] : es;
}
