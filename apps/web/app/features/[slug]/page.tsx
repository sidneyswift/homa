import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { Button } from "../../../components/marketing/ds/Button";
import { Card } from "../../../components/marketing/ds/Card";
import { Doodle } from "../../../components/marketing/Doodle";
import { Footer } from "../../../components/marketing/Footer";
import { Nav } from "../../../components/marketing/Nav";
import { FEATURE_PAGES, getFeaturePage } from "../../../lib/feature-pages";

const BASE_URL = "https://thankshoma.com";

const FEATURE_CSS = `
.feature-page {
  overflow-x: clip;
  color: var(--text-body);
  background: var(--bg-page);
}
.feature-page h1,
.feature-page h2,
.feature-page h3 {
  font-family: var(--font-display);
  color: var(--text-strong);
  letter-spacing: -0.015em;
}
.feature-page h1 {
  max-width: 720px;
  margin: 14px 0 22px;
  font-size: clamp(2.35rem, 5vw, 4.6rem);
  font-weight: 700;
  line-height: 1.04;
  text-wrap: balance;
}
.feature-page h2 {
  margin: 0;
  font-size: clamp(1.85rem, 3vw, 2.75rem);
  line-height: 1.08;
  text-wrap: balance;
}
.feature-page h3 {
  margin: 0;
  font-size: 1.3rem;
  line-height: 1.18;
}
.feature-page p {
  text-wrap: pretty;
}
.feature-hero {
  padding: 112px 40px 92px;
  background:
    radial-gradient(65% 86% at 88% 0%, color-mix(in oklab, var(--gold-100) 68%, var(--bg-page)) 0%, transparent 74%),
    var(--bg-page);
}
.feature-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
  align-items: center;
  gap: 64px;
  max-width: 1120px;
  margin: 0 auto;
}
.feature-eyebrow {
  margin: 0;
  color: var(--brand);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.feature-lede {
  max-width: 650px;
  margin: 0;
  color: var(--text-body);
  font-size: clamp(1.15rem, 1rem + 0.45vw, 1.42rem);
  line-height: 1.52;
}
.feature-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 18px;
  margin-top: 32px;
}
.feature-secondary-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 10px 14px;
  color: var(--text-body);
  background: color-mix(in oklab, var(--surface-card) 78%, transparent);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  font-weight: 700;
  text-decoration: none;
}
.feature-secondary-link:hover {
  color: var(--text-strong);
  border-color: var(--brand);
  text-decoration: underline;
  text-underline-offset: 4px;
}
.feature-hero-note {
  max-width: 650px;
  margin: 18px 0 0;
  padding: 12px 14px;
  color: var(--text-body);
  background: color-mix(in oklab, var(--sage-100) 52%, var(--bg-page));
  border-left: 3px solid var(--sage-500);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font-size: 0.92rem;
  line-height: 1.45;
}
.feature-answer-card {
  position: relative;
  padding: 34px;
  background: color-mix(in oklab, var(--band-sky) 30%, var(--surface-card));
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
}
.feature-answer-card::before {
  content: "";
  position: absolute;
  inset: 12px;
  border: 1px solid color-mix(in oklab, var(--sky-500) 30%, transparent);
  border-radius: calc(var(--radius-xl) - 8px);
  pointer-events: none;
}
.feature-card-label {
  margin: 0 0 14px;
  color: var(--sage-700);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.feature-answer {
  margin: 16px 0 0;
  color: var(--text-body);
  font-size: 1.08rem;
  line-height: 1.6;
}
.feature-section {
  max-width: 1120px;
  margin: 0 auto;
  padding: 96px 40px;
}
.feature-section--butter {
  max-width: none;
  background: var(--lp-band-butter);
}
.feature-section--butter > div {
  max-width: 1120px;
  margin: 0 auto;
}
.feature-section-intro {
  max-width: 700px;
  margin: 14px 0 0;
  color: var(--text-muted);
  font-size: 1.1rem;
  line-height: 1.55;
}
.feature-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin-top: 46px;
}
.feature-step {
  min-height: 210px;
}
.feature-step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-bottom: 22px;
  border-radius: 50%;
  background: var(--gold-300);
  color: var(--gold-ink-strong);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
}
.feature-step p {
  margin: 12px 0 0;
  color: var(--text-muted);
  line-height: 1.55;
}
.feature-proof-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 0.8fr);
  gap: 64px;
  align-items: start;
}
.feature-proof-list {
  display: grid;
  gap: 12px;
  margin: 30px 0 0;
  padding: 0;
  list-style: none;
}
.feature-proof-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
}
.feature-proof-mark {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--sage-500);
}
.feature-related-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 40px;
}
.feature-related-card {
  display: flex;
  flex-direction: column;
  min-height: 160px;
  color: inherit;
  text-decoration: none;
}
.feature-related-card:hover {
  border-color: var(--brand);
}
.feature-related-card p {
  margin: 12px 0 0;
  color: var(--text-muted);
  line-height: 1.45;
}
.feature-related-card span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: auto;
  padding-top: 22px;
  color: var(--brand);
  font-size: 0.92rem;
  font-weight: 700;
}
.feature-final {
  padding: 96px 40px 112px;
  background: var(--band-sunshine);
  text-align: center;
}
.feature-final > div {
  max-width: 720px;
  margin: 0 auto;
}
.feature-final p {
  max-width: 570px;
  margin: 16px auto 30px;
  color: var(--gold-ink-strong);
  font-size: 1.14rem;
  line-height: 1.55;
}
@media (max-width: 880px) {
  .feature-hero,
  .feature-section,
  .feature-final {
    padding-right: 20px;
    padding-left: 20px;
  }
  .feature-hero-grid,
  .feature-proof-grid {
    grid-template-columns: 1fr;
    gap: 42px;
  }
  .feature-steps,
  .feature-related-grid {
    grid-template-columns: 1fr;
  }
  .feature-step {
    min-height: auto;
  }
  .feature-answer-card {
    padding: 28px;
  }
}
@media (max-width: 560px) {
  .feature-hero {
    padding-top: 82px;
    padding-bottom: 72px;
  }
  .feature-section {
    padding-top: 72px;
    padding-bottom: 72px;
  }
  .feature-answer-card {
    padding: 24px;
  }
  .feature-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .feature-actions > * {
    width: 100%;
  }
  .feature-secondary-link {
    justify-content: center;
  }
}
`;

