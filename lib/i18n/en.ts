import type { Dictionary } from "./types";

export const en: Dictionary = {
  locale: "en",
  meta: {
    title: "Before the Seed | Before the seed, know the land",
    description:
      "Know a plot before renting or buying it, and compare crop rotations before planting, using Earth observation data and agronomic evidence. A NASA Space Apps Challenge 2026 project.",
  },
  skipToContent: "Skip to content",
  nav: {
    ariaLabel: "Main",
    links: [
      { section: "problem", label: "The problem" },
      { section: "how", label: "How it works" },
      { section: "analyses", label: "Analyses" },
      { section: "rotations", label: "Rotations" },
      { section: "data", label: "Data" },
    ],
    cta: "The demo",
    otherLocale: "es",
    otherLocaleLabel: "ES",
    otherLocaleAria: "Leer esta página en español",
  },
  hero: {
    titleLines: ["Before", "the seed,"],
    titleHighlight: "know the land",
    lead: "Enter a pair of coordinates and see the rainfall, the slope and the history visible from space. Know the plot before you rent, and compare rotations before you plant.",
    primaryCta: "See how it works",
    secondaryCta: "The three rotations",
    note: "NASA Space Apps 2026 · Field Shift challenge · Pilot in Costa Rica",
  },
  sources: {
    label: "Built on data from",
    items: ["Landsat 8/9", "SRTM", "GPM IMERG", "SoilGrids", "NASA POWER"],
  },
  stats: {
    ariaLabel: "At a glance",
    items: [
      {
        value: "02",
        label: "connected decisions: choosing the plot and planning what to plant",
      },
      {
        value: "03",
        label: "rotations side by side, including the one already in use",
      },
      {
        value: "30 m",
        label: "is the pixel size the satellite uses to see ground cover on each plot",
      },
      {
        value: "0",
        label: "accounts to create or apps to install: it is a website for your phone",
      },
    ],
  },
  origins: {
    observed: {
      label: "Observed",
      description: "A satellite measured it over that area.",
    },
    modeled: {
      label: "Modeled",
      description: "It comes from a calculation whose assumptions are shown.",
    },
    declared: {
      label: "Declared",
      description: "The farmer or the landowner reports it.",
    },
    study: {
      label: "From a study",
      description: "It comes from a publication, with its region and its limits.",
    },
  },
  problem: {
    eyebrow: "The problem",
    title: ["A visit doesn't", "tell the history"],
    intro:
      "A plot for rent or for sale looks fine on the day you visit. What you cannot see that day is what decides the harvest: the rainfall of other years, the months it sat bare, and what was grown there before.",
    cards: [
      {
        icon: "rain",
        title: "How rainfall changes from year to year",
        body: "Totals by month and by year, dry and wet months, and how much they vary between years. This describes the area, not the plot.",
        origin: "observed",
      },
      {
        icon: "bare",
        title: "How long the soil sat bare",
        body: "The months when the plot shows no ground cover, and whether they overlap with the rainiest months.",
        origin: "observed",
      },
      {
        icon: "slope",
        title: "How steep it is",
        body: "Elevation and slope of the area, and what they mean for management and for comparing erosion.",
        origin: "observed",
      },
      {
        icon: "sprout",
        title: "What the previous crop left behind",
        body: "What was grown before can decide whether the next crop gets sick. That cannot be seen from space: the person who planted it has to say.",
        origin: "declared",
      },
    ],
  },
  how: {
    eyebrow: "The journey",
    title: ["How it works"],
    intro:
      "From a pair of coordinates to a decision, in five steps. The map shows and the analysis calculates: an image on a map is not a measurement of the land.",
    steps: [
      {
        title: "Find the location",
        body: "Type latitude and longitude, paste coordinates, search for a place or tap a point on the map.",
      },
      {
        title: "Confirm the area",
        body: "A coordinate marks a place, not its boundaries. Draw the outline so the numbers describe that plot.",
      },
      {
        title: "Read the plot sheet",
        body: "Rainfall, slope, ground cover and soil. Each figure with its source, period, resolution and what is missing.",
      },
      {
        title: "Ask for recommendations",
        body: "Recommendations written from the plot's own figures, each with its reason. Ask questions and download the sheet as a PDF.",
      },
      {
        title: "Compare rotations",
        body: "Three crop sequences, including the current one, each with its calendar, its evidence and its gaps.",
      },
    ],
  },
  analyses: {
    eyebrow: "What sets it apart",
    title: ["Two questions", "before planting"],
    intro:
      "They are shown separately so the trade-offs stay visible: a rotation can protect the soil better and have less plant-health evidence behind it, or the other way round.",
    items: [
      {
        letter: "A",
        title: "What the previous crop leaves behind",
        body: "Amachamiento leaves bean plants green and empty. It is caused by a nematode that survives in the residue of the previous crop and in weeds, not in the seed. A study in Costa Rica's Brunca region measured its incidence by what had been grown before.",
        chartTitle: "Incidence of amachamiento in beans, by previous crop",
        bars: [
          { label: "Maize", value: 64, display: "64%", tone: "accent" },
          { label: "Beans", value: 62, display: "62%", tone: "accent" },
          { label: "Rice", value: 29, display: "29%", tone: "accent" },
          { label: "Squash", value: 15, display: "15%", tone: "accent" },
          { label: "Chili pepper", value: 4, display: "4%", tone: "accent" },
        ],
        source:
          "Chaves and Araya (2012), Agronomía Costarricense 36(2). Brunca region, 2009. Observational study, no replicates.",
        origin: "study",
        caveat:
          "This is what was observed on those farms, not the probability for any given plot. Satellites do not detect the nematode or recognize the previous crop.",
      },
      {
        letter: "B",
        title: "What happens when the soil is left bare",
        body: "Rain falling on bare soil carries it away. The months without cover, the rainfall in those months and the slope are combined to compare one rotation with another. It is for comparing, not for quoting tonnes.",
        chartTitle: "Modeled soil loss, relative to potato after potato (= 1.00)",
        bars: [
          { label: "Fallow with bare soil", value: 1.26, display: "1.26", tone: "accent" },
          { label: "Potato after potato (reference)", value: 1, display: "1.00", tone: "ink" },
          { label: "Oats or green manure in the gap", value: 0.88, display: "0.88", tone: "accent" },
        ],
        source:
          "Our own test with the RUSLE equation on a hillside plot in Cartago. The cover factors per crop are assumptions and need local validation.",
        origin: "modeled",
        caveat:
          "The harvest month moved the result by ±27%, more than the choice of crop. That is why the calendar is part of the comparison.",
      },
    ],
  },
  rotations: {
    eyebrow: "The bean case",
    title: ["Three rotations,", "side by side"],
    intro:
      "The demo case: a bean-growing family in northern Costa Rica that rents its plot one cycle at a time. These are candidates to compare, not recommendations.",
    rotationLabel: "Rotation",
    sequenceAria: "Crop sequence",
    evidenceLabel: "Evidence",
    gapsLabel: "Still unknown",
    cards: [
      {
        code: "A",
        badge: "Current practice",
        sequence: [
          { label: "Maize", kind: "previous" },
          { label: "Beans", kind: "target" },
        ],
        evidence:
          "With maize as the previous crop, the Brunca study recorded a 64% incidence of amachamiento. On a single farm (2010), 25%.",
        origin: "study",
        gaps: "How crop residue and soil are managed between one cycle and the next. The farmer reports that.",
      },
      {
        code: "B",
        badge: null,
        sequence: [
          { label: "Tannia or ginger", kind: "previous" },
          { label: "Beans", kind: "target" },
        ],
        evidence:
          "On one farm (2010): maize 25%, tannia 5%, ginger 4%. The study observed about five times fewer diseased plants.",
        origin: "study",
        gaps: "It is a single farm in another region, with no replicates. Still to confirm: that the cycle fits the rental period and that there is a market.",
      },
      {
        code: "C",
        badge: "No local evidence",
        sequence: [
          { label: "Green manure (mucuna)", kind: "cover" },
          { label: "Beans", kind: "target" },
        ],
        evidence:
          "It keeps the soil covered between cycles. In the erosion test run in Cartago, covering the soil instead of leaving it bare cut modeled loss by about 30%.",
        origin: "modeled",
        gaps: "There is no local evidence of its effect on amachamiento. Whether it is viable in the area needs field validation.",
      },
    ],
    disclaimer:
      "Before the Seed supports the decision. It does not replace the farmer's judgment or a review by the local agronomist.",
  },
  data: {
    eyebrow: "Data and limits",
    title: ["Every number says", "where it comes from"],
    intro:
      "Each indicator shows its source, period, resolution and what is missing. When the pixel is larger than the plot, the figure describes the surroundings, not that piece of land.",
    resolutionLabel: "Pixel size",
    rows: [
      {
        resolution: "30 m",
        what: "Ground cover and bare soil",
        source: "Landsat 8/9 · NASA and USGS",
        scope: "Per plot",
        limit:
          "From July to November clouds leave few usable images. The farmer fills in those dates.",
      },
      {
        resolution: "30 m",
        what: "Slope and elevation",
        source: "SRTM · NASA",
        scope: "Per plot",
        limit: "Describes the general relief of the area drawn.",
      },
      {
        resolution: "250 m",
        what: "Soil: texture, pH and carbon",
        source: "SoilGrids · ISRIC",
        scope: "Per group of plots",
        limit: "It is an estimate. A soil test of your own carries more weight.",
      },
      {
        resolution: "11 km",
        what: "Rainfall by month and by year",
        source: "GPM IMERG · NASA",
        scope: "Per area",
        limit: "Describes the area, not the plot.",
      },
      {
        resolution: "55 km",
        what: "General climate",
        source: "NASA POWER",
        scope: "Per region",
        limit: "Useful as context only.",
      },
    ],
    sees: {
      title: "What a satellite sees",
      items: [
        "Months with bare soil",
        "Crop dates",
        "Drops in greenness",
        "Burns and floods",
        "Rainfall deficit",
      ],
    },
    blind: {
      title: "What it does not see",
      items: [
        "Nematodes and pathogens",
        "Soil nutrients",
        "Prices and markets",
        "The crop type, reliably",
      ],
      note: "The farmer, the agronomist and the studies provide that.",
    },
    originsTitle: "Four origins, always in view",
  },
  demo: {
    title: ["One plot,", "one decision"],
    lead: "The demo tells one concrete story: a farmer wants to plant beans and is weighing a plot for rent.",
    scope:
      "The prototype analyzes pilot plots in Costa Rica. The engine is designed for anywhere the data covers.",
    windowTitle: "The demo · step by step",
    steps: [
      "Enter the coordinates of the first plot",
      "Confirm the area and read its sheet",
      "Ask for recommendations and download the PDF",
      "Say what was grown before",
      "Compare three rotations and what is left to verify",
    ],
    openCta: "Open the demo",
    pending: "Demo in progress · November 14–15, 2026",
  },
  footer: {
    tagline: "Before the seed, know the land.",
    event:
      "NASA Space Apps Challenge 2026 · Field Shift: Adapting Farms with NASA Data · San José, Costa Rica",
    disclaimer:
      "A decision-support tool. It does not determine the market value of a plot or replace legal, cadastral or field review. The outline you draw is not a verified property boundary.",
    independence: "Independent project. It does not imply endorsement by NASA.",
    backToTop: "Back to top",
  },
};
