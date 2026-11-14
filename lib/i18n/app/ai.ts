import type { Locale } from "@/lib/site";

/** Words of everything the language model writes on the results screen. */
export interface AiDictionary {
  /** Tag that always marks generated text. */
  readonly origin: string;
  readonly basedOn: string;
  readonly retry: string;
  readonly errors: {
    readonly failed: string;
    readonly notReady: string;
    readonly rateLimited: string;
  };
  readonly reading: {
    readonly title: string;
    readonly working: string;
    readonly groups: {
      readonly favorable: string;
      readonly alerts: string;
      readonly toCheck: string;
    };
    /** Shown in a group the data gave nothing for. */
    readonly emptyGroup: string;
    /** Open and close the explanations of a group on narrow screens. */
    readonly more: string;
    readonly less: string;
    /** `{count}` is replaced by the number of results used. */
    readonly basis: string;
  };
  readonly advice: {
    readonly title: string;
    readonly intro: string;
    readonly request: string;
    readonly working: string;
    readonly why: string;
    readonly basis: string;
  };
  readonly chat: {
    readonly title: string;
    readonly intro: string;
    readonly inputLabel: string;
    readonly placeholder: string;
    readonly send: string;
    readonly working: string;
    readonly you: string;
    readonly assistant: string;
    readonly suggestionsLabel: string;
    readonly suggestions: readonly string[];
    /** Tag on an answer that says the analysis does not hold the information. */
    readonly noData: string;
    /** Shown instead of an answer that did not pass the checks. */
    readonly discarded: string;
    /** `{left}` is replaced by the characters still available. */
    readonly remaining: string;
  };
}

export const AI_DICTIONARY: Readonly<Record<Locale, AiDictionary>> = {
  es: {
    origin: "Generado por IA",
    basedOn: "Se apoya en",
    retry: "Probar otra vez",
    errors: {
      failed: "No se pudo generar el texto en este momento. Los datos de abajo no cambian.",
      notReady: "Todavía no hay resultados guardados de este terreno. Vuelve a analizarlo y prueba otra vez.",
      rateLimited: "Se hicieron muchas consultas seguidas. Espera un momento y prueba otra vez.",
    },
    reading: {
      title: "Qué dicen los datos",
      working: "La IA está leyendo los resultados de este terreno…",
      groups: {
        favorable: "A favor",
        alerts: "Posibles problemas",
        toCheck: "Conviene revisar",
      },
      emptyGroup: "Nada que destacar con estos datos.",
      more: "Ver el porqué",
      less: "Ocultar el porqué",
      basis:
        "Escrito por un modelo de lenguaje con {count} resultados de este análisis. Cada cifra se comprobó contra esos resultados.",
    },
    advice: {
      title: "Recomendaciones",
      intro: "Pide a la IA qué revisar y qué preparar en este terreno. Cada punto llega con su porqué.",
      request: "Solicitar recomendaciones",
      working: "La IA está preparando las recomendaciones…",
      why: "Por qué",
      basis:
        "Son puntos para revisar, escritos solo con los datos de este análisis. No reemplazan la visita al terreno ni a un agrónomo.",
    },
    chat: {
      title: "Pregunta sobre este terreno",
      intro: "Responde solo con los datos de este análisis. Si un dato no está, te lo dice en vez de suponerlo.",
      inputLabel: "Tu pregunta",
      placeholder: "Escribe tu pregunta",
      send: "Preguntar",
      working: "La IA está buscando la respuesta en los datos…",
      you: "Tú",
      assistant: "IA",
      suggestionsLabel: "Preguntas de ejemplo",
      suggestions: [
        "¿En qué meses llueve más?",
        "¿Qué significa el pH del suelo?",
        "¿Qué partes del terreno tienen más pendiente?",
      ],
      noData: "Sin dato en este análisis",
      discarded:
        "La respuesta se descartó porque incluía datos que no están en este análisis. Prueba a preguntarlo de otra forma.",
      remaining: "{left} caracteres",
    },
  },
  en: {
    origin: "AI-generated",
    basedOn: "Based on",
    retry: "Try again",
    errors: {
      failed: "The text could not be generated right now. The data below do not change.",
      notReady: "There are no saved results for this plot yet. Analyse it again and try once more.",
      rateLimited: "Too many requests in a row. Wait a moment and try again.",
    },
    reading: {
      title: "What the data say",
      working: "The AI is reading the results for this plot…",
      groups: {
        favorable: "In favour",
        alerts: "Possible problems",
        toCheck: "Worth checking",
      },
      emptyGroup: "Nothing to highlight with these data.",
      more: "Show why",
      less: "Hide why",
      basis:
        "Written by a language model from {count} results of this analysis. Every figure was checked against those results.",
    },
    advice: {
      title: "Recommendations",
      intro: "Ask the AI what to check and what to prepare on this plot. Each point comes with its reason.",
      request: "Request recommendations",
      working: "The AI is preparing the recommendations…",
      why: "Why",
      basis:
        "These are points to review, written only from the data of this analysis. They do not replace a visit to the plot or an agronomist.",
    },
    chat: {
      title: "Ask about this plot",
      intro: "It answers only from the data of this analysis. If something is not there, it says so instead of assuming.",
      inputLabel: "Your question",
      placeholder: "Type your question",
      send: "Ask",
      working: "The AI is looking for the answer in the data…",
      you: "You",
      assistant: "AI",
      suggestionsLabel: "Example questions",
      suggestions: [
        "Which months get the most rain?",
        "What does the soil pH mean?",
        "Which parts of the plot are steepest?",
      ],
      noData: "Not in this analysis",
      discarded:
        "The answer was discarded because it included data that are not in this analysis. Try asking it another way.",
      remaining: "{left} characters",
    },
  },
};
