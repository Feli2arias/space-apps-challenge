# Before the Seed

Proyecto para el NASA Space Apps Challenge 2026 (reto Field Shift: Adapting Farms with NASA Data).

- **Landing:** español en `/`, inglés en `/en`.
- **App:** `/app` y `/en/app`. Se elige un terreno en el mapa, se analiza con datos abiertos de observación de la Tierra y se comparan tres rotaciones.
- Next.js (App Router) + Tailwind CSS v4. Sin base de datos ni cuentas.

## Cómo correrlo

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Otros comandos:

```bash
pnpm build      # build de producción
pnpm test       # tests (Vitest)
pnpm lint       # ESLint
pnpm typecheck  # TypeScript
```

## Cómo funciona el análisis

1. La persona escribe coordenadas, busca una localidad o toca el mapa, y elige un cuadrado alrededor del punto o dibuja el contorno.
2. `POST /api/analysis` valida el área y consulta cinco fuentes por separado. Responde en *streaming* (una línea JSON por evento), así la pantalla de carga muestra lo que el servidor ya confirmó.
3. Cada resultado dice qué describe (la parcela, el píxel o la región), de qué producto y versión sale, cuándo se obtuvo y con qué límites. Si una fuente falla, las demás se muestran igual y esa se puede reintentar.
4. Los resultados se guardan en caché por área, período y producto. Cuando un dato viene guardado, el panel lo dice y muestra la fecha en que se obtuvo.

### Fuentes conectadas (ninguna pide clave)

| Qué | Producto | Servicio | Píxel | Describe |
|---|---|---|---|---|
| Lluvia diaria | GPM IMERG Late Run V07 | SERVIR ClimateSERV | ~11 km | La región |
| Verdor (NDVI) | Landsat 8/9 Collection 2 Level-2 | Microsoft Planetary Computer | 30 m | La parcela |
| Elevación y pendiente | SRTM GL1 | Open Topo Data | 30 m | La parcela |
| Suelo | SoilGrids 2.0 (ISRIC) | Servicio de mapas de ISRIC (WCS); la API REST de SoilGrids como respaldo | 250 m | La región |
| Temperatura | NASA POWER (MERRA-2) | API de POWER | ~55 km | La región |
| Buscador de lugares | OpenStreetMap | Nominatim | — | — |

Tiempos medidos el 14 de noviembre de 2026 en una parcela de Los Chiles: la lluvia tarda unos 60 s para 3 años y 75 s para 5 (el servicio procesa un año cada ~47 s); la vegetación, unos 25 s para 320 escenas; el resto, menos de 5 s. La segunda vez todo sale de la caché al instante.

### Otras rutas

- `GET /api/geocode?q=…&lang=es` — busca localidades.
- `GET /api/geocode/reverse?lat=…&lon=…&lang=es` — dice en palabras dónde cae un punto: localidad, región y país.
- `POST /api/rotations` — compara rotaciones declaradas: evidencia publicada sobre el cultivo anterior y exposición relativa del suelo a la lluvia. Son dos lecturas separadas; no se suman en un puntaje.
- `POST /api/reading` — lectura inicial del análisis con un modelo de DeepSeek: un resumen en lenguaje simple y puntos a favor, posibles problemas y cosas por revisar.
- `GET` y `POST /api/recommend` — recomendaciones con su porqué, a pedido. El `GET` dice si hay clave configurada.
- `POST /api/ask` — responde una pregunta sobre el análisis y sus recomendaciones.
- `POST /api/report` — los resultados de un análisis como archivo PDF (botón "Descargar PDF"). Se escribe con lo que el servidor ya calculó y guardó; incluye la lectura y las recomendaciones de la IA solo si ya se habían generado.

Las tres rutas de IA usan solo resultados ya calculados y guardados por el servidor, no envían las coordenadas al modelo y descartan cualquier texto que mencione una cifra que no está en el análisis o que se apoye en una fuente sin datos. Necesitan `DEEPSEEK_API_KEY`; sin la clave, esas secciones no aparecen.

### Variables de entorno

Ninguna es obligatoria. Están descritas en `.env.example`; para usarlas, copiar ese archivo a `.env.local`.

## Dónde se cambia cada cosa

| Qué | Dónde |
|---|---|
| Textos del landing | `lib/i18n/es.ts` y `lib/i18n/en.ts` |
| Textos de la app | `lib/i18n/app/` |
| Textos de cada fuente de datos | `lib/analysis/sources/*.messages.ts` |
| Cada fuente de datos | `lib/analysis/sources/` |
| Contrato de datos (tipos) | `lib/analysis/types.ts` |
| Modelo de rotaciones y cifras del estudio | `lib/rotation/` |
| Pantalla de la app | `components/app/` |
| Enlace del landing a la app | `DEMO_URL` en `lib/site.ts` |
| Colores, tipografía, sombras | `app/globals.css` (bloque `@theme`) |
| Paisaje pixelado del hero y del cierre | `components/pixel/field-scene.ts` |
| Nubes y marcas del cielo | `components/pixel/sky-scene.ts` |
| Secciones de la página | `components/landing/` |

Los dos idiomas tienen que tener la misma estructura y las mismas cifras; `pnpm test` lo comprueba.

## Publicar

En Vercel funciona sin configuración. La caché de resultados vive en una carpeta temporal del servidor, así que se pierde cuando la instancia se reinicia. El primer análisis de un lugar nuevo tarda cerca de un minuto por la lluvia. Si se publica en otro lado, definir `NEXT_PUBLIC_SITE_URL` con la dirección pública (por ejemplo `https://beforetheseed.example`) para que los enlaces entre idiomas del `<head>` apunten al dominio correcto.

## De dónde salen las cifras

Cada número de la página lleva su origen (observado, modelado, declarado o de un estudio) y su fuente:

- Incidencia de amachamiento según el cultivo anterior: Chaves y Araya (2012), *Agronomía Costarricense* 36(2). Región Brunca, 2009. Estudio observacional, sin réplicas.
- Pérdida de suelo relativa (landing): prueba propia con RUSLE en una parcela de ladera en Cartago. Solo sirve para comparar; no son toneladas.
- Exposición del suelo en la app: cada mes pesa según su lluvia al cuadrado (índice de Fournier modificado, Arnoldus 1980) y la cobertura protege según exp(−b × % de cobertura), con b entre 0,025 y 0,05 (documentación de RUSLE2). La cobertura de cada mes la declara la persona.
- Tamaños de píxel: los de cada producto (Landsat 30 m, SRTM 30 m, SoilGrids 250 m, IMERG ~11 km, NASA POWER ~55 km).
