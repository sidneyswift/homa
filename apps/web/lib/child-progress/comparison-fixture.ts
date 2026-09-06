import { buildChildProgressView } from "./projection";
import type { ProgressEvidence, ProgressEvidenceAnswer, ProgressEvidenceDerivation } from "./types";
export const COMPARISON_FAMILY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const COMPARISON_CHILD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export function comparisonFixture(
  entries: { itemId: string; answer?: ProgressEvidenceAnswer; observedAt?: string; derivation?: ProgressEvidenceDerivation }[] = [{ itemId: "gross_motor.catches-ball" }],
  options: { ageMonths?: number; birthDate?: string; now?: string; timeZone?: string } = {},
) {
  const now = options.now ?? "2026-09-06T18:00:00.000Z";
  const total = 2026 * 12 + 8 - (options.ageMonths ?? 48);
  const birthDate = options.birthDate ?? `${Math.floor(total / 12)}-${String(total % 12 + 1).padStart(2, "0")}-01`;
  const evidence: ProgressEvidence[] = entries.map((entry, index) => ({
    id: `evidence-${index}`, familyId: COMPARISON_FAMILY, childId: COMPARISON_CHILD,
    itemId: entry.itemId, answer: entry.answer ?? "easily", derivation: entry.derivation ?? "direct", source: "check_in",
    memberUserId: null, adultDisplayName: null, quote: null, channel: "web", messageId: null, checkInId: null,
    supersedesId: null, supersededAt: null, observedAt: entry.observedAt ?? now, createdAt: entry.observedAt ?? now,
  }));
  return buildChildProgressView({ child: { id: COMPARISON_CHILD, name: "Maya", birthDate }, familyId: COMPARISON_FAMILY, timeZone: options.timeZone ?? "America/New_York", now: new Date(now), evidence, conflicts: [], selectionAnswers: [] });
}
