/**
 * Words for the rotation explorer, in Spanish and English.
 *
 * Sentences with a `{name}` in them are templates for `fill` (from
 * `./results`). Every figure they receive is already formatted and comes from
 * the analysis, the rotations API or what the person declared.
 */

import type { StudySetting, PreviousCrop } from "@/lib/rotation/evidence";
import type { CoverLevel } from "@/lib/rotation/exposure";
import type { Locale } from "@/lib/site";
import type { PlanId } from "@/components/app/rotations/plans";
import type { NoteCode } from "@/components/app/rotations/notes";

interface LevelWords {
  /** One letter drawn inside each month cell, so levels never depend on colour. */
  readonly letter: string;
  readonly name: string;
}

export interface RotationsDictionary {
  readonly locale: Locale;
  readonly title: string;
  readonly intro: string;
  readonly origins: {
    readonly declared: string;
    readonly study: string;
    readonly modeled: string;
    readonly calculated: string;
  };
  readonly insight: {
    readonly title: string;
    readonly intro: string;
    readonly scaleNote: string;
    readonly thresholds: string;
    readonly missingRain: string;
    readonly missingVegetation: string;
    readonly missingBoth: string;
    readonly rainRow: string;
    readonly coverRow: string;
    readonly coverLow: LevelWords;
    readonly coverGreen: LevelWords;
    readonly coverUnknown: LevelWords;
    readonly coincidingMark: string;
    readonly monthSentence: string;
    readonly rainMissing: string;
    readonly rainier: string;
    readonly coinciding: string;
    readonly coincidingNone: string;
    readonly coincidingShare: string;
    readonly unknown: string;
    readonly unknownNone: string;
  };
  readonly plans: Readonly<Record<PlanId, string>>;
  readonly baselineBadge: string;
  readonly exampleBadge: string;
  readonly editedBadge: string;
  readonly exampleWarning: string;
  readonly resetExamples: string;
  readonly crops: Readonly<Record<PreviousCrop, string>>;
  readonly cropLabel: string;
  readonly cropHelp: string;
  readonly editor: {
    readonly label: string;
    readonly help: string;
    readonly cellLabel: string;
    readonly legend: string;
  };
  readonly levels: Readonly<Record<CoverLevel, LevelWords>>;
  readonly summary: {
    readonly title: string;
    readonly caption: string;
    readonly evidenceRow: string;
    readonly exposureRow: string;
    readonly notStudied: string;
    readonly baseline: string;
    readonly unavailable: string;
    readonly pending: string;
  };
  readonly evidence: {
    readonly title: string;
    readonly incidence: string;
    readonly settings: Readonly<Record<StudySetting, string>>;
    readonly group: string;
    readonly groupHelp: string;
    readonly hostYes: string;
    readonly hostNo: string;
    readonly hostUnknown: string;
    readonly notStudied: string;
    readonly notStudiedUnknownCrop: string;
    readonly caveat: string;
    readonly citation: string;
  };
  readonly exposure: {
    readonly title: string;
    readonly ratioUnit: string;
    readonly baselineRatio: string;
    readonly range: string;
    readonly lower: string;
    readonly higher: string;
    readonly same: string;
    readonly bareMonths: string;
    readonly bareMonthsNone: string;
    readonly bareRainyMonths: string;
    readonly bareRainyMonthsNone: string;
    readonly rainSource: string;
    readonly gap: string;
    readonly assumptionsTitle: string;
    readonly assumptions: readonly string[];
  };
  readonly status: {
    readonly updating: string;
    readonly error: string;
    readonly rateLimited: string;
    readonly invalid: string;
  };
  readonly notes: {
    readonly unknownTitle: string;
    readonly reviewTitle: string;
    readonly codes: Readonly<Record<NoteCode, string>>;
  };
  readonly closing: string;
  readonly listJoin: string;
  readonly listLast: string;
}

