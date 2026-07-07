import type { MetadataRoute } from "next";

/**
 * robots.txt: everyone is welcome. The AI crawlers are named explicitly,
 * not because `*` wouldn't already cover them, but so the welcome is
 * unmistakable to the bots and visible to AI-visibility audits that scan
 * for per-bot directives. /api/ is machine endpoints only, nothing there
 * is a page worth crawling. See also public/ai.txt and public/llms.txt.
 */

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "Amazonbot",
  "CCBot",
  "DuckAssistBot",
  "MistralAI-User",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_CRAWLERS, allow: "/" },
      { userAgent: "*", allow: "/", disallow: "/api/" },
    ],
    sitemap: "https://thankshoma.com/sitemap.xml",
    host: "https://thankshoma.com",
  };
}
