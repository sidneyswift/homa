export const FAMILY_ASSET_TRAINING_SAFETY_POLICY_VERSION =
  "family-library-privacy-v1";

export const FAMILY_ASSET_TRAINING_EXCLUSION_REASONS = [
  "secret_detected",
  "child_identifier_detected",
  "sensitive_record_detected",
  "unsupported_source",
  "source_too_large",
  "unreadable_source",
  "truncated_source",
  "source_not_ready",
  "source_deleted",
  "operator_excluded",
] as const;

export type FamilyAssetTrainingExclusionReason =
  (typeof FAMILY_ASSET_TRAINING_EXCLUSION_REASONS)[number];

export interface FamilyAssetTrainingChildIdentity {
  name: string;
  birthDate: string;
}

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/iu,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/iu,
  /\b(?:api[_ -]?key|access[_ -]?token|password|secret)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{8,}/iu,
] as const;

/**
 * This is a conservative security floor, not a classifier of what a document
 * means. A hit excludes the source. A miss never authorizes a product action
 * or turns the text into durable family context.
 */
const SENSITIVE_RECORD_PATTERNS = [
  /\bindividuali[sz]ed education (?:program|plan)\b/iu,
  /\bIEP\b/u,
  /\b504\s+plan\b/iu,
  /\b(?:medical|therapy|counseling|psychological|neuropsychological) (?:record|notes?|report|evaluation)\b/iu,
  /\b(?:diagnosis|patient name|medical record number|medications?|prescription)\s*:/iu,
  /\b(?:social security number|SSN)\s*:/iu,
] as const;

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}

function containsExactIdentifier(text: string, identifier: string): boolean {
  const needle = normalize(identifier.trim());
  if (needle.length < 2) return false;
  const haystack = normalize(text);
  let offset = haystack.indexOf(needle);
  while (offset >= 0) {
    const before = offset > 0 ? haystack[offset - 1] ?? "" : "";
    const after = haystack[offset + needle.length] ?? "";
    if (!LETTER_OR_NUMBER.test(before) && !LETTER_OR_NUMBER.test(after)) {
      return true;
    }
    offset = haystack.indexOf(needle, offset + needle.length);
  }
  return false;
}

function birthdayVariants(value: string): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return [];
  const [, year = "", month = "", day = ""] = match;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (
    !Number.isInteger(monthNumber) ||
    !Number.isInteger(dayNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31
  ) {
    return [];
  }
  const monthName = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(year), monthNumber - 1, 1)));
  return [
    `${year}-${month}-${day}`,
    `${month}/${day}/${year}`,
    `${monthNumber}/${dayNumber}/${year}`,
    `${month}-${day}-${year}`,
    `${monthNumber}-${dayNumber}-${year}`,
    `${monthName} ${dayNumber}, ${year}`,
  ];
}

function childNameVariants(value: string): string[] {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized) return [];
  const parts = normalized
    .split(/[^\p{L}\p{N}'’-]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  return [...new Set([normalized, ...parts])];
}

export function scanFamilyAssetTrainingContent(input: {
  text: string;
  metadata?: readonly string[];
  children: readonly FamilyAssetTrainingChildIdentity[];
}): FamilyAssetTrainingExclusionReason[] {
  const content = [input.text, ...(input.metadata ?? [])]
    .join("\n")
    .normalize("NFKC");
  const reasons = new Set<FamilyAssetTrainingExclusionReason>();

  if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
    reasons.add("secret_detected");
  }
  if (SENSITIVE_RECORD_PATTERNS.some((pattern) => pattern.test(content))) {
    reasons.add("sensitive_record_detected");
  }
  if (
    input.children.some(
      (child) =>
        childNameVariants(child.name).some((name) =>
          containsExactIdentifier(content, name),
        ) ||
        birthdayVariants(child.birthDate).some((birthday) =>
          containsExactIdentifier(content, birthday),
        ),
    )
  ) {
    reasons.add("child_identifier_detected");
  }

  return FAMILY_ASSET_TRAINING_EXCLUSION_REASONS.filter((reason) =>
    reasons.has(reason),
  );
}
