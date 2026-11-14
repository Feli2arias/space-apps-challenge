import type { LocalizedSourceMessages, SourceMessages } from "../types";

/**
 * Words for the climate source. Text only: this file is loaded by the browser.
 *
 * What is said here comes from NASA POWER's own documentation: the data are
 * MERRA-2 model output on a grid of ½° of latitude by ⅝° of longitude, taken
 * 2 m above the mean elevation of each grid cell; and T2M_MAX / T2M_MIN are
 * "the maximum / minimum hourly air temperature … in the period of interest",
 * which in a climatology means the extreme of each month across all years.
 * Half a degree of latitude is about 55 km; ⅝° of longitude is about 70 km at
 * the equator and less towards the poles.
 */

const es: SourceMessages = {
  title: "Temperatura de la zona",
  summary:
    "Temperatura habitual de la región a lo largo del año, según el modelo MERRA-2 que distribuye NASA POWER.",
  scope: {
    regional:
      "Estos valores son de un cuadro del modelo de más de 50 kilómetros de lado. Dan contexto sobre la zona; no son una medición de tu parcela.",
  },
  metrics: {
    "climate.annualMeanTemperature": {
      label: "Temperatura media anual",
      help: "Promedio de la temperatura del aire a 2 metros del suelo durante todo el año, en los años del periodo indicado.",
    },
    "climate.warmestMonth": {
      label: "Mes más cálido",
      help: "Temperatura media del mes que, en promedio, es el más caluroso del año.",
    },
    "climate.coolestMonth": {
      label: "Mes más fresco",
      help: "Temperatura media del mes que, en promedio, es el más fresco del año.",
    },
    "climate.gridCellElevation": {
      label: "Altura que asume el modelo",
      help: "Altura media del cuadro del modelo. Si tu terreno está más alto, será más fresco que estos valores; si está más bajo, más cálido.",
    },
  },
  limitations: {
    "coarse-grid":
      "Un solo valor cubre un cuadro de unos 55 kilómetros de norte a sur y hasta 70 de este a oeste. No distingue tu parcela de las vecinas, ni un valle de una loma.",
    "model-not-station":
      "No viene de un termómetro. Es el resultado de un modelo del tiempo de la NASA (MERRA-2) alimentado con observaciones, y puede diferir de lo que mide una estación cercana.",
    "grid-cell-elevation":
      "La temperatura corresponde a 2 metros sobre la altura media del cuadro, que se muestra aparte. Compárala con la altura de tu terreno antes de usar estos valores.",
    "extremes-not-typical":
      "La máxima y la mínima de cada mes son la temperatura más alta y la más baja que el modelo da para ese mes, hora por hora, en todos los años del periodo. Son extremos, no la máxima ni la mínima de un día normal.",
  },
  qualityNotes: {
    "missing-months":
      "NASA POWER no devolvió algunos valores mensuales. Los que faltan se dejan vacíos.",
    "no-temperature": "NASA POWER no devolvió temperaturas para este lugar.",
    "period-unknown":
      "No se pudo leer de la respuesta qué años abarca el promedio, así que no se indica el periodo.",
    "api-version-differs":
      "NASA POWER responde con una versión distinta a la que se verificó para esta aplicación. Los valores se muestran tal como llegan.",
  },
  conversions: {},
  stages: {
    "requesting-climate": "Consultando la temperatura de la zona…",
  },
  noData: "NASA POWER no tiene temperaturas para este lugar.",
};

const en: SourceMessages = {
  title: "Temperature of the region",
  summary:
    "Usual temperature of the region through the year, from the MERRA-2 model distributed by NASA POWER.",
  scope: {
    regional:
      "These values belong to a model cell more than 50 kilometres across. They give context about the region; they are not a measurement of your plot.",
  },
  metrics: {
    "climate.annualMeanTemperature": {
      label: "Mean annual temperature",
      help: "Average air temperature 2 metres above the ground over the whole year, for the years of the period shown.",
    },
    "climate.warmestMonth": {
      label: "Warmest month",
      help: "Mean temperature of the month that is, on average, the hottest of the year.",
    },
    "climate.coolestMonth": {
      label: "Coolest month",
      help: "Mean temperature of the month that is, on average, the coolest of the year.",
    },
    "climate.gridCellElevation": {
      label: "Elevation the model assumes",
      help: "Mean elevation of the model cell. If your land is higher, it will be cooler than these values; if it is lower, warmer.",
    },
  },
  limitations: {
    "coarse-grid":
      "A single value covers a cell of about 55 kilometres north to south and up to 70 east to west. It cannot tell your plot from the neighbouring ones, or a valley from a hill.",
    "model-not-station":
      "It does not come from a thermometer. It is the output of a NASA weather model (MERRA-2) fed with observations, and it can differ from what a nearby station measures.",
    "grid-cell-elevation":
      "The temperature is for 2 metres above the mean elevation of the cell, which is shown separately. Compare it with the elevation of your land before using these values.",
    "extremes-not-typical":
      "The maximum and minimum of each month are the highest and lowest temperature the model gives for that month, hour by hour, across all the years of the period. They are extremes, not the high or low of an ordinary day.",
  },
  qualityNotes: {
    "missing-months": "NASA POWER did not return some monthly values. The missing ones are left empty.",
    "no-temperature": "NASA POWER returned no temperatures for this place.",
    "period-unknown":
      "The years covered by the average could not be read from the answer, so no period is stated.",
    "api-version-differs":
      "NASA POWER answers with a different version from the one verified for this app. Values are shown as they arrive.",
  },
  conversions: {},
  stages: {
    "requesting-climate": "Looking up the temperature of the region…",
  },
  noData: "NASA POWER has no temperatures for this place.",
};

export const climateMessages: LocalizedSourceMessages = { es, en };
