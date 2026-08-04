export type Subprocessor = Readonly<{
  name: string;
  purpose: string;
}>;

/**
 * Public inventory of services that can process family data in production.
 * Keep this list in sync with provider, delivery, search, billing, and hosting
 * changes. The privacy page renders this data directly and the legal copy test
 * locks the expected names so an indirect provider cannot disappear into prose.
 */
export const SUBPROCESSORS = [
  {
    name: "Supabase",
    purpose: "provides authentication and database hosting",
  },
  {
    name: "Vercel",
    purpose: "provides web hosting, server functions, file storage, analytics, and the AI gateway",
  },
  {
    name: "Resend",
    purpose: "sends and receives email for Homa",
  },
  {
    name: "Stripe",
    purpose: "processes web membership purchases",
  },
  {
    name: "Apple",
    purpose: "processes App Store membership purchases",
  },
  {
    name: "Telnyx",
    purpose: "provides text messaging, phone calls, and some speech transcription",
  },
  {
    name: "Google",
    purpose: "provides optional sign-in and some AI processing, including through Google Vertex AI",
  },
  {
    name: "Anthropic",
    purpose: "processes content for chat, reports, and planning",
  },
  {
    name: "OpenAI",
    purpose: "processes content for voice, transcription, image creation, and artifact review",
  },
  {
    name: "Prodia",
    purpose: "provides fallback illustration generation",
  },
  {
    name: "Amazon Web Services",
    purpose: "may host AI model processing selected through the AI gateway",
  },
  {
    name: "Microsoft Azure",
    purpose: "may host OpenAI model processing selected through the AI gateway",
  },
  {
    name: "Twelve Labs",
    purpose: "analyzes videos only when you ask Homa to work with a video",
  },
  {
    name: "Firecrawl",
    purpose: "retrieves public webpages when a Homa feature needs web sources",
  },
  {
    name: "SerpAPI",
    purpose: "retrieves public image-search results when a Homa feature needs images from the web",
  },
  {
    name: "Parallel",
    purpose: "provides web search when a Homa feature needs current public sources",
  },
  {
    name: "Handwrytten",
    purpose: "receives mailing details only when Homa sends a physical card",
  },
] as const satisfies readonly Subprocessor[];

export const SUBPROCESSOR_NAMES = SUBPROCESSORS.map(({ name }) => name);
