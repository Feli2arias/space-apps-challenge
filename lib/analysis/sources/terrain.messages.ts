import type { LocalizedSourceMessages, SourceMessages } from "../types";

/**
 * Words for the terrain source. Text only: this file is loaded by the browser.
 *
 * Figures quoted here come from official documents, not from estimates:
 * - 30 m samples and "50 to 80 m" of real detail, whole-metre heights:
 *   SRTM Collection User Guide (LP DAAC, 2015).
 * - Height errors (design goal 16 m; checked: under 9 m absolute and 4.7 to
 *   9.8 m relative, all at 90 %), canopy and buildings: Farr et al. (2007),
 *   "The Shuttle Radar Topography Mission", Reviews of Geophysics 45, Table 1.
 * - Sea written as 0 m, no tiles beyond the mission's coverage: Open Topo Data
 *   SRTM dataset page; coverage 60° N to 56° S: LP DAAC product page.
 * - Slope classes: FAO, Guidelines for soil description (2006), Table 7.
 */

const es: SourceMessages = {
  title: "Relieve",
  summary:
    "Altura del terreno sobre el nivel del mar y qué tan inclinado es, según el modelo de elevación SRTM de la NASA.",
  scope: {
    parcel:
      "Estos números se calculan con los puntos del modelo de elevación que caen dentro del área que marcaste.",
    pixel:
      "Tu área es más angosta que la distancia entre puntos del modelo. El dato describe el punto más cercano a su centro, no toda el área.",
  },
  metrics: {
    "terrain.elevationMean": {
      label: "Altura media",
      help: "Promedio de la altura sobre el nivel del mar de los puntos dentro del área, en metros.",
    },
    "terrain.elevationMin": {
      label: "Punto más bajo",
      help: "Altura del punto más bajo del modelo dentro del área.",
    },
    "terrain.elevationMax": {
      label: "Punto más alto",
      help: "Altura del punto más alto del modelo dentro del área. Puede ser la copa de árboles o un techo, no el suelo.",
    },
    "terrain.relief": {
      label: "Desnivel",
      help: "Diferencia de altura entre el punto más alto y el más bajo dentro del área.",
    },
    "terrain.slopeMeanPercent": {
      label: "Pendiente media",
      help: "Promedio de la inclinación dentro del área. 10 % significa que el terreno sube o baja 10 metros por cada 100 metros. Se calcula comparando cada punto con sus ocho vecinos (método de Horn).",
    },
    "terrain.slopeMaxPercent": {
      label: "Pendiente máxima",
      help: "La inclinación más fuerte entre los puntos del área.",
    },
    "terrain.slopeMeanDegrees": {
      label: "Pendiente media en grados",
      help: "Promedio de la inclinación medida como ángulo respecto al horizonte. Una pendiente de 100 % equivale a 45°.",
    },
    "terrain.slopeClass.flat": {
      label: "Plano",
      help: "Parte del área con pendiente menor de 2 %.",
    },
    "terrain.slopeClass.gentle": {
      label: "Suave",
      help: "Parte del área con pendiente de 2 % a menos de 5 %.",
    },
    "terrain.slopeClass.moderate": {
      label: "Moderada",
      help: "Parte del área con pendiente de 5 % a menos de 15 %.",
    },
    "terrain.slopeClass.steep": {
      label: "Fuerte",
      help: "Parte del área con pendiente de 15 % o más.",
    },
  },
  limitations: {
    "pixel-smoothing":
      "El modelo tiene un dato cada 30 metros y su detalle real es de 50 a 80 metros. No muestra terrazas, zanjas, bordos ni surcos.",
    "surface-model-2000":
      "SRTM midió la superficie con radar en febrero de 2000. Donde había árboles o construcciones midió cerca de sus copas o techos, no el suelo. Tampoco refleja nivelaciones o movimientos de tierra hechos después.",
    "vertical-error":
      "Las alturas vienen en metros enteros y tienen error: al compararlas con mediciones en tierra, el error fue menor de 9 metros en 9 de cada 10 casos (la meta de la misión era 16), y de 5 a 10 metros entre un punto y otro. En áreas pequeñas ese error puede aparecer como una pendiente que no existe.",
  },
  qualityNotes: {
    "area-too-small-for-slope":
      "El área contiene menos de cuatro puntos del modelo (hay uno cada 30 metros). Es demasiado pequeña para calcular su pendiente con estos datos, así que no se muestra.",
    "no-cell-inside":
      "Ningún punto del modelo cayó dentro del contorno que dibujaste. Se usa el punto más cercano a su centro.",
    "missing-elevation":
      "El servicio no devolvió altura para algunos puntos del área. Los cálculos usan solo los puntos con dato.",
    "slope-gaps":
      "En algunos puntos no se pudo calcular la pendiente porque faltaba la altura de un punto vecino. Si quedaron menos de cuatro puntos con pendiente, no se muestra.",
    "grid-coarsened":
      "El área es grande. Para respetar los límites del servicio, los puntos se tomaron más separados que los 30 metros del modelo. A esa distancia las lomas cortas se suavizan y la pendiente sale menor.",
    "zero-elevation":
      "Todas las alturas son exactamente 0 metros. Este modelo escribe así el mar, por lo que el área puede estar sobre agua.",
    "no-elevation":
      "El modelo SRTM no tiene alturas para este lugar. Cubre la tierra entre los 60° de latitud norte y los 56° de latitud sur.",
  },
  conversions: {
    "slope-percent-and-degrees":
      "La pendiente se obtiene como metros de subida por cada metro de avance. En porcentaje es ese valor por 100; en grados es el ángulo que le corresponde (arcotangente). Por eso 10 % son 5,7° y 100 % son 45°.",
  },
  stages: {
    "requesting-elevation": "Consultando la altura del terreno…",
    "computing-slope": "Calculando la pendiente…",
  },
  noData: "El modelo de elevación no tiene datos para este lugar.",
};

