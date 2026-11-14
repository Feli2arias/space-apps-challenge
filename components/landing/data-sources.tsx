// Contract: DataSources
// Props: dict (Dictionary, required)
// Variants: none
// States: static. Its bottom edge dissolves into the next section with a dithered strip (PixelFade)
// Accessibility: section labelled by its h2; sources are a list in which each row names what
//                is measured, who measures it, at what pixel size and its limit; the
//                "sees / does not see" panels are headed lists and their check and cross icons
//                are decorative; all text pairs meet 4.5:1
// Responsive: source rows stack on phones, split in two columns from md (768px) and three
//             from lg (1024px); the two panels and the origin legend go from one column to
//             two and four

import { Container } from "@/components/ui/container";
import { OriginTag } from "@/components/ui/origin-tag";
import { PixelIcon } from "@/components/ui/pixel-icon";
import { PixelFade } from "@/components/pixel/pixel-fade";
import { SectionHeader } from "@/components/ui/section-header";
import type { Dictionary, Origin } from "@/lib/i18n/types";
import { SECTION_ID } from "@/lib/site";

interface DataSourcesProps {
  readonly dict: Dictionary;
}

const TITLE_ID = "data-title";
const ORIGIN_ORDER: readonly Origin[] = ["observed", "modeled", "declared", "study"];

export function DataSources({ dict }: DataSourcesProps) {
  const { data, origins } = dict;

  return (
    <section
      id={SECTION_ID.data}
      aria-labelledby={TITLE_ID}
      className="relative border-t border-line bg-white py-section"
    >
      <Container>
        <SectionHeader
          index="05"
          eyebrow={data.eyebrow}
          title={data.title}
          titleId={TITLE_ID}
          intro={data.intro}
        />

        <ul className="border-t border-ink">
          {data.rows.map((row) => (
            <li
              key={row.what}
              className="grid gap-x-10 gap-y-2 border-b border-line py-6 md:grid-cols-[9rem_1fr] lg:grid-cols-[11rem_1fr_1fr] lg:items-baseline"
            >
              <p className="font-display text-numeral">
                <span className="sr-only">{data.resolutionLabel}: </span>
                {row.resolution}
              </p>
              <div>
                <p className="text-h3 font-semibold">{row.what}</p>
                <p className="mt-1.5 font-mono text-label tracking-label text-cinnabar-deep uppercase">
                  {row.source} · {row.scope}
                </p>
              </div>
              <p className="text-body text-muted md:col-start-2 lg:col-start-3">
                {row.limit}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-section grid gap-8 md:grid-cols-2">
          <div className="border border-ink p-6 sm:p-8">
            <h3 className="font-display text-title font-normal uppercase">
              {data.sees.title}
            </h3>
            <ul className="mt-6 flex flex-col gap-3.5">
              {data.sees.items.map((item) => (
                <li key={item} className="flex items-center gap-3.5 text-body">
                  <PixelIcon name="check" className="size-3.5 text-cinnabar-deep" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-ink p-6 text-white sm:p-8">
            <h3 className="font-display text-title font-normal uppercase">
              {data.blind.title}
            </h3>
            <ul className="mt-6 flex flex-col gap-3.5">
              {data.blind.items.map((item) => (
                <li key={item} className="flex items-center gap-3.5 text-body">
                  <PixelIcon name="cross" className="size-3.5 text-cinnabar" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-dashed border-line-on-ink pt-4 text-small text-on-ink-muted">
              {data.blind.note}
            </p>
          </div>
        </div>

        <div className="mt-14">
          <h3 className="font-mono text-label tracking-label text-cinnabar-deep uppercase">
            {data.originsTitle}
          </h3>
          <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(13.75rem,1fr))] border-t border-l border-line">
            {ORIGIN_ORDER.map((origin) => (
              <div key={origin} className="border-r border-b border-line p-5">
                <dt>
                  <OriginTag origin={origin} label={origins[origin].label} />
                </dt>
                <dd className="mt-2.5 text-small text-muted">
                  {origins[origin].description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
      <PixelFade tone="white" className="z-10" />
    </section>
  );
}
