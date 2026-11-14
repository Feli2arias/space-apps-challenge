import type { LocalizedSourceMessages, SourceMessages } from "../types";

/**
 * Words for every code the rain source emits. Text only: this file is imported
 * by the browser, so it must not import server code. The codes are repeated
 * here as plain strings for that reason; `rain.messages.test.ts` checks that
 * they match the ones the source really emits.
 */

const es: SourceMessages = {
  title: "Lluvia",
  summary:
    "Cuánta lluvia ha caído en esta zona en los últimos años, según la estimación por satélite IMERG de la NASA.",
  scope: {
    regional:
      "Estos números describen un cuadro de unos 10 km de lado que incluye tu terreno. No son una medición dentro del terreno.",
  },
  metrics: {
    "rain.annualMean": {
      label: "Lluvia promedio por año",
      help: "Promedio de la lluvia total de cada año completo del periodo.",
    },
    "rain.driestYear": {
      label: "Año más seco",
      help: "El año completo con menos lluvia del periodo y cuánto llovió ese año.",
    },
    "rain.wettestYear": {
      label: "Año más lluvioso",
      help: "El año completo con más lluvia del periodo y cuánto llovió ese año.",
    },
    "rain.interannualCv": {
      label: "Variación entre años",
      help: "Cuánto cambia la lluvia de un año a otro, como porcentaje del promedio: un número más alto significa años más distintos entre sí.",
    },
    "rain.wettestMonth": {
      label: "Mes más lluvioso",
      help: "El mes del calendario que en promedio recibe más lluvia y cuánto llueve en él.",
    },
    "rain.driestMonth": {
      label: "Mes más seco",
      help: "El mes del calendario que en promedio recibe menos lluvia y cuánto llueve en él.",
    },
    "rain.yearsUsed": {
      label: "Años usados",
      help: "Cuántos años tienen datos suficientes para entrar en los cálculos por año.",
    },
  },
  limitations: {
    "rain.regionalPixel":
      "Cada dato cubre un cuadro de unos 10 km de lado. La lluvia dentro de tu terreno puede ser distinta, sobre todo con aguaceros locales.",
    "rain.satelliteEstimate":
      "Es una estimación hecha con satélites, no la lectura de un pluviómetro. Puede quedar por encima o por debajo de la lluvia real.",
    "rain.lateRun":
      "Se usa la versión rápida del producto (IMERG Late), que no se corrige con pluviómetros. La versión final corregida no está disponible en este servicio.",
    "rain.shortRecord":
      "El periodo cubre pocos años. Sirve para ver lo que pasó hace poco, no para describir el clima de largo plazo, que se calcula con 30 años.",
    "rain.utcDay":
      "Cada día se cuenta según la hora universal (UTC), no la hora local. La lluvia de la tarde o la noche puede quedar anotada en el día siguiente.",
  },
  qualityNotes: {
    "rain.yearsFailed":
      "El servicio no respondió para uno o más años. Esos años faltan y no se cuentan como años sin lluvia.",
    "rain.missingDays":
      "Hay días sin dato en el producto. Esos días no se cuentan como días sin lluvia, así que los totales de esos meses pueden quedar bajos.",
    "rain.incompleteYears":
      "Uno o más años no entran en los cálculos por año porque les faltan demasiados días. Un mes cuenta si tiene dato en al menos 9 de cada 10 días; un año cuenta si sus 12 meses cuentan.",
    "rain.tooFewYears":
      "Hay menos de dos años completos, así que no se puede decir cuánto cambia la lluvia de un año a otro.",
  },
  // The service already delivers millimetres per day, so the source applies no unit conversion.
  conversions: {},
  stages: {
    submitting: "Pidiendo el historial de lluvia…",
    waiting: "Consultando el historial de lluvia…",
    "years-done": "Recibiendo la lluvia año por año…",
    computing: "Sumando la lluvia por mes y por año…",
  },
  noData: "El servicio respondió, pero no tiene datos de lluvia válidos para esta zona en el periodo pedido.",
};

const en: SourceMessages = {
  title: "Rain",
  summary:
    "How much rain has fallen in this area over the last years, according to NASA's IMERG satellite estimate.",
  scope: {
    regional:
      "These numbers describe a square about 10 km wide that includes your plot. They are not a measurement inside the plot.",
  },
  metrics: {
    "rain.annualMean": {
      label: "Average rain per year",
      help: "Average of the total rain of each complete year in the period.",
    },
    "rain.driestYear": {
      label: "Driest year",
      help: "The complete year with the least rain in the period and how much it rained that year.",
    },
    "rain.wettestYear": {
      label: "Wettest year",
      help: "The complete year with the most rain in the period and how much it rained that year.",
    },
    "rain.interannualCv": {
      label: "Variation between years",
      help: "How much the rain changes from one year to the next, as a percentage of the average: a higher number means the years differ more.",
    },
    "rain.wettestMonth": {
      label: "Wettest month",
      help: "The calendar month that gets the most rain on average and how much it rains in it.",
    },
    "rain.driestMonth": {
      label: "Driest month",
      help: "The calendar month that gets the least rain on average and how much it rains in it.",
    },
    "rain.yearsUsed": {
      label: "Years used",
      help: "How many years have enough data to enter the yearly figures.",
    },
  },
  limitations: {
    "rain.regionalPixel":
      "Each value covers a square about 10 km wide. Rain inside your plot can differ, especially with local downpours.",
    "rain.satelliteEstimate":
      "It is an estimate made from satellites, not a rain gauge reading. It can be above or below the real rain.",
    "rain.lateRun":
      "The quick version of the product (IMERG Late) is used, which is not corrected with rain gauges. The corrected final version is not available on this service.",
    "rain.shortRecord":
      "The period covers few years. It shows what happened recently; it does not describe the long-term climate, which is worked out from 30 years.",
    "rain.utcDay":
      "Each day is counted in universal time (UTC), not local time. Rain in the afternoon or at night can be recorded on the next day.",
  },
  qualityNotes: {
    "rain.yearsFailed":
      "The service did not answer for one or more years. Those years are missing and are not counted as years without rain.",
    "rain.missingDays":
      "Some days have no value in the product. They are not counted as days without rain, so the totals of those months can be low.",
    "rain.incompleteYears":
      "One or more years are left out of the yearly figures because too many days are missing. A month counts if at least 9 in 10 of its days have a value; a year counts if all 12 of its months do.",
    "rain.tooFewYears":
      "There are fewer than two complete years, so it is not possible to say how much the rain changes from one year to the next.",
  },
  conversions: {},
  stages: {
    submitting: "Requesting the rain history…",
    waiting: "Looking up the rain history…",
    "years-done": "Receiving the rain year by year…",
    computing: "Adding up the rain by month and by year…",
  },
  noData: "The service answered, but it has no valid rain data for this area in the period requested.",
};

export const rainMessages: LocalizedSourceMessages = { es, en };