export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURE_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getFeaturePage(slug);
  if (!page) return {};

  return {
    title: page.metadataTitle,
    description: page.metadataDescription,
    alternates: { canonical: page.path },
    openGraph: {
      type: "website",
      siteName: "Homa",
      title: `${page.metadataTitle} | Homa`,
      description: page.metadataDescription,
      url: page.path,
      images: [
        {
          url: `${BASE_URL}/opengraph-image`,
          alt: `${page.eyebrow} from Homa`,
        },
      ],
    },
  };
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getFeaturePage(slug);

  if (!page) {
    notFound();
  }

  const pageUrl = BASE_URL + page.path;
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": pageUrl + "#webpage",
    name: page.title,
    description: page.metadataDescription,
    url: pageUrl,
    isPartOf: { "@id": BASE_URL + "/#website" },
    publisher: { "@type": "Organization", "@id": BASE_URL + "/#organization", name: "Homa" },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Features", item: BASE_URL + "/#features" },
      { "@type": "ListItem", position: 3, name: page.eyebrow, item: pageUrl },
    ],
  };

  return (
    <div className="feature-page">
      <style>{FEATURE_CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <Nav />
      <main>
        <section className="feature-hero">
          <div className="feature-hero-grid">
            <div>
              <Doodle
                name="sparkle"
                size={28}
                color="var(--pop-blush)"
                rotate={-15}
                style={{ marginBottom: 14 }}
              />
              <p className="feature-eyebrow">{page.eyebrow}</p>
              <h1>{page.title}</h1>
              <p className="feature-lede">{page.intro}</p>
              {page.heroNote ? <p className="feature-hero-note">{page.heroNote}</p> : null}
              <div className="feature-actions">
                <Button href="/onboarding" size="lg" iconRight={<ArrowRight size={18} aria-hidden="true" />}>
                  Start your free trial
                </Button>
                <Link className="feature-secondary-link" href="#how-it-works">
                  See how it works
                </Link>
              </div>
            </div>

            <div className="feature-answer-card">
              <p className="feature-card-label">About this feature</p>
              <h2>{page.answerTitle}</h2>
              <p className="feature-answer">{page.answer}</p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="feature-section feature-section--butter">
          <div>
            <p className="feature-eyebrow">How Homa helps</p>
            <h2>{page.howHeading}</h2>
            <p className="feature-section-intro">{page.howIntro}</p>
            <div className="feature-steps">
              {page.steps.map((step, index) => (
                <Card key={step.title} style={{ minHeight: 210 }} padding="lg">
                  <span className="feature-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="feature-section">
          <div className="feature-proof-grid">
            <div>
              <p className="feature-eyebrow">What you can use in Homa</p>
              <h2>{page.proofTitle}</h2>
              <ul className="feature-proof-list">
                {page.proof.map((item) => (
                  <li key={item} className="feature-proof-item">
                    <span className="feature-proof-mark" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Card padding="lg" style={{ background: "var(--brand-soft)" }}>
              <p className="feature-card-label">{page.noteLabel}</p>
              <p style={{ margin: 0, color: "var(--text-strong)", fontFamily: "var(--font-serif)", fontSize: "1.5rem", lineHeight: 1.35 }}>
                {page.note}
              </p>
            </Card>
          </div>
        </section>

        <section className="feature-section feature-section--butter">
          <div>
            <p className="feature-eyebrow">Explore Homa</p>
            <h2>{page.relatedHeading}</h2>
            <div className="feature-related-grid">
              {page.related.map((relatedSlug) => {
                const related = getFeaturePage(relatedSlug);
                if (!related) return null;
                return (
                  <Link key={related.slug} href={related.path} className="feature-related-card">
                    <Card padding="lg" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                      <h3>{related.eyebrow}</h3>
                      <p>{related.metadataDescription}</p>
                      <span>
                        Read about {related.eyebrow.toLowerCase()} <ArrowRight size={16} aria-hidden="true" />
                      </span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="feature-final">
          <div>
            <Doodle name="sun" size={30} color="var(--gold-ink-strong)" />
            <h2>{page.finalHeading}</h2>
            <p>{page.finalBody}</p>
            <Button href="/onboarding" size="lg" iconRight={<ArrowRight size={18} aria-hidden="true" />}>
              Start your free trial
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