const es: RotationsDictionary = {
  locale: "es",
  title: "Comparar rotaciones",
  intro:
    "Compara tu práctica actual con dos alternativas para esta parcela. Cada una muestra dos lecturas separadas: lo que deja el cultivo anterior y cuánto queda el suelo expuesto a la lluvia. No se juntan en un puntaje.",
  origins: {
    declared: "Lo declaras tú",
    study: "De un estudio",
    modeled: "Modelado",
    calculated: "Cálculo de esta app",
  },
  insight: {
    title: "Lluvia y cobertura en esta parcela",
    intro:
      "Mes a mes: la lluvia media y lo que mostraron las escenas de satélite despejadas sobre la parcela.",
    scaleNote:
      "La lluvia es regional (un producto satelital de grilla gruesa, no medida en la parcela); la vegetación se leyó sobre la parcela. Son dos escalas distintas: esto señala meses para mirar con cuidado, no mide erosión.",
    thresholds:
      "Umbrales: vegetación baja = NDVI menor que {threshold}; se necesitan al menos {min} escenas despejadas en el mes; «mayormente baja» = {majority} o más de esas escenas.",
    missingRain: "Falta la lluvia de esta parcela, así que no se puede hacer este cruce.",
    missingVegetation: "Falta la vegetación de esta parcela, así que no se puede hacer este cruce.",
    missingBoth: "Faltan la lluvia y la vegetación de esta parcela, así que no se puede hacer este cruce.",
    rainRow: "Lluvia media",
    coverRow: "Escenas",
    coverLow: { letter: "B", name: "Mayormente vegetación baja" },
    coverGreen: { letter: "V", name: "Mayormente con vegetación" },
    coverUnknown: { letter: "?", name: "Pocas escenas despejadas: no se puede decir" },
    coincidingMark: "Mes lluvioso con vegetación baja",
    monthSentence: "{month}: lluvia media {rain}; {cover} ({clear} escenas despejadas).",
    rainMissing: "sin dato de lluvia",
    rainier: "más lluvioso que el mes promedio",
    coinciding: "Meses lluviosos con vegetación mayormente baja: {months}.",
    coincidingNone: "Ningún mes lluvioso mostró vegetación mayormente baja.",
    coincidingShare: "En esos meses cae el {share} de la lluvia media del año.",
    unknown: "No se pudo juzgar: {months}.",
    unknownNone: "Todos los meses se pudieron juzgar.",
  },
  plans: { current: "Práctica actual", "alt-b": "Alternativa B", "alt-c": "Alternativa C" },
  baselineBadge: "Referencia",
  exampleBadge: "Ejemplo editable",
  editedBadge: "Editado por ti",
  exampleWarning:
    "Ejemplo editable: no es un calendario oficial. No tenemos un calendario de siembra verificado para esta región, así que estos ejemplos solo ilustran. Corrígelos con lo que haces en tu finca.",
  resetExamples: "Volver a los ejemplos",
  crops: {
    maize: "Maíz",
    beans: "Frijol",
    rice: "Arroz",
    squash: "Ayote",
    chili: "Chile",
    ginger: "Jengibre",
    tannia: "Tiquisque",
    "cover-crop": "Cultivo de cobertura",
    pasture: "Pasto",
    other: "Otro",
    unknown: "No sé",
  },
  cropLabel: "Cultivo antes del frijol",
  cropHelp: "Lo eliges tú: un satélite no identifica el cultivo ni detecta el nematodo.",
  editor: {
    label: "Cobertura del suelo por mes",
    help: "Toca un mes para cambiar su nivel. Con teclado: flechas izquierda y derecha para moverte, arriba y abajo para subir o bajar la cobertura.",
    cellLabel: "{month}: {level}",
    legend: "Niveles",
  },
  levels: {
    bare: { letter: "D", name: "Suelo desnudo" },
    low: { letter: "B", name: "Cobertura baja" },
    medium: { letter: "M", name: "Cobertura media" },
    high: { letter: "A", name: "Cobertura alta" },
  },
  summary: {
    title: "Las dos lecturas, lado a lado",
    caption: "Cada fila es una lectura distinta. No se suman ni se convierten en un puntaje.",
    evidenceRow: "Frijol después de este cultivo (estudio)",
    exposureRow: "Exposición del suelo a la lluvia (modelo)",
    notStudied: "No estudiado",
    baseline: "1,00 (referencia)",
    unavailable: "No disponible",
    pending: "Calculando…",
  },
  evidence: {
    title: "Lo que deja el cultivo anterior",
    incidence: "de las plantas de frijol con amachamiento",
    settings: {
      "brunca-2009": "Campos comerciales de la región Brunca, 2009 (medido en llenado de vaina)",
      "pejibaye-2010": "Tres parcelas de media hectárea en una finca de Pejibaye, Pérez Zeledón, 2010",
    },
    group: "Grupo estadístico «{group}»",
    groupHelp:
      "Rotaciones que comparten una letra no se diferenciaron de forma significativa (prueba de Duncan, p ≤ 0,05).",
    hostYes: "El artículo nombra a este cultivo como hospedero conocido del nematodo.",
    hostNo: "El artículo dice que este cultivo no es un hospedero conocido del nematodo.",
    hostUnknown: "El artículo no dice si este cultivo es hospedero del nematodo.",
    notStudied:
      "El estudio no observó frijol después de este cultivo. Eso no significa «sin riesgo»: significa que no hay evidencia, ni a favor ni en contra.",
    notStudiedUnknownCrop:
      "Sin saber el cultivo anterior no se puede buscar evidencia. Eso no significa «sin riesgo».",
    caveat:
      "Es un estudio observacional en otra región ({region}). Describe lo que se vio allí; no es una probabilidad para tu parcela.",
    citation: "{authors} ({year}). {journal}.",
  },
  exposure: {
    title: "Exposición del suelo a la lluvia",
    ratioUnit: "veces la práctica actual",
    baselineRatio: "Es la referencia: 1,00 por definición.",
    range: "Entre {low} y {high}, según el supuesto de protección de la cobertura.",
    lower: "Menos expuesto que la práctica actual.",
    higher: "Más expuesto que la práctica actual.",
    same: "Igual de expuesto que la práctica actual.",
    bareMonths: "Meses con suelo desnudo: {months}.",
    bareMonthsNone: "Ningún mes con suelo desnudo.",
    bareRainyMonths: "De ellos, más lluviosos que el mes promedio: {months}.",
    bareRainyMonthsNone: "Ningún mes desnudo es más lluvioso que el promedio.",
    rainSource: "Usa la lluvia media mensual de esta parcela (dato regional) y la cobertura que declaraste.",
    gap: "Lectura no disponible: falta la lluvia de al menos un mes, y sin los 12 meses no hay un reparto honesto de la lluvia del año. La lectura del cultivo anterior sigue siendo válida.",
    assumptionsTitle: "Supuestos del modelo",
    assumptions: [
      "Cada mes pesa según su lluvia al cuadrado: la lluvia concentrada erosiona más (Índice de Fournier modificado, Arnoldus 1980).",
      "La pérdida de suelo relativa es exp(−b × % de cobertura), la relación de cobertura superficial de RUSLE. b va de 0,025 a 0,05 (documentación de RUSLE2); el valor central usado es 0,035.",
      "Niveles declarados: desnudo 0 %, bajo 30 %, medio 60 %, alto 90 % de cobertura.",
      "La pendiente y el tipo de suelo se cancelan porque es la misma parcela. Por eso el resultado es una razón frente a la práctica actual y no toneladas de suelo.",
    ],
  },
  status: {
    updating: "Actualizando…",
    error: "No se pudo calcular la comparación. Revisa tu conexión; se intentará de nuevo al hacer otro cambio.",
    rateLimited: "Demasiados cambios seguidos. Espera un momento y haz otro cambio.",
    invalid: "El servidor no aceptó estas rotaciones.",
  },
  notes: {
    unknownTitle: "Lo que todavía no se sabe",
    reviewTitle: "Revisar con el agrónomo local",
    codes: {
      "no-local-evidence":
        "No hay evidencia de esta región: las cifras vienen de Brunca, con otro clima y otras fincas.",
      "not-studied": "No hay ningún dato sobre frijol después de {crop}.",
      "host-unknown": "No se sabe si {crop} es hospedero del nematodo.",
      "crop-unknown": "No se sabe cuál fue el cultivo anterior.",
      "cover-declared": "Los niveles de cobertura son declarados, no medidos.",
      "rain-incomplete": "Falta lluvia de algún mes, así que no hay lectura de exposición.",
      "range-crosses": "Según el supuesto del modelo, puede quedar más o menos expuesto que la práctica actual.",
      "check-calendar": "Que los meses y niveles de cobertura coincidan con lo que haces en el campo.",
      "still-example": "Esta rotación sigue siendo el ejemplo: cámbiala por tu calendario real.",
      "cover-rainy": "Cómo cubrir el suelo en {months}, meses desnudos y lluviosos.",
      "host-risk": "Si sembrar frijol después de {crop}, hospedero conocido, aumenta el riesgo de amachamiento aquí.",
      "local-experience": "Si hay experiencia local con frijol después de {crop}.",
    },
  },
  closing:
    "Esta herramienta apoya la decisión; no reemplaza tu criterio ni la revisión del agrónomo local.",
  listJoin: ", ",
  listLast: " y ",
};

