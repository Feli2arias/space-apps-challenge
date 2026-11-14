import type { Dictionary } from "@/lib/i18n/types";
import { SECTION_ID } from "@/lib/site";
import { Analyses } from "./analyses";
import { DataSources } from "./data-sources";
import { DemoCta } from "./demo-cta";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { Problem } from "./problem";
import { Rotations } from "./rotations";
import { SiteFooter } from "./site-footer";
import { StatBand } from "./stat-band";

interface LandingProps {
  readonly dict: Dictionary;
}

/** The whole landing page for one language. Sections read their copy from `dict`. */
export function Landing({ dict }: LandingProps) {
  return (
    <>
      <main id={SECTION_ID.content}>
        <Hero dict={dict} />
        <StatBand dict={dict} />
        <Problem dict={dict} />
        <HowItWorks dict={dict} />
        <Analyses dict={dict} />
        <Rotations dict={dict} />
        <DataSources dict={dict} />
        <DemoCta dict={dict} />
      </main>
      <SiteFooter dict={dict} />
    </>
  );
}
