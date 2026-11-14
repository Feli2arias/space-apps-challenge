/**
 * Class names of the workspace's areas in its two modes:
 * - choosing a place: intro and form in a column, the map beside it (from lg) or
 *   above the form (phones);
 * - results: the form leaves and the results take the whole screen; when the map
 *   is open it sits beside them (from lg) or above them (phones).
 * Hidden areas stay mounted (the map keeps its view, the results keep their tabs).
 */

export interface WorkspaceLayout {
  readonly root: string;
  readonly main: string;
  readonly intro: string;
  readonly form: string;
  readonly map: string;
  readonly results: string;
}

const MAP_BASE = "relative scroll-mt-2 border-ink bg-mist";

export function layoutOf(resultsMode: boolean, mapInResults: boolean): WorkspaceLayout {
  if (!resultsMode) {
    return {
      root: "flex min-h-dvh flex-col lg:h-dvh",
      main: "flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]",
      intro:
        "border-b border-line bg-paper px-gutter pt-4 pb-3 lg:col-start-1 lg:px-8 lg:row-start-1 lg:border-r lg:border-b-0 lg:border-ink",
      form: "order-1 bg-paper px-gutter pt-4 lg:order-none lg:px-8 lg:pb-4 lg:col-start-1 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-ink",
      map: `${MAP_BASE} h-[65dvh] min-h-80 border-b lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto lg:min-h-0 lg:border-b-0`,
      results: "hidden",
    };
  }
  return {
    root: "flex h-dvh flex-col",
    main: mapInResults
      ? "flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)]"
      : "flex min-h-0 flex-1 flex-col",
    intro: "hidden",
    form: "hidden",
    map: mapInResults
      ? `${MAP_BASE} h-[38dvh] shrink-0 border-b lg:col-start-1 lg:row-start-1 lg:h-auto lg:border-r lg:border-b-0`
      : "hidden",
    results: mapInResults ? "min-h-0 flex-1 lg:col-start-2 lg:row-start-1" : "min-h-0 flex-1",
  };
}
