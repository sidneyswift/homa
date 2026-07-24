import type { ReactElement } from "react";

import type { FirstsProvenanceView } from "../../lib/child-progress/firsts-from-ledger";

/**
 * The provenance viewer's body: date, channel, adult, the matched
 * ability, and the parent's own words. Presentational and shared so the
 * abilities-map tranche can wrap the same body in its sheet.
 *
 * The discriminated union has one case today. It stays a union so the
 * map tranche can add `{ kind: "implied", ... }` without changing this
 * file's call sites.
 */

export type ProvenanceBodyData = {
  kind: "reported";
  provenance: FirstsProvenanceView;
};

export function ProvenanceBody({
  data,
}: {
  data: ProvenanceBodyData;
}): ReactElement {
  const p = data.provenance;
  return (
    <div className="space-y-1.5 text-sm text-body">
      <p className="font-medium text-strong">{p.dateLabel}</p>
      {p.channelLine ? <p className="text-muted">{p.channelLine}</p> : null}
      <p className="text-muted">{p.metaLine}</p>
      {/* The catalog line, demoted here below the sentence that is the
          actual receipt. */}
      {p.matchedAbilityLine ? (
        <p className="text-muted">{p.matchedAbilityLine}</p>
      ) : null}
      {/* Exactly one of: the parent's own words, the honest no-words
          line, or nothing at all. The third branch is the suppressed
          case: a stored quote existed and the render gate held it back,
          and there is no honest short sentence for that. "There are no
          words saved with it" would be false, and explaining the filter
          would either accuse a mother of her own phrasing or advertise a
          filter she cannot act on. Silence is the only option that says
          nothing untrue. */}
      {p.quote !== null ? (
        <figure className="mt-2">
          {p.quoteLabel ? (
            <figcaption className="text-xs uppercase tracking-wide text-subtle">
              {p.quoteLabel}
            </figcaption>
          ) : null}
          {/* Whole, never truncated: these are her own words, and
              shortening them changes what she said. The column caps at
              500 characters, so there is a bound already. */}
          <blockquote className="mt-1 border-l-2 border-sage/40 pl-3 text-body">
            {p.quote}
          </blockquote>
        </figure>
      ) : p.noQuoteLine !== null ? (
        <p className="mt-1 text-muted">{p.noQuoteLine}</p>
      ) : null}
    </div>
  );
}