const en: SourceMessages = {
  title: "Terrain",
  summary:
    "Height of the land above sea level and how steep it is, from NASA's SRTM elevation model.",
  scope: {
    parcel:
      "These numbers are computed from the points of the elevation model that fall inside the area you marked.",
    pixel:
      "Your area is narrower than the distance between points of the model. The value describes the point nearest to its centre, not the whole area.",
  },
  metrics: {
    "terrain.elevationMean": {
      label: "Mean elevation",
      help: "Average height above sea level of the points inside the area, in metres.",
    },
    "terrain.elevationMin": {
      label: "Lowest point",
      help: "Height of the lowest point of the model inside the area.",
    },
    "terrain.elevationMax": {
      label: "Highest point",
      help: "Height of the highest point of the model inside the area. It may be a treetop or a roof, not the ground.",
    },
    "terrain.relief": {
      label: "Relief",
      help: "Difference in height between the highest and the lowest point inside the area.",
    },
    "terrain.slopeMeanPercent": {
      label: "Mean slope",
      help: "Average steepness inside the area. 10% means the land rises or falls 10 metres every 100 metres. It is computed by comparing each point with its eight neighbours (Horn's method).",
    },
    "terrain.slopeMaxPercent": {
      label: "Maximum slope",
      help: "The steepest value among the points of the area.",
    },
    "terrain.slopeMeanDegrees": {
      label: "Mean slope in degrees",
      help: "Average steepness measured as an angle above the horizontal. A 100% slope equals 45°.",
    },
    "terrain.slopeClass.flat": {
      label: "Flat",
      help: "Part of the area with a slope under 2%.",
    },
    "terrain.slopeClass.gentle": {
      label: "Gentle",
      help: "Part of the area with a slope from 2% to under 5%.",
    },
    "terrain.slopeClass.moderate": {
      label: "Moderate",
      help: "Part of the area with a slope from 5% to under 15%.",
    },
    "terrain.slopeClass.steep": {
      label: "Steep",
      help: "Part of the area with a slope of 15% or more.",
    },
  },
  limitations: {
    "pixel-smoothing":
      "The model has one value every 30 metres and its real detail is 50 to 80 metres. It does not show terraces, ditches, small banks or furrows.",
    "surface-model-2000":
      "SRTM measured the surface by radar in February 2000. Where there were trees or buildings it measured near their tops, not the ground. It does not reflect levelling or earthworks done since then.",
    "vertical-error":
      "Heights come in whole metres and carry error: checked against ground measurements, the error was under 9 metres in 9 cases out of 10 (the mission's goal was 16), and 5 to 10 metres between one point and another. On small areas that error can show up as a slope that is not there.",
  },
  qualityNotes: {
    "area-too-small-for-slope":
      "The area holds fewer than four points of the model (there is one every 30 metres). It is too small to compute its slope from this data, so none is shown.",
    "no-cell-inside":
      "No point of the model fell inside the outline you drew. The point nearest to its centre is used.",
    "missing-elevation":
      "The service returned no height for some points of the area. The calculations use only the points that have a value.",
    "slope-gaps":
      "For some points the slope could not be computed because a neighbouring point had no height. If fewer than four points with a slope were left, none is shown.",
    "grid-coarsened":
      "The area is large. To stay within the limits of the service, points were taken further apart than the 30 metres of the model. At that distance short hills are smoothed out and the slope comes out lower.",
    "zero-elevation":
      "Every height is exactly 0 metres. This model writes the sea that way, so the area may be over water.",
    "no-elevation":
      "The SRTM model has no heights for this place. It covers land between 60° north and 56° south.",
  },
  conversions: {
    "slope-percent-and-degrees":
      "Slope is obtained as metres of rise per metre travelled. In percent it is that value times 100; in degrees it is the matching angle (arctangent). That is why 10% is 5.7° and 100% is 45°.",
  },
  stages: {
    "requesting-elevation": "Looking up the height of the land…",
    "computing-slope": "Computing the slope…",
  },
  noData: "The elevation model has no data for this place.",
};

export const terrainMessages: LocalizedSourceMessages = { es, en };
