# Before the Seed

*Before the seed, know the land.*

A project for the NASA Space Apps Challenge 2026 (challenge "Field Shift: Adapting Farms with NASA Data"), San José, Costa Rica.

Live at **https://before-the-seed.vercel.app**

- **Landing:** English at `/` (default language), Spanish at `/es`.
- **App:** `/app` (English) and `/es/app` (Spanish). You mark a plot on the map, it is analysed with open Earth observation data, and you compare three crop rotations.
- Next.js (App Router) + Tailwind CSS v4. No database and no accounts.

## Running it

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Other commands:

```bash
pnpm build      # production build
pnpm test       # tests (Vitest)
pnpm lint       # ESLint
pnpm typecheck  # TypeScript
```

## How the analysis works

1. The person types coordinates, searches for a place or taps the map, and picks a square around the point or draws the outline.
2. `POST /api/analysis` validates the area and queries five sources separately. It answers as a stream (one JSON line per event), so the loading screen shows what the server has already confirmed.
3. Each result says what it describes (the plot, the pixel or the region), which product and version it comes from, when it was obtained and its limits. If one source fails, the others are still shown and that one can be retried.
4. Results are cached by area, period and product. When a figure comes from the cache, the panel says so and shows the date it was obtained.

### Connected sources (none needs a key)

| What | Product | Service | Pixel | Describes |
|---|---|---|---|---|
| Daily rainfall | GPM IMERG Late Run V07 (NASA) | SERVIR ClimateSERV | ~11 km | The region |
| Greenness (NDVI) | Landsat 8/9 Collection 2 Level-2 (NASA/USGS) | Microsoft Planetary Computer | 30 m | The plot |
| Elevation and slope | SRTM GL1 (NASA) | Open Topo Data | 30 m | The plot |
| Soil | SoilGrids 2.0 (ISRIC) | ISRIC map service (WCS); the SoilGrids REST API as fallback | 250 m | The region |
| Temperature | NASA POWER (MERRA-2) | POWER API | ~55 km | The region |
| Place search | OpenStreetMap | Nominatim | — | — |

The map shows Sentinel-2 cloudless imagery by EOX and OpenStreetMap tiles. They are a backdrop: the figures come from the sources above, never from the picture on the map.

Times measured on 14 November 2026 on a plot in Los Chiles: rainfall takes about 60 s for 3 years and 75 s for 5 (the service processes one year every ~47 s); vegetation, about 25 s for 320 scenes; the rest, under 5 s. The second time everything comes from the cache at once.

### Other routes

- `GET /api/geocode?q=…&lang=en` — searches for places.
- `GET /api/geocode/reverse?lat=…&lon=…&lang=en` — says in words where a point falls: town, region and country.
- `POST /api/rotations` — compares declared rotations: published evidence about the previous crop, and the soil's relative exposure to rain. They are two separate readings; they are not added into a score.
- `POST /api/reading` — first reading of the analysis written by a Claude model (Anthropic): a plain-language summary and points in favour, possible problems and things to check.
- `GET` and `POST /api/recommend` — recommendations, each with its reason, on request. The `GET` says whether a key is configured.
- `POST /api/ask` — answers a question about the analysis and its recommendations.
- `POST /api/report` — the results of an analysis as a PDF file ("Download PDF" button). It is written from what the server already computed and cached; it includes the model's reading and recommendations only if they had already been generated.

The three model routes use only results the server already computed and cached, do not send the coordinates to the model, and discard any text that mentions a figure that is not in the analysis or that leans on a source with no data. They need `ANTHROPIC_API_KEY`; without the key those sections do not appear.

### Environment variables

None is required. They are described in `.env.example`; to use them, copy that file to `.env.local`.

## Where each thing is changed

| What | Where |
|---|---|
| Landing copy | `lib/i18n/en.ts` and `lib/i18n/es.ts` |
| App copy | `lib/i18n/app/` |
| Copy for each data source | `lib/analysis/sources/*.messages.ts` |
| Each data source | `lib/analysis/sources/` |
| Data contract (types) | `lib/analysis/types.ts` |
| Rotation model and the study's figures | `lib/rotation/` |
| Model texts: facts, prompts and checks | `lib/explain/` |
| PDF report | `lib/report/` |
| App screen | `components/app/` |
| Link from the landing to the app | `DEMO_URL` in `lib/site.ts` |
| Colours, type, shadows | `app/globals.css` (`@theme` block) |
| Pixel landscape of the hero and the closing | `components/pixel/field-scene.ts` |
| Clouds and marks in the sky | `components/pixel/sky-scene.ts` |
| Page sections | `components/landing/` |

Both languages must have the same structure and the same figures; `pnpm test` checks it.

## Deploying

It runs on Vercel with no configuration. On Vercel the analysis cache is shared between routes through Vercel's Runtime Cache; elsewhere it lives in a folder on the server. The first analysis of a new place takes about a minute because of the rainfall service. If you deploy somewhere else, set `NEXT_PUBLIC_SITE_URL` to the public address so the links between languages in the `<head>` point to the right domain.

## Where the figures come from

Every number on the page carries its origin (observed, modelled, declared or from a study) and its source:

- Incidence of amachamiento by previous crop: Chaves and Araya (2012), *Agronomía Costarricense* 36(2): 61-70. Brunca region, 2009. An observational study, without replicates.
- Relative soil loss (landing): our own test with RUSLE on a hillside plot in Cartago. It only serves to compare; it is not tonnes.
- Soil exposure in the app: each month weighs by its rainfall squared (modified Fournier index, Arnoldus 1980) and cover protects by exp(−b × % cover), with b between 0.025 and 0.05 (RUSLE2 documentation). The cover of each month is declared by the person.
- Pixel sizes: those of each product (Landsat 30 m, SRTM 30 m, SoilGrids 250 m, IMERG ~11 km, NASA POWER ~55 km).

What satellites do not tell, and the app does not claim: the crop that was grown, the presence of a nematode or a disease, or tonnes of soil lost. Those come from the farmer, the agronomist and the studies.

## Use of Super Intelligence (SI / AI)

This project was built with SI tools, and we say where:

- **Code.** The source code in this repository was written jointly by the team and an SI coding assistant (Claude Code, by Anthropic). It is acknowledged here and in the `description` field of `package.json`.
- **Copy.** The texts of the landing page and the app were drafted with SI assistance.
- **Inside the app.** A Claude model (Anthropic, `claude-haiku-5-5` by default) writes the plain-language reading, the recommendations and the answers to questions. Those texts are labelled as written by a model in the interface and in the PDF. The model receives only the results the server already computed, never the coordinates, and any text containing a figure that is not in the analysis is discarded.
- **Demo video.** The demo video was produced with SI tools and carries a visible "SI" watermark.
- **Data.** No data was generated by SI. Every figure comes from the sources listed above.

No NASA logo, flag or mission identifier is used anywhere in the project.

## License

[Apache License 2.0](LICENSE). The datasets keep their own licences and terms; see each provider.
