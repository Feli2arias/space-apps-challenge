/**
 * Words for the screen where a person chooses a plot and starts the analysis,
 * in Spanish and English: header, form, map, loading messages and errors.
 *
 * The results panel has its own dictionary (`./results`), and everything that
 * names a data source comes from that source's message catalogue.
 *
 * Sentences with a `{name}` in them are templates for `fill` (from `./results`).
 */

import type { CoordinateProblem } from "@/lib/analysis/coordinates";
import type { OutlineProblem } from "@/lib/analysis/selection";
import type { AnalysisStatus, AreaKind } from "@/lib/analysis/types";
import type { Locale } from "@/lib/site";

/** Address of this screen in each language. */
export const APP_PATH: Readonly<Record<Locale, string>> = {
  es: "/app",
  en: "/en/app",
};

export interface WorkspaceDictionary {
  readonly locale: Locale;
  readonly meta: { readonly title: string; readonly description: string };
  readonly header: {
    readonly ariaLabel: string;
    readonly homeAria: string;
    readonly home: string;
    readonly otherLocale: Locale;
    readonly otherLocaleLabel: string;
    readonly otherLocaleAria: string;
  };
  readonly intro: { readonly title: string; readonly body: string };
  readonly search: {
    readonly label: string;
    /** Example inside the empty field. */
    readonly placeholder: string;
    readonly submit: string;
    readonly searching: string;
    readonly tooShort: string;
    readonly none: string;
    /** {count} */
    readonly found: string;
    readonly resultsLabel: string;
    /** {place} */
    readonly moved: string;
    readonly dataCredit: string;
    readonly errors: {
      readonly network: string;
      readonly rateLimited: string;
      /** {seconds} */
      readonly rateLimitedWait: string;
      readonly unavailable: string;
    };
  };
  readonly form: {
    readonly ariaLabel: string;
    /** Accessible name of a "?" help button. {topic} */
    readonly helpLabel: string;
    readonly location: {
      readonly legend: string;
      /** One short line under the two fields. */
      readonly hint: string;
      /** Behind the "?" next to the legend. */
      readonly help: string;
      readonly latitude: string;
      readonly latitudePlaceholder: string;
      readonly longitude: string;
      readonly longitudePlaceholder: string;
      /** Replaces the hint in outline mode, where the fields only move the map. */
      readonly outlineModeNote: string;
    };
    readonly area: {
      readonly legend: string;
      /** The hint of the square mode: a coordinate is a point, not a plot. */
      readonly pointNote: string;
      readonly modes: Readonly<Record<AreaKind, string>>;
      /** Behind the "?": what each mode does. */
      readonly help: string;
      readonly sizeLegend: string;
      /** {side} */
      readonly sizeOption: string;
      /** {area} */
      readonly sizeSummary: string;
    };
    readonly outline: {
      /** The hint of the outline mode. */
      readonly instructions: string;
      /** {count} {max} */
      readonly corners: string;
      /** {area} */
      readonly area: string;
      readonly areaPending: string;
      readonly finished: string;
      readonly undo: string;
      readonly finish: string;
      readonly clear: string;
      readonly toolsLabel: string;
      readonly disclaimer: string;
    };
    readonly history: {
      readonly legend: string;
      /** Behind the "?". */
      readonly help: string;
      /** {years} */
      readonly option: string;
    };
    readonly submit: string;
    readonly submitting: string;
    readonly errors: {
      readonly latitude: Readonly<Record<CoordinateProblem, string>>;
      readonly longitude: Readonly<Record<CoordinateProblem, string>>;
      /** {min} {max} {maxCorners} */
      readonly outline: Readonly<Record<OutlineProblem, string>>;
    };
  };
  readonly map: {
    readonly ariaLabel: string;
    readonly loading: string;
    readonly hints: Readonly<Record<AreaKind, string>>;
    readonly layersLabel: string;
    readonly satellite: string;
    readonly streets: string;
    readonly satelliteNote: string;
    readonly zoomIn: string;
    readonly zoomOut: string;
    readonly firstCorner: string;
    /** {side} {area} */
    readonly squareLabel: string;
    /** {area} */
    readonly outlineLabel: string;
  };
  readonly loader: {
    readonly regionLabel: string;
    readonly searching: string;
    readonly preparing: string;
    /** {source} */
    readonly querying: string;
    /** {completed} {total} */
    readonly count: string;
    readonly fromCache: string;
    readonly cancel: string;
  };
  readonly results: {
    readonly heading: string;
    readonly stale: string;
    readonly analyseNew: string;
    /** {sources} */
    readonly retryFailed: string;
    readonly dismiss: string;
    readonly showMap: string;
    readonly hideMap: string;
    /** {lat} {lon} {area} */
    readonly reminder: string;
  };
  readonly announcements: {
    readonly loading: string;
    readonly cancelled: string;
    readonly error: string;
    readonly done: Readonly<Record<AnalysisStatus, string>>;
  };
  readonly failure: {
    readonly title: string;
    readonly network: string;
    readonly rateLimited: string;
    /** {seconds} */
    readonly rateLimitedWait: string;
    readonly invalidRequest: string;
    readonly incomplete: string;
    readonly server: string;
    readonly detailsLabel: string;
    readonly retry: string;
    readonly dismiss: string;
  };
}

