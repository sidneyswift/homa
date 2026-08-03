import type { Metadata } from "next";
import { Logo } from "../../../components/brand/Logo";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { QuietStatus } from "../../../components/design/QuietStatus";
import { QuietThread } from "../../../components/design/QuietThread";

export const metadata: Metadata = {
  title: "Quiet authority fixture | Homa",
  robots: { index: false, follow: false },
};

export default function QuietAuthorityFixture() {
  return (
    <main className="quiet-fixture" data-brand-fixture="quiet-authority-v1">
      <header className="quiet-fixture__header">
        <Logo tone="light" size={32} />
        <span className="quiet-fixture__eyebrow">Brand system fixture</span>
      </header>

      <section className="quiet-fixture__hero" aria-labelledby="quiet-fixture-title">
        <p className="quiet-fixture__eyebrow">Real work, warmly guided</p>
        <h1 id="quiet-fixture-title">A calmer way to keep learning moving.</h1>
        <p className="quiet-fixture__lede">
          Homa keeps the family&apos;s thread, shows the work that happened, and offers one useful next move.
        </p>
        <div className="quiet-fixture__actions">
          <QuietAction href="/signin" size="large">
            Start with Homa
          </QuietAction>
          <QuietAction href="#evidence" kind="secondary" size="large">
            See the evidence
          </QuietAction>
        </div>
      </section>

      <section id="evidence" className="quiet-fixture__grid" aria-label="Quiet authority examples">
        <QuietFrame as="article" tone="paper" className="quiet-fixture__artifact">
          <div className="quiet-fixture__artifact-label">The real work</div>
          <h2>Counting by twos with Maya</h2>
          <p>Three practice pages, one proud correction, and a note to try the pattern with kitchen tools.</p>
          <QuietStatus tone="constructive">
            Ready to build on
          </QuietStatus>
        </QuietFrame>

        <div className="quiet-fixture__guide" aria-label="Homa keeps the thread">
          <div className="quiet-fixture__guide-mark" aria-hidden="true">
            <Logo tone="light" size={24} />
          </div>
          <p className="quiet-fixture__eyebrow">The warm guide</p>
          <h2>Homa notices the useful bit.</h2>
          <QuietThread label="Connects the learning object to the next move" />
        </div>

        <QuietFrame as="article" tone="contained" className="quiet-fixture__next">
          <div className="quiet-fixture__artifact-label">One useful next move</div>
          <h2>Try the pattern while setting the table.</h2>
          <p>Small enough for today, specific enough to matter.</p>
          <QuietAction href="/app" kind="secondary" size="large" className="quiet-fixture__next-action">
            Open the plan
          </QuietAction>
        </QuietFrame>
      </section>
    </main>
  );
}
