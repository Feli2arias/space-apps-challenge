import type { LocalizedSourceMessages, SourceMessages } from "../types";
import type {
  VegetationConversion,
  VegetationLimitation,
  VegetationMetricId,
  VegetationQualityNote,
  VegetationStage,
} from "./landsat-codes";

/**
 * Words for every code the vegetation source emits, in Spanish and English.
 * Text only: this file is loaded by the browser.
 *
 * The numbers written here (0.2, 75 %, 36 months, 30 m) repeat constants of
 * the source; vegetation.messages.test.ts fails if they drift apart.
 */

/** Same shape as `SourceMessages`, but a missing code is a compile error. */
interface VegetationCatalogue extends SourceMessages {
  readonly metrics: Readonly<Record<VegetationMetricId, { readonly label: string; readonly help: string }>>;
  readonly limitations: Readonly<Record<VegetationLimitation, string>>;
  readonly qualityNotes: Readonly<Record<VegetationQualityNote, string>>;
  readonly conversions: Readonly<Record<VegetationConversion, string>>;
  readonly stages: Readonly<Record<VegetationStage, string>>;
}

const es: VegetationCatalogue = {
  title: "Vegetación",
  summary:
    "Qué tan verde se ha visto el terreno desde los satélites Landsat 8 y 9, fecha por fecha, contando solo los días sin nubes.",
  scope: {
    parcel:
      "Los valores resumen los píxeles de Landsat, de 30 m de lado, cuyo centro cae dentro del terreno.",
    pixel:
      "El terreno es más pequeño que dos píxeles de Landsat. Los valores son del píxel de 30 m que contiene el centro del terreno, y ese píxel incluye también lo que lo rodea.",
  },
  metrics: {
    "vegetation.ndviMean": {
      label: "NDVI promedio",
      help: "Promedio del índice de vegetación en las fechas con vista despejada. El índice va de -1 a 1: cuanto más alto, más vegetación verde.",
    },
    "vegetation.ndviMin": {
      label: "NDVI más bajo",
      help: "El promedio más bajo que tuvo el terreno entre las fechas con vista despejada, y el día en que ocurrió.",
    },
    "vegetation.ndviMax": {
      label: "NDVI más alto",
      help: "El promedio más alto que tuvo el terreno entre las fechas con vista despejada, y el día en que ocurrió.",
    },
    "vegetation.ndviLatest": {
      label: "NDVI más reciente",
      help: "El promedio del terreno en la última fecha con vista despejada del periodo.",
    },
    "vegetation.usableObservations": {
      label: "Fechas con vista despejada",
      help: "Pasadas del satélite en las que al menos el 75 % del terreno se vio sin nubes ni sombras. Solo estas fechas entran en los cálculos.",
    },
    "vegetation.monthsWithoutObservation": {
      label: "Meses sin vista despejada",
      help: "Meses del periodo en los que ninguna pasada del satélite mostró el terreno despejado. De esos meses no hay dato.",
    },
    "vegetation.lowVegetationShare": {
      label: "Fechas con poca vegetación",
      help: "Porcentaje de las fechas despejadas con NDVI promedio menor que 0.2. Un valor así es compatible con poca o ninguna vegetación; no dice por qué.",
    },
    "vegetation.scenesFound": {
      label: "Imágenes encontradas",
      help: "Imágenes de Landsat 8 y 9 que cubren el terreno en el periodo, estén nubladas o no.",
    },
    "vegetation.scenesExamined": {
      label: "Imágenes revisadas",
      help: "Imágenes que se leyeron píxel por píxel sobre el terreno.",
    },
    "vegetation.scenesNotTier1": {
      label: "Imágenes de menor calidad, no usadas",
      help: "Imágenes que USGS clasifica fuera de su mejor nivel de calidad (Tier 1). No se leen.",
    },
    "vegetation.scenesNotRead": {
      label: "Imágenes que no se pudieron leer",
      help: "Imágenes que el servicio no entregó o que no dio tiempo a leer. Sus fechas faltan en la serie.",
    },
    "vegetation.scenesSameDate": {
      label: "Imágenes repetidas del mismo día",
      help: "Imágenes revisadas que repiten una pasada ya contada. Se cuenta una sola por día.",
    },
  },
  limitations: {
    "ndvi-is-not-a-diagnosis":
      "El NDVI mide qué tan verde y densa se ve la vegetación desde el satélite. No dice qué cultivo hay, ni si hubo labranza, plagas o enfermedades.",
    "low-vegetation-threshold-is-a-convention":
      "El límite de 0.2 es una convención de uso común, no una medida de tu terreno. Un NDVI por debajo solo es compatible con poca o ninguna vegetación.",
    "cloud-mask-can-miss-clouds":
      "La máscara de nubes de Landsat no es perfecta: a veces deja pasar nubes finas, bruma o sombras. Un valor bajo en una sola fecha puede deberse a eso.",
    "mean-favours-clear-months":
      "El promedio usa solo las fechas despejadas. Los meses secos, con más cielo despejado, pesan más que los meses lluviosos.",
    "period-capped":
      "Para la vegetación se usan solo los últimos 36 meses del periodo pedido. Leer más años de imágenes tardaría demasiado.",
    "tier-2-scenes-not-used":
      "No se usan las imágenes que USGS deja fuera de su mejor nivel de calidad (Tier 1). En pruebas en Los Chiles, Costa Rica, 4 de 9 de esas imágenes daban por despejado un terreno cubierto de nubes.",
    "same-date-scenes-counted-once":
      "A veces una misma pasada del satélite llega como dos imágenes tomadas con segundos de diferencia. Se cuenta una sola: aquella donde el terreno se ve más despejado.",
    "single-pixel":
      "Un píxel de Landsat mide 30 m de lado (900 m²). Con un terreno tan pequeño, el valor mezcla tu terreno con sus alrededores.",
    "edge-pixels-mixed":
      "El terreno abarca pocos píxeles de 30 m. Todos tocan el borde y mezclan tu terreno con lo que hay al lado.",
  },
  qualityNotes: {
    "months-without-observation":
      "Hay meses sin ninguna vista despejada: las nubes taparon el terreno en todas las pasadas. Es común en la temporada de lluvias. En el norte de Costa Rica, entre julio y noviembre es frecuente que haya una sola fecha despejada al mes, o ninguna.",
    "scenes-not-read":
      "Algunas imágenes no se pudieron leer del servicio. Sus fechas faltan en la serie.",
    "time-budget-reached":
      "Se acabó el tiempo previsto antes de leer todas las imágenes. Faltan las más antiguas.",
  },
  conversions: {
    "reflectance-scale-and-offset":
      "Los números guardados en cada imagen se convierten a reflectancia de superficie con la escala y el desplazamiento que publica la propia imagen (valor × 0.0000275 − 0.2). El NDVI se calcula con esa reflectancia: (infrarrojo cercano − rojo) / (infrarrojo cercano + rojo).",
  },
  stages: {
    searching: "Buscando imágenes Landsat de tu terreno…",
    "reading-scenes": "Revisando las imágenes una por una y descartando las nubes…",
  },
  noData:
    "No hay ninguna imagen Landsat del periodo en la que el terreno se vea lo bastante despejado. Por eso no se muestra ningún valor de vegetación.",
};

