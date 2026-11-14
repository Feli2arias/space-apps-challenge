/**
 * Published evidence on how the crop grown before beans relates to
 * "amachamiento", a bean disease caused by the nematode Aphelenchoides besseyi.
 *
 * Every figure here was copied from the paper itself (abstract and Cuadro 2):
 *   Chaves, N. F. & Araya, C. M. (2012). Efecto de la rotación de cultivos en
 *   la incidencia del amachamiento (Aphelenchoides besseyi Christie) en frijol.
 *   Agronomía Costarricense 36(2): 61-70.
 *
 * It is an observational study in another region (Brunca), on commercial farms,
 * so these numbers describe what was seen there. They are not a probability
 * for any other plot, and the interface must never present them as one.
 */

export const AMACHAMIENTO_STUDY = {
  authors: "Chaves y Araya",
  year: 2012,
  journal: "Agronomía Costarricense 36(2): 61-70",
  url: "https://www.scielo.sa.cr/pdf/ac/v36n2/a04v36n2.pdf",
  region: "Brunca, Costa Rica",
} as const;

/** Crops a person can declare as grown before the beans. */
export const PREVIOUS_CROPS = [
  "maize",
  "beans",
  "rice",
  "squash",
  "chili",
  "ginger",
  "tannia",
  "cover-crop",
  "pasture",
  "other",
  "unknown",
] as const;

export type PreviousCrop = (typeof PREVIOUS_CROPS)[number];

/**
 * Which part of the study an observation comes from.
 * - "brunca-2009": commercial fields in several farms, incidence at pod filling (stage R8).
 * - "pejibaye-2010": three half-hectare plots in one farm (Las Delicias de Pejibaye, Pérez Zeledón).
 */
export type StudySetting = "brunca-2009" | "pejibaye-2010";

export interface IncidenceObservation {
  readonly setting: StudySetting;
  /** Percentage of bean plants with amachamiento, as printed in the paper. */
  readonly incidencePercent: number;
  /**
   * Letters of the paper's Duncan test (p ≤ 0.05) for the 2009 data: rotations
   * sharing a letter were not significantly different. `null` where the paper
   * gives no letters.
   */
  readonly significanceGroup: string | null;
}

const OBSERVATIONS: Readonly<Partial<Record<PreviousCrop, readonly IncidenceObservation[]>>> = {
  chili: [{ setting: "brunca-2009", incidencePercent: 3.66, significanceGroup: "a" }],
  squash: [{ setting: "brunca-2009", incidencePercent: 15.43, significanceGroup: "ab" }],
  rice: [{ setting: "brunca-2009", incidencePercent: 28.73, significanceGroup: "b" }],
  beans: [{ setting: "brunca-2009", incidencePercent: 62.19, significanceGroup: "c" }],
  maize: [
    { setting: "brunca-2009", incidencePercent: 63.57, significanceGroup: "c" },
    { setting: "pejibaye-2010", incidencePercent: 25, significanceGroup: null },
  ],
  ginger: [{ setting: "pejibaye-2010", incidencePercent: 4, significanceGroup: null }],
  tannia: [{ setting: "pejibaye-2010", incidencePercent: 5, significanceGroup: null }],
};

/**
 * What the study observed for beans grown after `crop`.
 * An empty list means the study did not look at that crop: there is no local
 * evidence either way, which is different from "no disease".
 */
export function evidenceFor(crop: PreviousCrop): readonly IncidenceObservation[] {
  return OBSERVATIONS[crop] ?? [];
}

/** True when the paper lists the crop as a known host of the nematode. */
export function isKnownHost(crop: PreviousCrop): boolean | null {
  // The paper names maize, rice and beans as hosts, and says squash, tannia and
  // ginger are not known hosts and chili is not considered one.
  if (crop === "maize" || crop === "rice" || crop === "beans") return true;
  if (crop === "squash" || crop === "tannia" || crop === "ginger" || crop === "chili") return false;
  return null;
}
