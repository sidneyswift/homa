import type { Metadata } from "next";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietChoice } from "../../../components/design/QuietChoice";
import { QuietFeedback } from "../../../components/design/QuietFeedback";
import { QuietField } from "../../../components/design/QuietField";
import { QuietFooter } from "../../../components/design/QuietFooter";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { QuietIdentity } from "../../../components/design/QuietIdentity";
import { QuietMedia } from "../../../components/design/QuietMedia";
import { QuietNav } from "../../../components/design/QuietNav";
import { QuietStatus } from "../../../components/design/QuietStatus";
import { QuietThread } from "../../../components/design/QuietThread";
import { Icon } from "../../../components/design/Icon";

export const metadata: Metadata = {
  title: "Quiet authority fixture | Homa",
  robots: { index: false, follow: false },
};

export default function QuietAuthorityFixture() {
  return (
    <main className="quiet-fixture" data-brand-fixture="quiet-authority-v1">
      <div
        data-gauntlet-primitive="web-quiet-nav"
        data-gauntlet-states="rest,focus,menu"
      >
        <QuietNav primaryActionLabel="Start with Homa" />
      </div>
      <header className="quiet-fixture__header">
        <div
          data-gauntlet-primitive="web-quiet-identity"
          data-gauntlet-states="full,mark"
        >
          <QuietIdentity tone="light" size={32} />
        </div>
        <span className="quiet-fixture__eyebrow">Brand system fixture</span>
      </header>

      <section className="quiet-fixture__hero" aria-labelledby="quiet-fixture-title">
        <p className="quiet-fixture__eyebrow">Real work, warmly guided</p>
        <h1 id="quiet-fixture-title">A calmer way to keep learning moving.</h1>
        <p className="quiet-fixture__lede">
          Homa keeps the family&apos;s thread, shows the work that happened, and offers one useful next move.
        </p>
        <div className="quiet-fixture__actions">
          <div
            data-gauntlet-primitive="web-quiet-action"
            data-gauntlet-states="default,primary,secondary,disabled,focus,pressed"
          >
            <QuietAction href="/signin" size="large" icon={<Icon name="next" size={20} />}>
              Start with Homa
            </QuietAction>
            <QuietAction href="#evidence" kind="secondary" size="large">
              See the evidence
            </QuietAction>
            <QuietAction disabled kind="quiet">
              Preparing
            </QuietAction>
          </div>
        </div>
      </section>

      <section id="evidence" className="quiet-fixture__grid" aria-label="Quiet authority examples">
        <QuietFrame
          as="article"
          tone="paper"
          className="quiet-fixture__artifact"
          data-gauntlet-primitive="web-quiet-frame"
          data-gauntlet-states="paper,contained"
        >
          <div className="quiet-fixture__artifact-label">The real work</div>
          <h2>Counting by twos with Maya</h2>
          <p>Three practice pages, one proud correction, and a note to try the pattern with kitchen tools.</p>
          <QuietStatus tone="constructive">
            Ready to build on
          </QuietStatus>
        </QuietFrame>

        <div className="quiet-fixture__guide" aria-label="Homa keeps the thread">
          <div className="quiet-fixture__guide-mark" aria-hidden="true">
            <QuietIdentity variant="mark" tone="light" size={24} />
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

      <section className="quiet-fixture__atoms" aria-labelledby="quiet-fixture-atoms-title">
        <div className="quiet-fixture__atoms-heading">
          <p className="quiet-fixture__eyebrow">The atoms and their states</p>
          <h2 id="quiet-fixture-atoms-title">Quiet tools stay clear when the day gets busy.</h2>
          <p>
            These specimens keep native semantics, visible focus, and honest recovery in one place for every surface to borrow.
          </p>
        </div>

        <div className="quiet-fixture__primitive-grid">
          <div
            className="quiet-fixture__primitive-card"
            data-gauntlet-primitive="web-quiet-field"
            data-gauntlet-states="error,disabled,readonly,focus"
          >
            <QuietField
              id="fixture-parent-name"
              label="Parent name"
              hint="Use the name you like to see in your plan."
              error="Add a name before continuing."
              required
              disabled
              readOnly
              state="error"
            >
              <input type="text" defaultValue="Sidney" />
            </QuietField>
          </div>

          <div
            className="quiet-fixture__primitive-card"
            data-gauntlet-primitive="web-quiet-choice"
            data-gauntlet-states="selected,success,disabled,focus"
          >
            <QuietChoice
              name="fixture-pace"
              label="What feels right this week?"
              value="steady"
              options={[
                { value: "steady", label: "A steady week", description: "Enough structure, room to breathe." },
                { value: "light", label: "A lighter week", disabled: true },
              ]}
              hint="You can change this later."
              required
              state="success"
            />
          </div>

          <div
            className="quiet-fixture__primitive-card"
            data-gauntlet-primitive="web-quiet-feedback"
            data-gauntlet-states="error,loading,alert,retry"
          >
            <QuietFeedback tone="error" title="Your work is safe." busy>
              We could not save this change yet. Try again when you are ready.
            </QuietFeedback>
          </div>

          <div
            className="quiet-fixture__primitive-card"
            data-gauntlet-primitive="web-quiet-media"
            data-gauntlet-states="loading,empty,artifact"
          >
            <QuietMedia src="/brand/homa-mark.svg" alt="A Homa artifact mark" caption="A ready artifact preview." />
            <QuietMedia alt="A worksheet preview for Maya" caption="The artifact stays first." />
          </div>

          <div
            className="quiet-fixture__primitive-card"
            data-gauntlet-primitive="web-quiet-status"
            data-gauntlet-states="constructive,error,rest"
          >
            <p className="quiet-fixture__eyebrow">Truthful status</p>
            <QuietStatus tone="constructive">Ready to build on</QuietStatus>
            <QuietStatus tone="error">Needs another look</QuietStatus>
          </div>

          <div
            className="quiet-fixture__primitive-card quiet-fixture__icon-card"
            data-gauntlet-primitive="web-semantic-icon"
            data-gauntlet-states="decorative,labeled"
          >
            <p className="quiet-fixture__eyebrow">Semantic icon</p>
            <div className="quiet-fixture__icon-row">
              <Icon name="check" size={24} />
              <Icon name="next" size={24} decorative={false} label="Next useful move" />
            </div>
            <p>Roles resolve through the platform registry, not a local glyph.</p>
          </div>
        </div>

        <div
          className="quiet-fixture__recovery"
          data-gauntlet-recovery="true"
          data-gauntlet-primitive="web-quiet-feedback web-quiet-action"
          data-gauntlet-states="error,retry,decided"
        >
          <QuietFeedback tone="error" title="Nothing was lost.">
            Homa could not reach the plan. Your draft is still here.
          </QuietFeedback>
          <QuietAction kind="secondary" icon={<Icon name="refresh" size={20} />}>
            Try again
          </QuietAction>
        </div>

        <div
          className="quiet-fixture__thread-card"
          data-gauntlet-primitive="web-quiet-thread"
          data-gauntlet-states="draw,land,still,reduced-motion"
        >
          <QuietThread label="Connects the learning object to the next move" />
          <p>The thread is meaningful when it connects work to a next move, then settles.</p>
        </div>
      </section>

      <div
        className="quiet-fixture__footer"
        data-gauntlet-primitive="web-quiet-footer"
        data-gauntlet-states="rest,focus,links"
      >
        <QuietFooter />
      </div>
    </main>
  );
}
