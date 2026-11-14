# Before the Seed

Landing page del proyecto **Before the Seed** para el NASA Space Apps Challenge 2026 (reto Field Shift: Adapting Farms with NASA Data).

- Español en `/`, inglés en `/en`.
- Next.js (App Router) + Tailwind CSS v4. Página estática, sin base de datos.

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

## Dónde se cambia cada cosa

| Qué | Dónde |
|---|---|
| Textos en español | `lib/i18n/es.ts` |
| Textos en inglés | `lib/i18n/en.ts` |
| Enlace a la demo | `DEMO_URL` en `lib/site.ts` |
| Colores, tipografía, sombras | `app/globals.css` (bloque `@theme`) |
| Paisaje pixelado del hero y del cierre | `components/pixel/field-scene.ts` |
| Nubes y marcas del cielo | `components/pixel/sky-scene.ts` |
| Secciones de la página | `components/landing/` |

Los dos idiomas tienen que tener la misma estructura y las mismas cifras; `pnpm test` lo comprueba.

### Activar el botón de la demo

Mientras `DEMO_URL` sea `null`, la sección final muestra "Demo en construcción" en vez de un botón que no lleva a ningún lado. Cuando el prototipo esté publicado:

```ts
// lib/site.ts
export const DEMO_URL: string | null = "/app"; // o la URL completa
```

## Publicar

En Vercel funciona sin configuración. Si se publica en otro lado, definir `NEXT_PUBLIC_SITE_URL` con la dirección pública (por ejemplo `https://beforetheseed.example`) para que los enlaces entre idiomas del `<head>` apunten al dominio correcto.

## De dónde salen las cifras

Cada número de la página lleva su origen (observado, modelado, declarado o de un estudio) y su fuente:

- Incidencia de amachamiento según el cultivo anterior: Chaves y Araya (2012), *Agronomía Costarricense* 36(2). Región Brunca, 2009. Estudio observacional, sin réplicas.
- Pérdida de suelo relativa: prueba propia con RUSLE en una parcela de ladera en Cartago. Solo sirve para comparar; no son toneladas.
- Tamaños de píxel: los de cada producto (Sentinel-2 10 m, SRTM 30 m, SoilGrids 250 m, CHIRPS e IMERG 5 a 10 km, NASA POWER 55 km).
