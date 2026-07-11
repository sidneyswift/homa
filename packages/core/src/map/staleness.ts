import { ageInMonths } from "./bands";
import { MAP_SUBJECTS } from "./bank";

/**
 * Report staleness, derived at read time and never stored (the anti-rot
 * law for derived artifacts: a stored "stale" flag would itself go stale;
 * a pure function of birth date + generation time + the bank cannot).
 * The report page computes this on every visit, so the permanent URL
 * knows the child has grown without any cron, email, or write.
 *
 * Voice note for renderers: staleness is an OFFER surface ("Maya has
 * grown into 4 new checkpoints, two minutes updates everything"), never
 * an alarm. No deficit framing exists here: growing older is the good
 * news the banner reports.
 */

export interface ReportStaleness {
  ageThenMonths: number;
  ageNowMonths: number;
  /** Whole months the child has aged since the report was generated. */
  monthsGrown: number;
  /** Bank items whose typical-by age arrived between then and now: the
   * checkpoints the child has newly grown into. */
  newBenchmarks: number;
  /** True when a re-check is worth offering (real growth, not noise). */
  stale: boolean;
}

export function reportStaleness(
  birthDate: string,
  generatedAt: string,
  now: Date = new Date(),
): ReportStaleness {
  const ageNowMonths = ageInMonths(birthDate, now);
  const ageThenMonths = ageInMonths(birthDate, new Date(generatedAt));
  const monthsGrown = Math.max(0, ageNowMonths - ageThenMonths);

  let newBenchmarks = 0;
  if (monthsGrown > 0) {
    for (const domain of MAP_SUBJECTS) {
      for (const item of domain.items) {
        if (item.typicalMonths > ageThenMonths && item.typicalMonths <= ageNowMonths) {
          newBenchmarks += 1;
        }
      }
    }
  }

  // One month of drift is noise; two is a real gap, and even one month
  // matters when named checkpoints arrived with it.
  const stale = monthsGrown >= 2 || (monthsGrown >= 1 && newBenchmarks > 0);

  return { ageThenMonths, ageNowMonths, monthsGrown, newBenchmarks, stale };
}