const es: WorkspaceDictionary = {
  locale: "es",
  meta: {
    title: "Analiza un terreno | Before the Seed",
    description:
      "Elige un punto o dibuja el contorno de un terreno y consulta datos abiertos de observación de la Tierra para ese lugar: lluvia, vegetación, relieve, suelo y clima.",
  },
  header: {
    ariaLabel: "Principal",
    homeAria: "Before the Seed, volver a la página de inicio",
    home: "Inicio",
    otherLocale: "en",
    otherLocaleLabel: "EN",
    otherLocaleAria: "Use this page in English",
  },
  intro: {
    title: "Analiza un terreno",
    body: "Elige el lugar, el área y los años.",
  },
  search: {
    label: "Lugar",
    placeholder: "Pueblo, distrito o cantón",
    submit: "Buscar",
    searching: "Buscando…",
    tooShort: "Escribe al menos dos letras.",
    none: "No encontramos ese lugar. Prueba con otro nombre o agrega el país.",
    found: "Lugares encontrados: {count}. Elige uno para mover el mapa.",
    resultsLabel: "Lugares encontrados",
    moved: "El mapa está en {place}. Ahora marca tu terreno en el mapa.",
    dataCredit: "Datos de búsqueda:",
    errors: {
      network: "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.",
      rateLimited: "Hiciste muchas búsquedas seguidas. Espera un momento e inténtalo de nuevo.",
      rateLimitedWait: "Hiciste muchas búsquedas seguidas. Espera {seconds} segundos e inténtalo de nuevo.",
      unavailable: "La búsqueda de lugares no está disponible ahora. Puedes escribir las coordenadas o usar el mapa.",
    },
  },
  form: {
    ariaLabel: "Terreno a analizar",
    helpLabel: "Ayuda: {topic}",
    location: {
      legend: "Coordenadas",
      hint: "O haz clic en el mapa, o pega el par 10.95, -84.72.",
      help: "En grados decimales. Al sur del ecuador la latitud es negativa; al oeste de Greenwich, la longitud.",
      latitude: "Latitud",
      latitudePlaceholder: "-90 a 90",
      longitude: "Longitud",
      longitudePlaceholder: "-180 a 180",
      outlineModeNote: "Con el contorno, las coordenadas solo mueven el mapa.",
    },
    area: {
      legend: "Área",
      pointNote: "Una coordenada es un punto, no una parcela.",
      modes: {
        buffer: "Cuadrado",
        polygon: "Contorno",
      },
      help: "Cuadrado: analizamos un cuadrado con el punto en el centro; no es el límite de tu terreno. Contorno: marcas en el mapa las esquinas del terreno.",
      sizeLegend: "Lado",
      sizeOption: "{side} m",
      sizeSummary: "{area} ha",
    },
    outline: {
      instructions: "Marca cada esquina en el mapa, en orden (mín. 3).",
      corners: "Esquinas: {count} de {max}",
      area: "Área: {area} ha",
      areaPending: "Área: falta marcar 3 esquinas",
      finished: "Terminado. Deshacer lo reabre.",
      undo: "Deshacer",
      finish: "Terminar",
      clear: "Borrar",
      toolsLabel: "Herramientas del contorno",
      disclaimer: "No es un límite de propiedad verificado ni catastral.",
    },
    history: {
      legend: "Historial",
      help: "Años completos que consultamos para la lluvia y la vegetación.",
      option: "{years} años",
    },
    submit: "Analizar terreno",
    submitting: "Analizando…",
    errors: {
      latitude: {
        empty: "Escribe la latitud o haz clic en el mapa.",
        "not-a-number": "La latitud debe ser un número en grados decimales, por ejemplo 10.95.",
        "out-of-range": "La latitud debe estar entre -90 y 90.",
      },
      longitude: {
        empty: "Escribe la longitud o haz clic en el mapa.",
        "not-a-number": "La longitud debe ser un número en grados decimales, por ejemplo -84.72.",
        "out-of-range": "La longitud debe estar entre -180 y 180.",
      },
      outline: {
        "too-few-vertices": "Marca al menos 3 esquinas en el mapa.",
        "too-many-vertices": "El contorno admite hasta {maxCorners} esquinas. Borra algunas.",
        "self-intersecting": "El contorno se cruza a sí mismo. Deshaz la última esquina o bórralo y dibújalo de nuevo.",
        "area-too-small": "El área es menor que {min} ha. Dibuja un contorno más grande.",
        "area-too-large": "El área supera las {max} ha. Dibuja un contorno más pequeño.",
      },
    },
  },
  map: {
    ariaLabel: "Mapa para elegir el terreno",
    loading: "Cargando el mapa…",
    hints: {
      buffer: "Haz clic en el mapa para elegir el punto",
      polygon: "Haz clic en el mapa para marcar cada esquina",
    },
    layersLabel: "Fondo del mapa",
    satellite: "Satélite",
    streets: "Calles",
    satelliteNote: "Imagen Sentinel-2 de 2025 · 10 m por píxel",
    zoomIn: "Acercar",
    zoomOut: "Alejar",
    firstCorner: "Primera esquina. Actívala para terminar el contorno.",
    squareLabel: "{side} m × {side} m · {area} ha",
    outlineLabel: "{area} ha",
  },
  loader: {
    regionLabel: "Análisis en curso",
    searching: "Buscando datos para tu terreno…",
    preparing: "Preparando los resultados…",
    querying: "Consultando: {source}…",
    count: "({completed} de {total})",
    fromCache: "Resultado guardado",
    cancel: "Cancelar",
  },
  results: {
    heading: "Resultados",
    stale: "Cambiaste la selección. Estos resultados son del área anterior, que sigue en el mapa con línea punteada.",
    analyseNew: "Analizar la nueva selección",
    retryFailed: "No pudimos volver a consultar: {sources}. Inténtalo de nuevo.",
    dismiss: "Cerrar aviso",
    showMap: "Ver mapa",
    hideMap: "Ocultar mapa",
    reminder: "Lat {lat}, Lon {lon} · {area}",
  },
  announcements: {
    loading: "Análisis en curso.",
    cancelled: "Análisis cancelado.",
    error: "El análisis no se pudo completar.",
    done: {
      complete: "Resultados listos.",
      partial: "Resultados parciales: algunas fuentes no respondieron.",
      failed: "Ninguna fuente respondió. Puedes volver a consultar cada una.",
    },
  },
  failure: {
    title: "No pudimos completar el análisis",
    network: "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.",
    rateLimited: "Hiciste muchos análisis seguidos. Espera un momento e inténtalo de nuevo.",
    rateLimitedWait: "Hiciste muchos análisis seguidos. Espera {seconds} segundos e inténtalo de nuevo.",
    invalidRequest: "El servidor no aceptó el área elegida. Revisa las coordenadas o el contorno.",
    incomplete: "La respuesta se cortó antes de terminar. Inténtalo de nuevo.",
    server: "El servidor tuvo un problema al hacer el análisis. Inténtalo de nuevo.",
    detailsLabel: "Detalle técnico",
    retry: "Reintentar",
    dismiss: "Cerrar",
  },
};

