import { SOURCE_MESSAGES } from "@/lib/analysis/sources/messages";
import type { SourceId, SourceProgress } from "@/lib/analysis/types";
import { fill } from "@/lib/i18n/app/results";
import type { WorkspaceDictionary } from "@/lib/i18n/app/workspace";
import type { Locale } from "@/lib/site";
import { haveAllSourcesFinished, type AnalysisState, type SourceTrack } from "./analysis-state";
import type { LoaderSource, SeedLoaderProps } from "./seed-loader";

/**
 * Turns the events received so far into the words the loading screen shows.
 *
 * The message always describes something the backend has confirmed:
 * - nothing reported yet: a general "looking for data" message;
 * - a source reported a step: that step, in the source's own words, with its
 *   count when the source can count (scenes, years…);
 * - every source finished but the final answer has not arrived: "preparing".
 * No percentage is ever computed here: the backend does not send one.
 */

type LoaderWords = WorkspaceDictionary["loader"];

function countOf(progress: SourceProgress, words: LoaderWords): string | null {
  const { completed, total } = progress;
  if (completed === undefined || total === undefined) return null;
  return fill(words.count, { completed, total });
}

/** The step a source reported, in the source's own words. */
export function progressText(
  source: SourceId,
  progress: SourceProgress,
  locale: Locale,
  words: LoaderWords,
): string {
  const messages = SOURCE_MESSAGES[source][locale];
  // A stage the catalogue does not name is still real progress: say which
  // source is working instead of showing a code or hiding it.
  const stage = messages.stages[progress.stage] ?? fill(words.querying, { source: messages.title });
  const count = countOf(progress, words);
  return count ? `${stage} ${count}` : stage;
}

function detailOf(track: SourceTrack, locale: Locale, words: LoaderWords): string | undefined {
  if (track.state === "running" && track.progress) {
    return progressText(track.id, track.progress, locale, words);
  }
  if (track.state === "done" && track.fromCache) return words.fromCache;
  return undefined;
}

function toLoaderSource(track: SourceTrack, locale: Locale, words: LoaderWords): LoaderSource {
  const detail = detailOf(track, locale, words);
  const source = { id: track.id, label: SOURCE_MESSAGES[track.id][locale].title, state: track.state };
  return detail === undefined ? source : { ...source, detail };
}

function messageOf(state: AnalysisState, locale: Locale, words: LoaderWords): string {
  if (haveAllSourcesFinished(state)) return words.preparing;

  const latest = state.progressOrder.at(-1);
  const track = state.tracks.find((candidate) => candidate.id === latest);
  if (track?.progress) return progressText(track.id, track.progress, locale, words);

  return words.searching;
}

/** Props for `SeedLoader`, derived from what the backend has reported so far. */
export function toLoaderView(
  state: AnalysisState,
  locale: Locale,
  words: LoaderWords,
): SeedLoaderProps {
  return {
    message: messageOf(state, locale, words),
    sources: state.tracks.map((track) => toLoaderSource(track, locale, words)),
  };
}
