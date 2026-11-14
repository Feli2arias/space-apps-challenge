import type { Dictionary } from "./types";

export const es: Dictionary = {
  locale: "es",
  meta: {
    title: "Before the Seed | Antes de la semilla, conoce la tierra",
    description:
      "Compara terrenos antes de alquilar o comprar y rotaciones antes de sembrar, con datos de observación de la Tierra y evidencia agronómica. Proyecto del NASA Space Apps Challenge 2026.",
  },
  skipToContent: "Saltar al contenido",
  nav: {
    ariaLabel: "Principal",
    links: [
      { section: "problem", label: "El problema" },
      { section: "how", label: "Cómo funciona" },
      { section: "analyses", label: "Análisis" },
      { section: "rotations", label: "Rotaciones" },
      { section: "data", label: "Datos" },
    ],
    cta: "La demo",
    otherLocale: "en",
    otherLocaleLabel: "EN",
    otherLocaleAria: "Read this page in English",
  },
  hero: {
    titleLines: ["Antes de", "la semilla,"],
    titleHighlight: "conoce la tierra",
    lead: "Escribe unas coordenadas y mira la lluvia, la pendiente y el historial que se ve desde el espacio. Compara terrenos antes de alquilar y rotaciones antes de sembrar.",
    primaryCta: "Ver cómo funciona",
    secondaryCta: "Las tres rotaciones",
    note: "NASA Space Apps 2026 · Reto Field Shift · Piloto en Costa Rica",
  },
  sources: {
    label: "Con datos de",
    items: ["Sentinel-2", "SRTM", "CHIRPS", "GPM IMERG", "SoilGrids", "NASA POWER"],
  },
  stats: {
    ariaLabel: "En resumen",
    items: [
      {
        value: "02",
        label: "decisiones conectadas: elegir el terreno y planear la siembra",
      },
      {
        value: "03",
        label: "rotaciones lado a lado, incluida la que ya se usa",
      },
      {
        value: "10 m",
        label: "mide el píxel con que el satélite ve la cobertura de cada parcela",
      },
      {
        value: "0",
        label: "cuentas que crear o apps que instalar: es una web para el celular",
      },
    ],
  },
  origins: {
    observed: {
      label: "Observado",
      description: "Lo midió un satélite sobre esa área.",
    },
    modeled: {
      label: "Modelado",
      description: "Sale de un cálculo con supuestos que se muestran.",
    },
    declared: {
      label: "Declarado",
      description: "Lo cuenta el productor o el dueño del terreno.",
    },
    study: {
      label: "De un estudio",
      description: "Viene de una publicación, con su región y sus límites.",
    },
  },
  problem: {
    eyebrow: "El problema",
    title: ["Una visita no", "cuenta la historia"],
    intro:
      "Un terreno en alquiler o en venta se ve bien el día de la visita. Lo que no se ve ese día es lo que decide la cosecha: la lluvia de otros años, los meses que pasó descubierto y lo que se sembró antes.",
    cards: [
      {
        icon: "rain",
        title: "Cómo cambia la lluvia de un año a otro",
        body: "Acumulado por mes y por año, meses secos y lluviosos, y cuánto varía entre años. Es un dato de la zona, no de la parcela.",
        origin: "observed",
      },
      {
        icon: "bare",
        title: "Cuánto tiempo estuvo el suelo descubierto",
        body: "Los meses en que la parcela se ve sin cobertura, y si coinciden con los meses de más lluvia.",
        origin: "observed",
      },
      {
        icon: "slope",
        title: "Cuánta pendiente tiene",
        body: "Elevación y pendiente del área, y lo que implican para el manejo y para comparar erosión.",
        origin: "observed",
      },
      {
        icon: "sprout",
        title: "Qué dejó el cultivo anterior",
        body: "Lo que se sembró antes puede decidir si el siguiente cultivo se enferma. Eso no se ve desde el espacio: lo cuenta quien sembró.",
        origin: "declared",
      },
    ],
  },
  how: {
    eyebrow: "El recorrido",
    title: ["Cómo funciona"],
    intro:
      "De unas coordenadas a una decisión, en cinco pasos. El mapa muestra y el análisis calcula: una imagen sobre el mapa no es una medición del terreno.",
    steps: [
      {
        title: "Busca la ubicación",
        body: "Escribe latitud y longitud, pega unas coordenadas, busca una localidad o toca un punto en el mapa.",
      },
      {
        title: "Confirma el área",
        body: "Una coordenada ubica un lugar, no define sus límites. Dibuja el contorno para que los números hablen de esa parcela.",
      },
      {
        title: "Lee la ficha del terreno",
        body: "Lluvia, pendiente, cobertura y suelo. Cada dato con su fuente, su período, su resolución y lo que falta.",
      },
      {
        title: "Compara terrenos",
        body: "Dos o más terrenos bajo el mismo objetivo: ventajas, dificultades y lo que conviene verificar antes de firmar.",
      },
      {
        title: "Compara rotaciones",
        body: "Tres secuencias de cultivo, incluida la actual, con su calendario, su evidencia y sus vacíos.",
      },
    ],
  },
  analyses: {
    eyebrow: "Lo que nos diferencia",
    title: ["Dos preguntas", "antes de sembrar"],
    intro:
      "Se muestran por separado para que se vean los compromisos: una rotación puede proteger mejor el suelo y tener menos respaldo sanitario, o al revés.",
    items: [
      {
        letter: "A",
        title: "Lo que deja el cultivo anterior",
        body: "El amachamiento deja al frijol verde y vacío. Lo causa un nematodo que queda en el rastrojo del cultivo anterior y en malezas, no en la semilla. Un estudio en la región Brunca midió la incidencia según lo que se había sembrado antes.",
        chartTitle: "Incidencia de amachamiento en frijol, según el cultivo anterior",
        bars: [
          { label: "Maíz", value: 64, display: "64%", tone: "accent" },
          { label: "Frijol", value: 62, display: "62%", tone: "accent" },
          { label: "Arroz", value: 29, display: "29%", tone: "accent" },
          { label: "Ayote", value: 15, display: "15%", tone: "accent" },
          { label: "Chile", value: 4, display: "4%", tone: "accent" },
        ],
        source:
          "Chaves y Araya (2012), Agronomía Costarricense 36(2). Región Brunca, 2009. Estudio observacional, sin réplicas.",
        origin: "study",
        caveat:
          "Es lo que se observó en esas fincas, no la probabilidad de una parcela concreta. El satélite no detecta el nematodo ni reconoce el cultivo anterior.",
      },
      {
        letter: "B",
        title: "Lo que pasa cuando el suelo queda descubierto",
        body: "La lluvia que cae sobre suelo desnudo se lleva tierra. Se combinan los meses sin cobertura, la lluvia de esos meses y la pendiente para comparar una rotación con otra. Sirve para comparar, no para dar toneladas.",
        chartTitle: "Pérdida de suelo modelada, relativa a papa tras papa (= 1,00)",
        bars: [
          { label: "Descanso con suelo desnudo", value: 1.26, display: "1,26", tone: "accent" },
          { label: "Papa tras papa (referencia)", value: 1, display: "1,00", tone: "ink" },
          { label: "Avena o abono verde en el hueco", value: 0.88, display: "0,88", tone: "accent" },
        ],
        source:
          "Prueba propia con la ecuación RUSLE en una parcela de ladera en Cartago. Los factores de cobertura por cultivo son supuestos y necesitan validación local.",
        origin: "modeled",
        caveat:
          "El mes de cosecha movió el resultado ±27%, más que la elección del cultivo. Por eso el calendario forma parte de la comparación.",
      },
    ],
  },
  rotations: {
    eyebrow: "El caso del frijol",
    title: ["Tres rotaciones,", "lado a lado"],
    intro:
      "El caso de la demo: una familia frijolera de la zona norte de Costa Rica que alquila su parcela por ciclos. Son candidatas para comparar, no recomendaciones.",
    rotationLabel: "Rotación",
    sequenceAria: "Secuencia de cultivos",
    evidenceLabel: "Evidencia",
    gapsLabel: "Falta saber",
    cards: [
      {
        code: "A",
        badge: "Práctica actual",
        sequence: [
          { label: "Maíz", kind: "previous" },
          { label: "Frijol", kind: "target" },
        ],
        evidence:
          "Con maíz como cultivo anterior, el estudio de Brunca registró 64% de incidencia de amachamiento. En una sola finca (2010), 25%.",
        origin: "study",
        gaps: "Cómo se manejan el rastrojo y el suelo entre un ciclo y otro. Eso lo declara el productor.",
      },
      {
        code: "B",
        badge: null,
        sequence: [
          { label: "Tiquizque o jengibre", kind: "previous" },
          { label: "Frijol", kind: "target" },
        ],
        evidence:
          "En una finca (2010): maíz 25%, tiquizque 5%, jengibre 4%. El estudio observó unas cinco veces menos plantas enfermas.",
        origin: "study",
        gaps: "Es una sola finca de otra región, sin réplicas. Falta confirmar que el ciclo cabe en el plazo del alquiler y que hay mercado.",
      },
      {
        code: "C",
        badge: "Sin evidencia local",
        sequence: [
          { label: "Abono verde (mucuna)", kind: "cover" },
          { label: "Frijol", kind: "target" },
        ],
        evidence:
          "Mantiene el suelo cubierto entre ciclos. En la prueba de erosión hecha en Cartago, cubrir el suelo en vez de dejarlo desnudo redujo la pérdida modelada alrededor de 30%.",
        origin: "modeled",
        gaps: "No hay evidencia local sobre su efecto en el amachamiento. Hay que validar en campo si es viable en la zona.",
      },
    ],
    disclaimer:
      "Before the Seed apoya la decisión. No reemplaza el criterio del productor ni la revisión del técnico local.",
  },
  data: {
    eyebrow: "Datos y límites",
    title: ["Cada número dice", "de dónde viene"],
    intro:
      "Cada indicador muestra su fuente, su período, su resolución y lo que falta. Si el píxel es más grande que la parcela, el dato describe el entorno y no ese terreno.",
    resolutionLabel: "Tamaño del píxel",
    rows: [
      {
        resolution: "10 m",
        what: "Cobertura y suelo descubierto",
        source: "Sentinel-2 · ESA Copernicus",
        scope: "Por parcela",
        limit:
          "De julio a noviembre las nubes dejan pocas imágenes útiles. Esas fechas las completa el productor.",
      },
      {
        resolution: "30 m",
        what: "Pendiente y elevación",
        source: "SRTM · NASA",
        scope: "Por parcela",
        limit: "Describe el relieve general del área que se dibuja.",
      },
      {
        resolution: "250 m",
        what: "Suelo: textura, pH y carbono",
        source: "SoilGrids · ISRIC",
        scope: "Por grupo de parcelas",
        limit: "Es una estimación. Un análisis de suelo propio pesa más.",
      },
      {
        resolution: "5–10 km",
        what: "Lluvia por mes y por año",
        source: "CHIRPS · GPM IMERG (NASA)",
        scope: "Por zona",
        limit: "Describe la zona, no la parcela.",
      },
      {
        resolution: "55 km",
        what: "Clima general",
        source: "NASA POWER",
        scope: "Por región",
        limit: "Solo sirve como contexto.",
      },
    ],
    sees: {
      title: "Lo que un satélite ve",
      items: [
        "Los meses con suelo descubierto",
        "Las fechas del cultivo",
        "La caída del verdor",
        "Quemas e inundaciones",
        "El déficit de lluvia",
      ],
    },
    blind: {
      title: "Lo que no ve",
      items: [
        "Nematodos y patógenos",
        "Nutrientes del suelo",
        "Precios y mercado",
        "El tipo de cultivo, de forma confiable",
      ],
      note: "Eso lo aportan el productor, el técnico y los estudios.",
    },
    originsTitle: "Cuatro orígenes, siempre a la vista",
  },
  demo: {
    title: ["Dos terrenos,", "una decisión"],
    lead: "La demo cuenta una historia concreta: un productor quiere sembrar frijol y duda entre dos terrenos en alquiler.",
    scope:
      "El prototipo analiza parcelas piloto en Costa Rica. El motor está pensado para cualquier lugar donde haya cobertura de datos.",
    windowTitle: "La demo · paso a paso",
    steps: [
      "Escribe las coordenadas del primer terreno",
      "Confirma el área y lee su ficha",
      "Agrega el segundo terreno y compara",
      "Elige uno y cuenta qué se sembró antes",
      "Compara tres rotaciones y lo que falta verificar",
    ],
    openCta: "Abrir la demo",
    pending: "Demo en construcción · 14 y 15 de noviembre de 2026",
  },
  footer: {
    tagline: "Antes de la semilla, conoce la tierra.",
    event:
      "NASA Space Apps Challenge 2026 · Reto Field Shift: Adapting Farms with NASA Data · San José, Costa Rica",
    disclaimer:
      "Herramienta de apoyo a decisiones. No determina el valor de mercado de un terreno ni reemplaza la revisión legal, catastral o de campo. El contorno dibujado no es un límite catastral verificado.",
    independence: "Proyecto independiente. No implica respaldo de la NASA.",
    backToTop: "Volver arriba",
  },
};