const en: WorkspaceDictionary = {
  locale: "en",
  meta: {
    title: "Analyse a plot | Before the Seed",
    description:
      "Choose a point or draw the outline of a plot and query open Earth-observation data for that place: rainfall, vegetation, terrain, soil and climate.",
  },
  header: {
    ariaLabel: "Main",
    homeAria: "Before the Seed, back to the home page",
    home: "Home",
    otherLocale: "es",
    otherLocaleLabel: "ES",
    otherLocaleAria: "Usar esta página en español",
  },
  intro: {
    title: "Analyse a plot",
    body: "Choose the place, the area and the years.",
  },
  search: {
    label: "Place",
    placeholder: "Town, district or county",
    submit: "Search",
    searching: "Searching…",
    tooShort: "Type at least two letters.",
    none: "We could not find that place. Try another name or add the country.",
    found: "Places found: {count}. Choose one to move the map.",
    resultsLabel: "Places found",
    moved: "The map is at {place}. Now mark your plot on the map.",
    dataCredit: "Search data:",
    errors: {
      network: "There is no connection to the server. Check your internet and try again.",
      rateLimited: "You searched many times in a row. Wait a moment and try again.",
      rateLimitedWait: "You searched many times in a row. Wait {seconds} seconds and try again.",
      unavailable: "The place search is not available right now. You can type the coordinates or use the map.",
    },
  },
  form: {
    ariaLabel: "Plot to analyse",
    helpLabel: "Help: {topic}",
    location: {
      legend: "Coordinates",
      hint: "Or click the map, or paste the pair 10.95, -84.72.",
      help: "In decimal degrees. South of the equator the latitude is negative; west of Greenwich, the longitude.",
      latitude: "Latitude",
      latitudePlaceholder: "-90 to 90",
      longitude: "Longitude",
      longitudePlaceholder: "-180 to 180",
      outlineModeNote: "With the outline, the coordinates only move the map.",
    },
    area: {
      legend: "Area",
      pointNote: "A coordinate is a point, not a plot.",
      modes: {
        buffer: "Square",
        polygon: "Outline",
      },
      help: "Square: we analyse a square with the point at its centre; it is not the boundary of your plot. Outline: you mark the corners of the plot on the map.",
      sizeLegend: "Side",
      sizeOption: "{side} m",
      sizeSummary: "{area} ha",
    },
    outline: {
      instructions: "Click each corner on the map, in order (min. 3).",
      corners: "Corners: {count} of {max}",
      area: "Area: {area} ha",
      areaPending: "Area: mark 3 corners first",
      finished: "Finished. Undo reopens it.",
      undo: "Undo",
      finish: "Finish",
      clear: "Clear",
      toolsLabel: "Outline tools",
      disclaimer: "Not a verified property boundary or a cadastral one.",
    },
    history: {
      legend: "History",
      help: "Full years we query for rainfall and vegetation.",
      option: "{years} years",
    },
    submit: "Analyse plot",
    submitting: "Analysing…",
    errors: {
      latitude: {
        empty: "Type the latitude or click the map.",
        "not-a-number": "The latitude must be a number in decimal degrees, for example 10.95.",
        "out-of-range": "The latitude must be between -90 and 90.",
      },
      longitude: {
        empty: "Type the longitude or click the map.",
        "not-a-number": "The longitude must be a number in decimal degrees, for example -84.72.",
        "out-of-range": "The longitude must be between -180 and 180.",
      },
      outline: {
        "too-few-vertices": "Mark at least 3 corners on the map.",
        "too-many-vertices": "The outline can have up to {maxCorners} corners. Remove some.",
        "self-intersecting": "The outline crosses itself. Undo the last corner or clear it and draw it again.",
        "area-too-small": "The area is smaller than {min} ha. Draw a larger outline.",
        "area-too-large": "The area is larger than {max} ha. Draw a smaller outline.",
      },
    },
  },
  map: {
    ariaLabel: "Map to choose the plot",
    loading: "Loading the map…",
    hints: {
      buffer: "Click the map to choose the point",
      polygon: "Click the map to mark each corner",
    },
    layersLabel: "Map background",
    satellite: "Satellite",
    streets: "Streets",
    satelliteNote: "Sentinel-2 image from 2025 · 10 m per pixel",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    firstCorner: "First corner. Activate it to finish the outline.",
    squareLabel: "{side} m × {side} m · {area} ha",
    outlineLabel: "{area} ha",
  },
  loader: {
    regionLabel: "Analysis in progress",
    searching: "Looking for data for your plot…",
    preparing: "Preparing the results…",
    querying: "Querying: {source}…",
    count: "({completed} of {total})",
    fromCache: "Saved result",
    cancel: "Cancel",
  },
  results: {
    heading: "Results",
    stale: "You changed the selection. These results are for the previous area, still on the map as a dashed line.",
    analyseNew: "Analyse the new selection",
    retryFailed: "We could not query again: {sources}. Try again.",
    dismiss: "Close notice",
    showMap: "Show map",
    hideMap: "Hide map",
    reminder: "Lat {lat}, Lon {lon} · {area}",
  },
  announcements: {
    loading: "Analysis in progress.",
    cancelled: "Analysis cancelled.",
    error: "The analysis could not be completed.",
    done: {
      complete: "Results ready.",
      partial: "Partial results: some sources did not answer.",
      failed: "No source answered. You can query each one again.",
    },
  },
  failure: {
    title: "We could not complete the analysis",
    network: "There is no connection to the server. Check your internet and try again.",
    rateLimited: "You ran many analyses in a row. Wait a moment and try again.",
    rateLimitedWait: "You ran many analyses in a row. Wait {seconds} seconds and try again.",
    invalidRequest: "The server did not accept the chosen area. Check the coordinates or the outline.",
    incomplete: "The answer was cut off before it finished. Try again.",
    server: "The server had a problem running the analysis. Try again.",
    detailsLabel: "Technical detail",
    retry: "Try again",
    dismiss: "Close",
  },
};

export const WORKSPACE_DICTIONARY: Readonly<Record<Locale, WorkspaceDictionary>> = { es, en };

export function getWorkspaceDictionary(locale: Locale): WorkspaceDictionary {
  return WORKSPACE_DICTIONARY[locale];
}
