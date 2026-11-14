import type { LocalizedSourceMessages, SourceMessages } from "../types";

/**
 * Words for the soil source. Text only: this file is loaded by the browser.
 *
 * What is said here about SoilGrids comes from ISRIC's own documentation
 * (docs.isric.org/globaldata/soilgrids): maps at 250 m made with machine
 * learning from soil profiles and environmental layers; values stored as whole
 * numbers with a conversion factor of 10 for these five properties; urban
 * land, inland water, glaciers and bare surfaces masked out; uncertainty
 * published as quantiles; and ISRIC's advice not to use SoilGrids "at the
 * local or farm level".
 */

const es: SourceMessages = {
  title: "Suelo",
  summary:
    "Textura, acidez y carbono orgánico de la capa superior del suelo, según el mapa mundial SoilGrids de ISRIC.",
  scope: {
    regional:
      "Estos valores son del cuadro de 250 metros del mapa mundial de suelos donde cae el centro de tu área. Describen el suelo esperado en los alrededores; no son una medición de tu parcela.",
  },
  metrics: {
    "soil.clay": {
      label: "Arcilla",
      help: "Porcentaje de arcilla, la partícula más fina del suelo, estimado para los primeros 5 centímetros.",
    },
    "soil.sand": {
      label: "Arena",
      help: "Porcentaje de arena, la partícula más gruesa del suelo, estimado para los primeros 5 centímetros.",
    },
    "soil.silt": {
      label: "Limo",
      help: "Porcentaje de limo, la partícula de tamaño intermedio, estimado para los primeros 5 centímetros.",
    },
    "soil.ph": {
      label: "pH del suelo",
      help: "Acidez del suelo medida en agua, estimada para los primeros 5 centímetros. 7 es neutro; menos de 7 es ácido y más de 7 es alcalino.",
    },
    "soil.organicCarbon": {
      label: "Carbono orgánico",
      help: "Gramos de carbono orgánico por cada kilo de suelo, estimados para los primeros 5 centímetros. Proviene de la materia orgánica.",
    },
  },
  limitations: {
    "modelled-estimate":
      "Nadie tomó muestras en tu parcela para estos valores. SoilGrids los estima con un modelo que aprende de perfiles de suelo de todo el mundo y de mapas de clima, relieve y vegetación. Un análisis de suelo de tu propio terreno vale más que estos números.",
    "pixel-250m":
      "Hay un solo valor por cada cuadro de 250 metros. ISRIC, que produce el mapa, no aconseja usarlo a nivel de finca: sirve para saber qué tipo de suelo se espera en la zona.",
    "uncertainty-not-shown":
      "Se muestra solo el valor medio que estima el modelo. SoilGrids publica además un rango de incertidumbre para cada valor, que aquí todavía no se muestra.",
  },
  qualityNotes: {
    "partial-layers":
      "SoilGrids no devolvió valor para algunas propiedades o profundidades. Se muestran solo las que tienen dato.",
    "unmapped-pixel":
      "SoilGrids no tiene valores para este punto. El mapa no estima suelo en zonas urbanas, agua, glaciares ni superficies desnudas.",
  },
  conversions: {
    "texture-g-per-kg-to-percent":
      "SoilGrids guarda la arcilla, la arena y el limo en gramos por kilo. Se dividen entre 10, el factor que indica el propio servicio, para mostrarlos en porcentaje.",
    "ph-times-ten-to-ph":
      "SoilGrids guarda el pH multiplicado por 10. Se divide entre 10, el factor que indica el propio servicio.",
    "carbon-dg-per-kg-to-g-per-kg":
      "SoilGrids guarda el carbono orgánico en decigramos por kilo. Se divide entre 10, el factor que indica el propio servicio, para mostrarlo en gramos por kilo.",
  },
  stages: {
    "requesting-soil": "Consultando el mapa de suelos…",
    "reading-soil": "Leyendo las propiedades del suelo…",
  },
  noData:
    "El mapa de suelos no tiene valores para este punto. Suele pasar sobre ciudades, agua o superficies sin suelo.",
};

const en: SourceMessages = {
  title: "Soil",
  summary:
    "Texture, acidity and organic carbon of the top layer of the soil, from ISRIC's SoilGrids world map.",
  scope: {
    regional:
      "These values belong to the 250-metre square of the world soil map that contains the centre of your area. They describe the soil expected in the surroundings; they are not a measurement of your plot.",
  },
  metrics: {
    "soil.clay": {
      label: "Clay",
      help: "Percentage of clay, the finest particle in soil, estimated for the top 5 centimetres.",
    },
    "soil.sand": {
      label: "Sand",
      help: "Percentage of sand, the coarsest particle in soil, estimated for the top 5 centimetres.",
    },
    "soil.silt": {
      label: "Silt",
      help: "Percentage of silt, the middle-sized particle, estimated for the top 5 centimetres.",
    },
    "soil.ph": {
      label: "Soil pH",
      help: "Acidity of the soil measured in water, estimated for the top 5 centimetres. 7 is neutral; under 7 is acid and over 7 is alkaline.",
    },
    "soil.organicCarbon": {
      label: "Organic carbon",
      help: "Grams of organic carbon per kilogram of soil, estimated for the top 5 centimetres. It comes from organic matter.",
    },
  },
  limitations: {
    "modelled-estimate":
      "Nobody sampled your plot for these values. SoilGrids estimates them with a model that learns from soil profiles around the world and from maps of climate, relief and vegetation. A soil test from your own land outweighs these numbers.",
    "pixel-250m":
      "There is a single value for each 250-metre square. ISRIC, which produces the map, advises against using it at farm level: it tells you what kind of soil to expect in the zone.",
    "uncertainty-not-shown":
      "Only the mean value estimated by the model is shown. SoilGrids also publishes an uncertainty range for each value, which is not shown here yet.",
  },
  qualityNotes: {
    "partial-layers":
      "SoilGrids returned no value for some properties or depths. Only those with a value are shown.",
    "unmapped-pixel":
      "SoilGrids has no values for this point. The map does not estimate soil in urban areas, water, glaciers or bare surfaces.",
  },
  conversions: {
    "texture-g-per-kg-to-percent":
      "SoilGrids stores clay, sand and silt in grams per kilogram. They are divided by 10, the factor the service itself states, to show them as a percentage.",
    "ph-times-ten-to-ph":
      "SoilGrids stores pH multiplied by 10. It is divided by 10, the factor the service itself states.",
    "carbon-dg-per-kg-to-g-per-kg":
      "SoilGrids stores organic carbon in decigrams per kilogram. It is divided by 10, the factor the service itself states, to show it in grams per kilogram.",
  },
  stages: {
    "requesting-soil": "Looking up the soil map…",
    "reading-soil": "Reading the soil properties…",
  },
  noData:
    "The soil map has no values for this point. This usually happens over cities, water or surfaces without soil.",
};

export const soilMessages: LocalizedSourceMessages = { es, en };
