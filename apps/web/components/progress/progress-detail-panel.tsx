"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { SidePanel } from "../chassis/side-panel";
import type { ProgressTileModel } from "../../lib/child-progress/map-model";
import type {
  OpenProgressConflictView,
  ProgressSubjectView,
} from "../../lib/child-progress/types";
import { progressSubjectSummary } from "../../lib/child-progress/view-copy";
import { ProgressChatDoor } from "./progress-chat-door";
import { ProgressDomain } from "./progress-domain";
import type { ProgressConflictActions } from "./progress-topic-row";
import { requestConflictResolution } from "./resolve-conflict-request";

/**
 * One subject's domains and topics in a modal panel: a right-side sheet
 * on desktop, a bottom sheet on phones (the founder-chosen refined
 * direction, plans/2026-07-12-progress-tab-refined.html). Geometry,
 * scrim, focus trap, and Escape/scrim dismissal all live in the shared
 * SidePanel chassis (components/chassis/side-panel.tsx, extracted from
 * this component as the fit donor, plans/2026-07-21-chat-first-onboarding.md
 * §2.7); this component owns only its own header, body, and footer.
 *
 * When the subject can take one (tile.deeperCheck), the footer carries
 * the double-check door (founder ask 2026-07-14: a scary number's first
 * question is "is that right?"): the deep dive flow at /onboarding?dd,
 * which re-asks harder or easier questions, rescores, and rewrites the
 * report around what changed. On read-only mirrors the card still
 * renders, faithful to her screen, with the button inert: tappable
 * only in the family's own session (founder ask 2026-07-14 afternoon,
 * "I still see this in my admin": a mirror that hides her doors reads
 * as the feature not existing).
 */
export function ProgressDetailPanel({
  childId,
  subject,
  tile,
  conflicts,
  timeZone,
  allowDeeperCheck,
  onClose,
}: {
  childId: string;
  subject: ProgressSubjectView;
  tile: ProgressTileModel | null;
  conflicts: readonly OpenProgressConflictView[];
  timeZone: string;
  /** False on read-only mirrors (the founder console): the card still
   * shows, but the button goes inert, because the deep dive walks the
   * FAMILY's flow and only her own session may start it. */
  allowDeeperCheck: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = `progress-panel-${subject.subjectId}`;
  const summary = progressSubjectSummary(subject, timeZone);
  const [pendingEvidenceId, setPendingEvidenceId] = useState<
    string | null
  >(null);
  const [errorConflictId, setErrorConflictId] = useState<
    string | null
  >(null);

  // Inline confirm: tapping a saved answer resolves the conflict through
  // /api/progress/conflict, then the refreshed server view carries the
  // settled reading back into this open panel.
  const conflictActions: ProgressConflictActions = {
    pendingEvidenceId,
    errorConflictId,
    onPick({ conflictId, evidenceId, answer }) {
      setPendingEvidenceId(evidenceId);
      setErrorConflictId(null);
      void requestConflictResolution(
        {
          conflictId,
          answer,
          idempotencyKey: crypto.randomUUID(),
        },
        { fetchJson: (url, init) => fetch(url, init) },
      ).then((outcome) => {
        setPendingEvidenceId(null);
        if (outcome === "failed") {
          setErrorConflictId(conflictId);
          return;
        }
        router.refresh();
      });
    },
  };

  return (
    <SidePanel labelledBy={headingId} onClose={onClose} initialFocusRef={closeRef}>
        <div className="flex items-start gap-3 border-b border-border-subtle px-5 pb-3.5 pt-3 lg:pt-5">
          <div className="min-w-0 flex-1">
            <h2
              id={headingId}
              className="font-display text-xl font-semibold tracking-[-0.015em] text-strong"
            >
              {subject.displayName}
            </h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {tile?.badge ? (
                <span
                  className="rounded-pill px-2.5 py-1 text-[0.75rem] font-bold"
                  style={{
                    background: tile.badge.background,
                    color: tile.badge.color,
                  }}
                >
                  {tile.badge.label}
                </span>
              ) : null}
            </div>
            {summary ? (
              <p className="mt-1.5 text-sm leading-relaxed text-body">
                {summary}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 shrink-0 items-center rounded-pill border border-border-subtle bg-card px-4 py-1.5 text-sm font-semibold text-strong transition-colors duration-(--dur-fast) ease-out hover:border-brand"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-4">
          {subject.domains.map((domain) => (
            <ProgressDomain
              key={domain.domainId}
              domain={domain}
              conflicts={conflicts}
              timeZone={timeZone}
              conflictActions={conflictActions}
            />
          ))}
        </div>

        <div className="border-t border-border-subtle px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {tile?.deeperCheck ? (
            <div className="mb-3 rounded-md border border-sage/30 bg-[var(--accent-sage-soft)] p-3.5">
              <p className="text-sm text-body">
                This number comes from the answers above. Eight questions at most sharpen it
                and update the progress report, in about two minutes.
              </p>
              {allowDeeperCheck ? (
                <Link
                  href={`/onboarding?dd=${childId}.${subject.subjectId}`}
                  className="mt-2.5 inline-flex min-h-10 items-center rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover"
                >
                  Answer a few deeper questions
                </Link>
              ) : (
                <span className="mt-2.5 inline-flex items-center gap-2.5">
                  <span
                    aria-disabled="true"
                    className="inline-flex min-h-10 cursor-default items-center rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-on-brand opacity-60"
                  >
                    Answer a few deeper questions
                  </span>
                  <span className="text-xs text-subtle">hers to tap</span>
                </span>
              )}
            </div>
          ) : null}
          <ProgressChatDoor childId={childId} variant="link">
            Tell Homa something looks wrong
          </ProgressChatDoor>
        </div>
    </SidePanel>
  );
}
