import {
  FIRSTS_BEGINNING_LABEL,
  FIRSTS_CONTESTED_LINE,
  firstsBeginningBody,
  firstsMatchedAbility,
  firstsMeta,
  firstsNoQuote,
  firstsQuoteLabel,
  firstsSubjectMarker,
  firstsSubjectMarkerBody,
  provenanceChannelLine,
} from "./firsts-copy";
import { deriveChildFirsts } from "./firsts";
import { formatProgressDate } from "./view-copy";
import type { ChildProgressProjectionInput } from "./repository";

/**
 * The adapter from the existing ledger read to the serializable client
 * payload.
 *
 * Why this cannot come from the Progress page's view: getChildProgressView
 * prefers the cached projection (progress-service.ts), which holds one
 * effective row per item and no quote (ProgressTopicView, types.ts), so
 * neither min(observed_at) nor a parent's own words can be recovered from
 * it. The cost instead is one existing repository method, one extra
 * repeatable-read transaction, on the firsts route and on the Progress
 * route's door check. The roster is threaded in so the quote gate has
 * something to check against.
 */

export interface FirstsProvenanceView {
  evidenceId: string;
  itemId: string;
  /** The catalog line. Rendered as the row's lead ONLY when there is no
   *  quote, and only bank statements ever reach that branch. */
  statement: string;
  subjectDisplayName: string;
  /** Already formatted in the family's own time zone. */
  dateLabel: string;
  /** Adult, source and date on one line, or source and date alone. */
  metaLine: string;
  /** The adult's own words, gate-passed. Null when none survives. */
  quote: string | null;
  quoteLabel: string | null;
  /** The honest replacement when the row genuinely stores no words.
   *  Null when a quote existed and the gate held it back, because
   *  "there are no words saved with it" would be false. */
  noQuoteLine: string | null;
  /** "Homa matched this to: <statement>", shown inside the disclosure
   *  whenever the row leads with a quote. */
  matchedAbilityLine: string | null;
  channelLine: string | null;
}

export interface FirstsRowView {
  provenance: FirstsProvenanceView;
  /** The row's lead line. The parent's words when there are any,
   *  otherwise an authored bank sentence. Never a taxonomy topic name,
   *  which provenance.ts refuses to let through unquoted. */
  lead:
    | { kind: "quote"; text: string }
    | { kind: "statement"; text: string };
  contestedLine: string | null;
  subjectMarker: { heading: string; body: string } | null;
  /** Present on the top row only: where this child's record starts.
   *  Speaks about the telling, never about the child, because
   *  observed_at is a report timestamp. */
  beginning: { heading: string; body: string } | null;
}

export interface ChildFirstsPage {
  childId: string;
  childName: string;
  rows: FirstsRowView[];
}

export function firstsPageFromLedger(input: {
  ledger: ChildProgressProjectionInput;
  /** Display names of every OTHER child in this family, from the
   *  caller's RLS-loaded roster. Never model-supplied, never from the
   *  URL. */
  otherChildNames: readonly string[];
}): ChildFirstsPage {
  const { ledger, otherChildNames } = input;
  const firsts = deriveChildFirsts({
    evidence: ledger.evidence,
    conflicts: ledger.conflicts,
    gate: { otherChildNames },
  });

  const rows: FirstsRowView[] = firsts.map((first) => {
    const p = first.provenance;
    const dateLabel = formatProgressDate(p.observedAt, ledger.timeZone);
    const hasQuote = p.quote !== null;
    return {
      provenance: {
        evidenceId: p.evidenceId,
        itemId: p.itemId,
        statement: p.statement,
        subjectDisplayName: p.subjectDisplayName,
        dateLabel,
        metaLine: firstsMeta(p.adultDisplayName, p.source, dateLabel),
        quote: p.quote,
        quoteLabel: hasQuote ? firstsQuoteLabel(p.adultDisplayName) : null,
        // Honest no-quote line only when a quote genuinely never
        // existed. When the gate held one back, both stay null and the
        // renderer says nothing rather than "no words were saved".
        noQuoteLine:
          p.quote === null && !p.quoteSuppressed
            ? firstsNoQuote(p.source)
            : null,
        matchedAbilityLine: hasQuote ? firstsMatchedAbility(p.statement) : null,
        channelLine: provenanceChannelLine(p.channel),
      },
      lead: hasQuote
        ? { kind: "quote", text: p.quote as string }
        : { kind: "statement", text: p.statement },
      contestedLine: first.contested ? FIRSTS_CONTESTED_LINE : null,
      subjectMarker:
        first.subjectMarker === null
          ? null
          : {
              heading: firstsSubjectMarker(first.subjectMarker.displayName),
              body: firstsSubjectMarkerBody(p.source),
            },
      beginning: first.isBeginning
        ? {
            heading: FIRSTS_BEGINNING_LABEL,
            body: firstsBeginningBody(ledger.child.name),
          }
        : null,
    };
  });

  return {
    childId: ledger.child.id,
    childName: ledger.child.name,
    rows,
  };
}
