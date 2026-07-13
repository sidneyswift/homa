/**
 * Single-page web reading for the agent's web_fetch tool, through
 * Firecrawl's v2 scrape API (FIRECRAWL_API_KEY, server-only). Turns a
 * model-chosen URL into boilerplate-free markdown: curriculum
 * scope-and-sequence pages, Teachers Pay Teachers listings, workbook
 * product pages, state standards.
 *
 * Posture (founder ruling 2026-07-13, superseding the 2026-07-09
 * web_fetch-off ruling; register row in journeys/10-reconciliation.md
 * §5): the model MAY choose URLs again. The founder explicitly accepted
 * the prompt-injection and exfiltration risk for now in exchange for
 * agentic depth; M2-14's scanning layer remains future hardening. What
 * this module still enforces is hygiene, not a security gate: https
 * only, Firecrawl's cloud does the fetching (our servers never touch
 * the target host), markdown only (no script-capable content), and a
 * hard size cap so one giant page cannot flood a turn.
 *
 * Vendor failures become model-readable notes and never throw, the
 * serp-images pattern.
 */

const SCRAPE_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";
/** Vendor-side rendering budget; JS-heavy storefronts like TPT need time. */
const VENDOR_TIMEOUT_MS = 30_000;
/** Our own abort, a little beyond the vendor budget. */
const ABORT_TIMEOUT_MS = 40_000;

export const MAX_PAGE_CHARS = 24_000;

export function firecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

export interface FetchedPage {
  title: string;
  /** Final URL after redirects, for honest attribution. */
  url: string;
  markdown: string;
  truncated: boolean;
}

export type FetchPageOutcome =
  | { ok: true; page: FetchedPage }
  | { ok: false; note: string };

interface ScrapeMetadata {
  title?: unknown;
  url?: unknown;
  sourceURL?: unknown;
  statusCode?: unknown;
}

interface ScrapeResponse {
  success?: unknown;
  error?: unknown;
  data?: {
    markdown?: unknown;
    metadata?: ScrapeMetadata;
  };
}

export function isFetchableUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Cuts at a line boundary near the cap so truncated markdown stays readable. */
function capMarkdown(markdown: string): { text: string; truncated: boolean } {
  if (markdown.length <= MAX_PAGE_CHARS) {
    return { text: markdown, truncated: false };
  }
  const slice = markdown.slice(0, MAX_PAGE_CHARS);
  const lastBreak = slice.lastIndexOf("\n");
  return {
    text: lastBreak > MAX_PAGE_CHARS / 2 ? slice.slice(0, lastBreak) : slice,
    truncated: true,
  };
}

/**
 * normalizeScrapeResponse(json, requestedUrl): FetchPageOutcome
 * Pure result shaping, exported for tests: rejects vendor failures and
 * error-status pages, bounds the markdown, and prefers the redirect-
 * resolved final URL for attribution.
 */
export function normalizeScrapeResponse(
  json: ScrapeResponse,
  requestedUrl: string,
): FetchPageOutcome {
  const markdown = typeof json.data?.markdown === "string" ? json.data.markdown : null;
  if (json.success !== true || markdown === null) {
    return {
      ok: false,
      note: "That page could not be read this time. Try a different page, or answer from search results and your own knowledge.",
    };
  }
  const metadata = json.data?.metadata ?? {};
  const statusCode = typeof metadata.statusCode === "number" ? metadata.statusCode : 200;
  if (statusCode >= 400) {
    return {
      ok: false,
      note: `That page answered with an error (HTTP ${statusCode}); the link may be dead. Try another page.`,
    };
  }
  if (markdown.trim().length === 0) {
    return {
      ok: false,
      note: "That page came back empty; it may be behind a login. Try another page.",
    };
  }
  const finalUrl =
    typeof metadata.url === "string" && isFetchableUrl(metadata.url)
      ? metadata.url
      : typeof metadata.sourceURL === "string" && isFetchableUrl(metadata.sourceURL)
        ? metadata.sourceURL
        : requestedUrl;
  const { text, truncated } = capMarkdown(markdown);
  return {
    ok: true,
    page: {
      title: typeof metadata.title === "string" ? metadata.title.slice(0, 200) : "",
      url: finalUrl,
      markdown: text,
      truncated,
    },
  };
}

/**
 * fetchPageAsMarkdown(url): the page as capped markdown, or a
 * model-readable failure note. Never throws: quota, blocks, and vendor
 * hiccups read as "here is what to do instead", not a broken turn.
 */
export async function fetchPageAsMarkdown(url: string): Promise<FetchPageOutcome> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      note: "Web page reading is not configured on this deployment. Answer from web_search results and your own knowledge instead.",
    };
  }
  if (!isFetchableUrl(url)) {
    return {
      ok: false,
      note: "Only public https pages can be read. Check the URL and try again.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ABORT_TIMEOUT_MS);
  try {
    const response = await fetch(SCRAPE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: VENDOR_TIMEOUT_MS,
      }),
      signal: controller.signal,
    });
    if (response.status === 402) {
      return {
        ok: false,
        note: "The page-reading budget is used up for now. Answer from web_search results and your own knowledge instead.",
      };
    }
    if (response.status === 429) {
      return {
        ok: false,
        note: "Page reading is briefly rate-limited. Continue with what you have and try again in a minute if it still matters.",
      };
    }
    const json = (await response.json()) as ScrapeResponse;
    if (!response.ok || json.success !== true) {
      const message = typeof json.error === "string" ? json.error : `HTTP ${response.status}`;
      console.error("fetchPageAsMarkdown vendor error:", message);
      return {
        ok: false,
        note: "That page could not be read this time (the site may block readers). Try a different page or answer without it.",
      };
    }
    return normalizeScrapeResponse(json, url);
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error(
        "fetchPageAsMarkdown failed:",
        error instanceof Error ? error.message : "unknown",
      );
      return {
        ok: false,
        note: "That page could not be read this time. Try a different page or answer without it.",
      };
    }
    return {
      ok: false,
      note: "That page took too long to load. Try a different page or answer without it.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