const en: VegetationCatalogue = {
  title: "Vegetation",
  summary:
    "How green the plot has looked from the Landsat 8 and 9 satellites, date by date, counting only the days without clouds.",
  scope: {
    parcel:
      "The values summarise the Landsat pixels, 30 m on a side, whose centre falls inside the plot.",
    pixel:
      "The plot is smaller than two Landsat pixels. The values belong to the 30 m pixel that contains the centre of the plot, and that pixel also includes what surrounds it.",
  },
  metrics: {
    "vegetation.ndviMean": {
      label: "Average NDVI",
      help: "Average of the vegetation index on the dates with a clear view. The index goes from -1 to 1: the higher, the more green vegetation.",
    },
    "vegetation.ndviMin": {
      label: "Lowest NDVI",
      help: "The lowest average the plot had among the dates with a clear view, and the day it happened.",
    },
    "vegetation.ndviMax": {
      label: "Highest NDVI",
      help: "The highest average the plot had among the dates with a clear view, and the day it happened.",
    },
    "vegetation.ndviLatest": {
      label: "Most recent NDVI",
      help: "The average of the plot on the last date of the period with a clear view.",
    },
    "vegetation.usableObservations": {
      label: "Dates with a clear view",
      help: "Satellite passes in which at least 75 % of the plot was seen without clouds or shadows. Only these dates enter the calculations.",
    },
    "vegetation.monthsWithoutObservation": {
      label: "Months without a clear view",
      help: "Months of the period in which no satellite pass showed the plot clear. There is no data for those months.",
    },
    "vegetation.lowVegetationShare": {
      label: "Dates with little vegetation",
      help: "Percentage of the clear dates with an average NDVI below 0.2. Such a value is compatible with little or no vegetation; it does not say why.",
    },
    "vegetation.scenesFound": {
      label: "Images found",
      help: "Landsat 8 and 9 images that cover the plot in the period, cloudy or not.",
    },
    "vegetation.scenesExamined": {
      label: "Images examined",
      help: "Images that were read pixel by pixel over the plot.",
    },
    "vegetation.scenesNotTier1": {
      label: "Lower-quality images, not used",
      help: "Images that USGS places outside its best quality level (Tier 1). They are not read.",
    },
    "vegetation.scenesNotRead": {
      label: "Images that could not be read",
      help: "Images the service did not deliver or that there was no time to read. Their dates are missing from the series.",
    },
    "vegetation.scenesSameDate": {
      label: "Repeated images of the same day",
      help: "Examined images that repeat a pass already counted. Only one per day is counted.",
    },
  },
  limitations: {
    "ndvi-is-not-a-diagnosis":
      "NDVI measures how green and dense the vegetation looks from the satellite. It does not say which crop is there, or whether there was tillage, pests or disease.",
    "low-vegetation-threshold-is-a-convention":
      "The 0.2 limit is a commonly used convention, not a measurement of your plot. An NDVI below it is only compatible with little or no vegetation.",
    "cloud-mask-can-miss-clouds":
      "The Landsat cloud mask is not perfect: it sometimes lets thin clouds, haze or shadows through. A low value on a single date may be due to that.",
    "mean-favours-clear-months":
      "The average uses only the clear dates. Dry months, with more clear sky, weigh more than rainy months.",
    "period-capped":
      "For vegetation only the last 36 months of the requested period are used. Reading more years of images would take too long.",
    "tier-2-scenes-not-used":
      "Images that USGS leaves outside its best quality level (Tier 1) are not used. In tests in Los Chiles, Costa Rica, 4 of 9 of those images reported a cloud-covered plot as clear.",
    "same-date-scenes-counted-once":
      "Sometimes one satellite pass arrives as two images taken seconds apart. Only one is counted: the one where the plot looks clearer.",
    "single-pixel":
      "A Landsat pixel is 30 m on a side (900 m²). With a plot this small, the value mixes your plot with its surroundings.",
    "edge-pixels-mixed":
      "The plot covers few 30 m pixels. All of them touch the edge and mix your plot with what is next to it.",
  },
  qualityNotes: {
    "months-without-observation":
      "Some months have no clear view at all: clouds covered the plot on every pass. This is common in the rainy season. In northern Costa Rica, between July and November there is often a single clear date a month, or none.",
    "scenes-not-read":
      "Some images could not be read from the service. Their dates are missing from the series.",
    "time-budget-reached":
      "The time allowed ran out before all the images were read. The oldest ones are missing.",
  },
  conversions: {
    "reflectance-scale-and-offset":
      "The numbers stored in each image are converted to surface reflectance with the scale and offset the image itself publishes (value × 0.0000275 − 0.2). NDVI is computed from that reflectance: (near infrared − red) / (near infrared + red).",
  },
  stages: {
    searching: "Looking for Landsat images of your plot…",
    "reading-scenes": "Checking the images one by one and discarding the clouds…",
  },
  noData:
    "There is no Landsat image of the period in which the plot looks clear enough. That is why no vegetation value is shown.",
};

export const vegetationMessages: LocalizedSourceMessages = { es, en };
