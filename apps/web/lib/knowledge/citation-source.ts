/**
 * A source label is durable provenance, not model-written decoration. A
 * publication-host fallback is intentionally narrow so it never invents an
 * author or institution for a citation.
 */
export interface ResearchCitation {
  url: string;
  accessedAt?: string;
  claim: string;
  sourceName?: string;
}

const PUBLICATION_HOSTS: Record<string, string> = {
  "eric.ed.gov": "ERIC",
  "pubmed.ncbi.nlm.nih.gov": "PubMed",
  "ncbi.nlm.nih.gov": "PubMed",
};
const SOURCE_PAGE_TIMEOUT_MS = 3_000;
const SOURCE_PAGE_MAX_BYTES = 128 * 1024;

function normalizedSourceName(sourceName: string | undefined): string | null {
  const normalized = sourceName?.replace(/\s+/gu, " ").trim();
  return normalized && normalized.length <= 120 ? normalized : null;
}

function publicationHostLabel(url: string): string | null {
  try {
    return PUBLICATION_HOSTS[new URL(url).hostname.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

/** Returns an explicit source name, or an allowlisted publication host label. */
export function citationSourceName(citation: ResearchCitation): string | null {
  const explicit = normalizedSourceName(citation.sourceName);
  if (explicit) return explicit;
  return publicationHostLabel(citation.url);
}

/** Resolves a unique, parent-safe list of the citation source names. */
export function citationSourceNames(citations: readonly ResearchCitation[]): string[] {
  return [
    ...new Set(
      citations
        .map(citationSourceName)
        .filter((sourceName): sourceName is string => sourceName !== null),
    ),
  ];
}

export interface CitationSourceVerificationDependencies {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function normalizedSourceTokens(value: string): string[] {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

async function readBoundedResponseText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";
  try {
    while (bytesRead < SOURCE_PAGE_MAX_BYTES) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const remaining = SOURCE_PAGE_MAX_BYTES - bytesRead;
      const bytes = chunk.value.subarray(0, remaining);
      bytesRead += bytes.byteLength;
      text += decoder.decode(bytes, { stream: true });
      if (bytes.byteLength < chunk.value.byteLength) break;
    }
    text += decoder.decode();
    return text;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/**
 * Verifies a model-supplied label against bounded page text. If the body
 * cannot be inspected, only the publication label fixed for an allowlisted
 * host survives.
 */
export async function verifiedCitationSourceName(
  citation: ResearchCitation,
  dependencies: CitationSourceVerificationDependencies = {},
): Promise<string | null> {
  const explicit = normalizedSourceName(citation.sourceName);
  const allowlistedLabel = publicationHostLabel(citation.url);
  if (!explicit) return allowlistedLabel;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? SOURCE_PAGE_TIMEOUT_MS,
  );
  try {
    const response = await (dependencies.fetch ?? globalThis.fetch)(
      citation.url,
      {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          accept: "text/html, text/plain;q=0.9",
        },
      },
    );
    if (!response.ok) {
      return allowlistedLabel === explicit ? allowlistedLabel : null;
    }
    const contentType = response.headers.get("content-type");
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      return allowlistedLabel === explicit ? allowlistedLabel : null;
    }
    const bodyTokens = new Set(
      normalizedSourceTokens(await readBoundedResponseText(response)),
    );
    const sourceTokens = normalizedSourceTokens(explicit);
    return sourceTokens.length > 0 &&
      sourceTokens.every((token) => bodyTokens.has(token))
      ? explicit
      : null;
  } catch {
    return allowlistedLabel === explicit ? allowlistedLabel : null;
  } finally {
    clearTimeout(timeout);
  }
}