const en: RotationsDictionary = {
  locale: "en",
  title: "Compare rotations",
  intro:
    "Compare your current practice with two alternatives for this plot. Each one shows two separate readings: what the previous crop leaves behind and how exposed the soil is to rain. They are not merged into a score.",
  origins: {
    declared: "Declared by you",
    study: "From a study",
    modeled: "Modelled",
    calculated: "Calculated by this app",
  },
  insight: {
    title: "Rain and ground cover on this plot",
    intro: "Month by month: mean rainfall and what clear satellite scenes showed over the plot.",
    scaleNote:
      "Rainfall is regional (a coarse-grid satellite product, not measured on the plot); vegetation was read on the plot. These are two different scales: this points at months to look at closely, it does not measure erosion.",
    thresholds:
      "Thresholds: low vegetation = NDVI below {threshold}; a month needs at least {min} clear scenes; “mostly low” = {majority} or more of those scenes.",
    missingRain: "Rainfall for this plot is missing, so this comparison cannot be made.",
    missingVegetation: "Vegetation for this plot is missing, so this comparison cannot be made.",
    missingBoth: "Rainfall and vegetation for this plot are missing, so this comparison cannot be made.",
    rainRow: "Mean rain",
    coverRow: "Scenes",
    coverLow: { letter: "L", name: "Mostly low vegetation" },
    coverGreen: { letter: "V", name: "Mostly vegetated" },
    coverUnknown: { letter: "?", name: "Too few clear scenes to say" },
    coincidingMark: "Rainy month with low vegetation",
    monthSentence: "{month}: mean rain {rain}; {cover} ({clear} clear scenes).",
    rainMissing: "no rainfall data",
    rainier: "rainier than the average month",
    coinciding: "Rainy months with mostly low vegetation: {months}.",
    coincidingNone: "No rainy month showed mostly low vegetation.",
    coincidingShare: "Those months get {share} of the mean yearly rainfall.",
    unknown: "Could not be judged: {months}.",
    unknownNone: "Every month could be judged.",
  },
  plans: { current: "Current practice", "alt-b": "Alternative B", "alt-c": "Alternative C" },
  baselineBadge: "Reference",
  exampleBadge: "Editable example",
  editedBadge: "Edited by you",
  exampleWarning:
    "Editable example: not an official calendar. We have no verified sowing calendar for this region, so these examples only illustrate. Correct them with what you do on your farm.",
  resetExamples: "Back to the examples",
  crops: {
    maize: "Maize",
    beans: "Beans",
    rice: "Rice",
    squash: "Squash",
    chili: "Chili",
    ginger: "Ginger",
    tannia: "Tannia",
    "cover-crop": "Cover crop",
    pasture: "Pasture",
    other: "Other",
    unknown: "I don't know",
  },
  cropLabel: "Crop before the beans",
  cropHelp: "You choose it: a satellite does not identify the crop or detect the nematode.",
  editor: {
    label: "Ground cover by month",
    help: "Tap a month to change its level. With a keyboard: left and right arrows to move, up and down to raise or lower the cover.",
    cellLabel: "{month}: {level}",
    legend: "Levels",
  },
  levels: {
    bare: { letter: "B", name: "Bare soil" },
    low: { letter: "L", name: "Low cover" },
    medium: { letter: "M", name: "Medium cover" },
    high: { letter: "H", name: "High cover" },
  },
  summary: {
    title: "The two readings, side by side",
    caption: "Each row is a different reading. They are not added up or turned into a score.",
    evidenceRow: "Beans after this crop (study)",
    exposureRow: "Soil exposure to rain (model)",
    notStudied: "Not studied",
    baseline: "1.00 (reference)",
    unavailable: "Unavailable",
    pending: "Calculating…",
  },
  evidence: {
    title: "What the previous crop leaves",
    incidence: "of bean plants with amachamiento",
    settings: {
      "brunca-2009": "Commercial fields in the Brunca region, 2009 (measured at pod filling)",
      "pejibaye-2010": "Three half-hectare plots on one farm in Pejibaye, Pérez Zeledón, 2010",
    },
    group: "Statistical group “{group}”",
    groupHelp:
      "Rotations sharing a letter were not significantly different (Duncan test, p ≤ 0.05).",
    hostYes: "The paper names this crop as a known host of the nematode.",
    hostNo: "The paper says this crop is not a known host of the nematode.",
    hostUnknown: "The paper does not say whether this crop hosts the nematode.",
    notStudied:
      "The study did not observe beans after this crop. That does not mean “no risk”: it means there is no evidence either way.",
    notStudiedUnknownCrop:
      "Without knowing the previous crop no evidence can be looked up. That does not mean “no risk”.",
    caveat:
      "It is an observational study in another region ({region}). It describes what was seen there; it is not a probability for your plot.",
    citation: "{authors} ({year}). {journal}.",
  },
  exposure: {
    title: "Soil exposure to rain",
    ratioUnit: "times the current practice",
    baselineRatio: "This is the reference: 1.00 by definition.",
    range: "Between {low} and {high}, depending on the assumed protection from cover.",
    lower: "Less exposed than the current practice.",
    higher: "More exposed than the current practice.",
    same: "As exposed as the current practice.",
    bareMonths: "Months with bare soil: {months}.",
    bareMonthsNone: "No month with bare soil.",
    bareRainyMonths: "Of those, rainier than the average month: {months}.",
    bareRainyMonthsNone: "No bare month is rainier than average.",
    rainSource: "Uses this plot's mean monthly rainfall (regional data) and the cover you declared.",
    gap: "Reading unavailable: rainfall is missing for at least one month, and without all 12 months there is no honest split of the year's rain. The previous-crop reading still holds.",
    assumptionsTitle: "Model assumptions",
    assumptions: [
      "Each month is weighted by its rainfall squared: concentrated rain erodes more (Modified Fournier Index, Arnoldus 1980).",
      "Relative soil loss is exp(−b × % cover), the RUSLE surface-cover relation. b ranges from 0.025 to 0.05 (RUSLE2 documentation); the central value used is 0.035.",
      "Declared levels: bare 0 %, low 30 %, medium 60 %, high 90 % cover.",
      "Slope and soil type cancel out because it is the same plot. That is why the result is a ratio against the current practice and not tonnes of soil.",
    ],
  },
  status: {
    updating: "Updating…",
    error: "The comparison could not be calculated. Check your connection; it will try again on your next change.",
    rateLimited: "Too many changes in a row. Wait a moment and make another change.",
    invalid: "The server did not accept these rotations.",
  },
  notes: {
    unknownTitle: "What is still unknown",
    reviewTitle: "Review with the local agronomist",
    codes: {
      "no-local-evidence":
        "There is no evidence from this region: the figures come from Brunca, with another climate and other farms.",
      "not-studied": "There is no data at all on beans after {crop}.",
      "host-unknown": "It is not known whether {crop} hosts the nematode.",
      "crop-unknown": "The previous crop is not known.",
      "cover-declared": "Cover levels are declared, not measured.",
      "rain-incomplete": "Rainfall is missing for some month, so there is no exposure reading.",
      "range-crosses": "Depending on the model assumption, it may be more or less exposed than the current practice.",
      "check-calendar": "That the months and cover levels match what you do in the field.",
      "still-example": "This rotation is still the example: replace it with your real calendar.",
      "cover-rainy": "How to cover the soil in {months}, months that are bare and rainy.",
      "host-risk": "Whether beans after {crop}, a known host, raises the risk of amachamiento here.",
      "local-experience": "Whether there is local experience with beans after {crop}.",
    },
  },
  closing:
    "This tool supports the decision; it does not replace your judgment or the local agronomist's review.",
  listJoin: ", ",
  listLast: " and ",
};

export const ROTATIONS_DICTIONARY: Readonly<Record<Locale, RotationsDictionary>> = { es, en };

export function getRotationsDictionary(locale: Locale): RotationsDictionary {
  return Object.hasOwn(ROTATIONS_DICTIONARY, locale) ? ROTATIONS_DICTIONARY[locale] : es;
}

/** Joins words as a sentence list: "enero, mayo y junio". */
export function joinList(items: readonly string[], dict: RotationsDictionary): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(dict.listJoin)}${dict.listLast}${items[items.length - 1]}`;
}
