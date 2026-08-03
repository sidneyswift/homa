"use client";

import Image from "next/image";
import { Check, Clock3, FileCheck2, Files, HelpCircle } from "lucide-react";
import { useState } from "react";

import { QuietAction } from "../design/QuietAction";
import { QuietFrame } from "../design/QuietFrame";
import { QuietStatus } from "../design/QuietStatus";
import { QuietThread } from "../design/QuietThread";
import { Icon } from "../design/Icon";
import { QuietFooter } from "../design/QuietFooter";
import { ReportPreview } from "../../app/onboarding/report-preview";
import { FAQ_ITEMS } from "./faq-items";
import { HERO_COPY, PAIN_CLOSING, PAIN_ITEMS, CAPABILITY_ITEMS, FOUNDER_STORY_COPY, SAMPLE_REPORT_COPY, type CapabilityId, type PainId } from "./landing-content";
import { Nav } from "./Nav";
import { SignupPopupProvider, useSignupPopup } from "./SignupPopupProvider";

const PAIN_ICONS: Record<PainId, typeof Clock3> = {
  planning: Clock3,
  proof: HelpCircle,
  scattered: Files,
  paperwork: FileCheck2,
};

const QUIET_LANDING_CSS = `
.quiet-landing { --homa-muted-ink: color-mix(in srgb, var(--homa-ink) 64%, var(--homa-canvas)); --homa-soft-boundary: color-mix(in srgb, var(--homa-control-boundary) 34%, transparent); min-width: 320px; overflow-x: clip; background: var(--homa-canvas); color: var(--homa-ink); }
.quiet-landing .quiet-nav { position: sticky; top: 0; z-index: 50; background: transparent; }
.quiet-landing .quiet-nav__row { max-width: 1180px; }
.quiet-landing #how, .quiet-landing #features, .quiet-landing #sample-report, .quiet-landing #stories, .quiet-landing #faq { scroll-margin-top: calc(var(--quiet-nav-height) + 12px); }
.quiet-landing .quiet-nav__link { color: var(--homa-muted-ink); border-radius: var(--homa-radius-control); }
.quiet-landing .quiet-nav__link:hover, .quiet-landing .quiet-nav__link[aria-current="true"] { color: var(--homa-ink); }
.quiet-landing .quiet-nav__link::after { background: var(--homa-visual-coral); }
.quiet-landing .quiet-nav__signin { color: var(--homa-ink); }

.qa-hero { padding: clamp(26px, 5vw, 58px) 20px clamp(52px, 8vw, 94px); }
.qa-hero__grid { display: grid; grid-template-columns: minmax(0, .9fr) minmax(420px, 1.1fr); gap: clamp(30px, 5vw, 74px); align-items: center; max-width: 1180px; margin: 0 auto; }
.qa-kicker, .qa-eyebrow { color: var(--homa-brand-text); font: 800 .72rem/1.2 var(--font-sans); letter-spacing: .1em; text-transform: uppercase; }
.qa-hero h1, .qa-section h2, .qa-frame h3 { font-family: var(--font-display); font-weight: 600; letter-spacing: -.02em; }
.qa-hero h1 { max-width: 610px; margin: 14px 0 0; color: var(--homa-ink); font-size: clamp(3.1rem, 7vw, 6.6rem); line-height: .88; text-wrap: balance; }
.qa-hero h1 em { color: var(--homa-brand-text); font-style: normal; }
.qa-hero__body { max-width: 570px; margin: 24px 0 0; color: var(--homa-muted-ink); font-size: clamp(1.04rem, 1.4vw, 1.22rem); line-height: 1.58; }
.qa-hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 28px; }
.qa-hero__note { margin: 12px 0 0; color: var(--homa-muted-ink); font-size: .84rem; line-height: 1.45; }
.qa-hero__proofs { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 30px 0 0; padding: 0; color: var(--homa-muted-ink); font-size: .82rem; list-style: none; }
.qa-hero__proofs li { display: inline-flex; align-items: center; gap: 6px; }
.qa-hero__proofs svg { color: var(--homa-constructive-ink); }
.qa-object { position: relative; min-width: 0; padding: clamp(18px, 3vw, 28px); border-radius: var(--homa-radius-frame); background: var(--homa-contained-band); box-shadow: 0 22px 56px color-mix(in srgb, var(--homa-contained-band) 22%, transparent); }
.qa-object::before { content: ""; position: absolute; top: 20px; right: 24px; width: 90px; height: 90px; border: 1px solid color-mix(in srgb, var(--homa-visual-coral) 62%, transparent); border-radius: 50%; opacity: .6; }
.qa-object__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: color-mix(in srgb, var(--homa-paper) 72%, transparent); font: 700 .75rem/1.2 var(--font-sans); letter-spacing: .04em; text-transform: uppercase; }
.qa-object__head .quiet-status { flex: none; padding: 7px 10px; background: var(--homa-constructive-tint); color: var(--homa-constructive-ink); font-size: .72rem; letter-spacing: 0; text-transform: none; }
.qa-object__work { position: relative; margin-top: 42px; border: 1px solid color-mix(in srgb, var(--homa-paper) 22%, transparent); border-radius: var(--homa-radius-card); background: color-mix(in srgb, var(--homa-paper) 96%, transparent); padding: clamp(20px, 4vw, 34px); color: var(--homa-ink); }
.qa-object__work::before { content: ""; display: block; width: 48px; height: 4px; border-radius: 99px; background: var(--homa-visual-coral); }
.qa-object__work h2 { max-width: 520px; margin: 18px 0 8px; font: 600 clamp(1.9rem, 3.7vw, 3rem)/.98 var(--font-display); letter-spacing: -.02em; }
.qa-object__work p { max-width: 470px; margin: 0; color: var(--homa-muted-ink); line-height: 1.5; }
.qa-object__tasks { display: grid; gap: 8px; margin-top: 24px; }
.qa-object__task { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 10px; min-height: 50px; border-top: 1px solid var(--homa-soft-boundary); padding-top: 8px; }
.qa-object__task-mark { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid var(--homa-control-boundary); border-radius: 50%; color: var(--homa-constructive-ink); }
.qa-object__task strong { display: block; font-size: .9rem; }
.qa-object__task span { display: block; margin-top: 2px; color: var(--homa-muted-ink); font-size: .78rem; }
.qa-object__task time { color: var(--homa-muted-ink); font-size: .75rem; font-variant-numeric: tabular-nums; }
.qa-object__next { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 15px; border-top: 1px solid color-mix(in srgb, var(--homa-paper) 22%, transparent); padding-top: 15px; color: var(--homa-paper); }
.qa-object__next small { display: block; color: color-mix(in srgb, var(--homa-paper) 68%, transparent); font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; }
.qa-object__next strong { display: block; margin-top: 4px; font: 500 1.4rem/1 var(--font-display); }
.qa-object__next .quiet-action { min-width: 44px; padding: 0 14px; background: var(--homa-paper); color: var(--homa-midnight-action); }
.qa-thread { max-width: 300px; margin: 26px 0 0; opacity: .88; }

.qa-band { border-top: 1px solid var(--homa-soft-boundary); }
.qa-section { max-width: 1180px; margin: 0 auto; padding: clamp(58px, 8vw, 100px) 20px; }
.qa-section__intro { max-width: 700px; }
.qa-section h2 { margin: 12px 0 0; color: var(--homa-ink); font-size: clamp(2.45rem, 5vw, 4.4rem); line-height: .94; text-wrap: balance; }
.qa-section__lead { max-width: 640px; margin: 18px 0 0; color: var(--homa-muted-ink); font-size: 1.05rem; line-height: 1.58; }
.qa-pain-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 38px; }
.qa-frame { padding: 20px; }
.qa-pain-card { min-height: 198px; }
.qa-pain-card__icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: var(--homa-radius-control); background: var(--homa-highlight-tint); color: var(--homa-highlight-ink); }
.qa-pain-card h3 { margin: 23px 0 8px; font-size: 1.45rem; line-height: 1; }
.qa-pain-card p { margin: 0; color: var(--homa-muted-ink); line-height: 1.48; }
.qa-closing { display: flex; align-items: center; gap: 14px; margin-top: 34px; color: var(--homa-ink); font: 500 clamp(1.35rem, 2.5vw, 1.8rem)/1.15 var(--font-display); }
.qa-closing::before { content: ""; width: 38px; height: 3px; flex: none; border-radius: 99px; background: var(--homa-visual-coral); }
.qa-capability-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 38px; }
.qa-capability-card { display: flex; min-width: 0; flex-direction: column; }
.qa-capability-card h3 { margin: 0; font-size: clamp(1.55rem, 2.4vw, 2.1rem); line-height: .98; }
.qa-capability-card p { margin: 12px 0 22px; color: var(--homa-muted-ink); line-height: 1.5; }
.qa-capability-card__proof { margin-top: auto; overflow: hidden; border-radius: var(--homa-radius-control); }
.qa-proof { min-height: 142px; border-top: 1px solid var(--homa-soft-boundary); padding-top: 16px; }
.qa-proof__meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--homa-muted-ink); font-size: .74rem; }
.qa-proof__meta strong { color: var(--homa-ink); font-size: .82rem; }
.qa-proof__rows { display: grid; gap: 7px; margin-top: 13px; }
.qa-proof__row { display: grid; grid-template-columns: 18px 1fr auto; align-items: center; gap: 8px; min-height: 32px; border-bottom: 1px solid var(--homa-soft-boundary); color: var(--homa-ink); font-size: .78rem; }
.qa-proof__row:last-child { border-bottom: 0; }
.qa-proof__mark { display: grid; place-items: center; width: 18px; height: 18px; border: 1px solid var(--homa-control-boundary); border-radius: 50%; color: var(--homa-constructive-ink); }
.qa-proof__row small { color: var(--homa-muted-ink); font-size: .7rem; }
.qa-proof__document { display: grid; grid-template-columns: 62px 1fr; gap: 13px; align-items: center; }
.qa-proof__document img { display: block; width: 62px; height: 82px; object-fit: cover; object-position: top center; border: 1px solid var(--homa-soft-boundary); border-radius: 7px; box-shadow: 0 5px 12px color-mix(in srgb, var(--homa-ink) 10%, transparent); }
.qa-proof__document p { margin: 5px 0 0; color: var(--homa-muted-ink); font-size: .75rem; line-height: 1.4; }
.qa-proof__document-status { display: inline-flex; margin-top: 10px; border-radius: var(--homa-radius-control); background: var(--homa-constructive-tint); color: var(--homa-constructive-ink); padding: 6px 8px; font-size: .7rem; font-weight: 700; }
.qa-proof__folder { display: grid; grid-template-columns: 42px 1fr auto; gap: 10px; align-items: center; min-height: 44px; border: 1px solid var(--homa-soft-boundary); border-radius: var(--homa-radius-control); background: var(--homa-canvas); padding: 7px; }
.qa-proof__folder + .qa-proof__folder { margin-top: 7px; }
.qa-proof__folder-thumb { width: 42px; height: 30px; overflow: hidden; border-radius: 5px; background: var(--homa-paper); }
.qa-proof__folder-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top center; }
.qa-proof__folder strong { display: block; font-size: .75rem; }
.qa-proof__folder small { display: block; margin-top: 2px; color: var(--homa-muted-ink); font-size: .68rem; }
.qa-proof__metric { display: flex; align-items: center; gap: 12px; min-height: 66px; border-radius: var(--homa-radius-control); background: var(--homa-info-tint); padding: 12px; }
.qa-proof__metric strong { display: block; color: var(--homa-info-ink); font: 600 1.7rem/1 var(--font-display); }
.qa-proof__metric span { display: block; margin-top: 4px; color: var(--homa-info-ink); font-size: .76rem; line-height: 1.35; }
.qa-proof__bar { height: 8px; overflow: hidden; border-radius: 99px; background: color-mix(in srgb, var(--homa-info-ink) 16%, transparent); }
.qa-proof__bar::before { content: ""; display: block; width: 72%; height: 100%; border-radius: inherit; background: var(--homa-info-ink); }

.qa-report { display: grid; grid-template-columns: minmax(0, .82fr) minmax(0, 1.18fr); gap: clamp(26px, 5vw, 70px); align-items: center; }
.qa-report h2 { max-width: 510px; }
.qa-report__reassurance { margin: 22px 0 0; border-left: 3px solid var(--homa-constructive-ink); background: var(--homa-constructive-tint); padding: 13px 15px; color: var(--homa-constructive-ink); line-height: 1.5; }
.qa-report__body { margin: 16px 0 0; color: var(--homa-muted-ink); line-height: 1.55; }
.qa-report__preview { min-width: 0; overflow: hidden; border: 1px solid var(--homa-soft-boundary); border-radius: var(--homa-radius-card); background: var(--homa-paper); box-shadow: 0 14px 34px color-mix(in srgb, var(--homa-ink) 8%, transparent); }
.qa-report__preview > * { max-width: 100%; }

.qa-story { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: clamp(25px, 6vw, 88px); align-items: center; }
.qa-story h2 { max-width: 570px; }
.qa-story__body { margin: 22px 0 0; color: var(--homa-muted-ink); font-size: 1.05rem; line-height: 1.65; }
.qa-story__signature { margin: 22px 0 0; color: var(--homa-brand-text); font: 600 1.3rem/1 var(--font-display); }
.qa-story__photo { overflow: hidden; border: 8px solid var(--homa-paper); border-radius: var(--homa-radius-card); box-shadow: 0 16px 32px color-mix(in srgb, var(--homa-ink) 12%, transparent); transform: rotate(1.2deg); }
.qa-story__photo img { display: block; width: 100%; height: auto; }

.qa-faq { display: grid; grid-template-columns: minmax(220px, .52fr) minmax(0, 1fr); gap: clamp(24px, 7vw, 110px); align-items: start; }
.qa-faq__list { border-top: 1px solid var(--homa-control-boundary); }
.qa-faq__item { border-bottom: 1px solid var(--homa-soft-boundary); }
.qa-faq__question { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 64px; border: 0; background: transparent; color: var(--homa-ink); padding: 0; font: 600 1.15rem/1.25 var(--font-display); text-align: left; cursor: pointer; }
.qa-faq__question:focus-visible { outline: 3px solid color-mix(in srgb, var(--homa-visual-coral) 62%, transparent); outline-offset: 5px; }
.qa-faq__question svg { flex: none; color: var(--homa-brand-text); transition: transform var(--homa-motion-fast) var(--homa-motion-ease-out); }
.qa-faq__item[data-open="true"] .qa-faq__question svg { transform: rotate(45deg); }
.qa-faq__answer { max-width: 660px; padding: 0 36px 20px 0; color: var(--homa-muted-ink); line-height: 1.55; }
.qa-cta { background: var(--homa-contained-band); color: var(--homa-paper); }
.qa-cta__inner { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 26px; align-items: center; }
.qa-cta h2 { color: var(--homa-paper); }
.qa-cta p { max-width: 650px; color: color-mix(in srgb, var(--homa-paper) 72%, transparent); }
.qa-cta .quiet-action { background: var(--homa-paper); color: var(--homa-midnight-action); }
@media (max-width: 960px) {
  .qa-hero__grid { grid-template-columns: 1fr; max-width: 760px; }
  .qa-hero__copy { max-width: 700px; }
  .qa-pain-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .qa-story { grid-template-columns: minmax(0, 1fr) 230px; }
}
@media (max-width: 700px) {
  .qa-hero h1 { font-size: clamp(3.2rem, 16vw, 5.2rem); }
  .qa-object { margin-inline: -4px; }
  .qa-capability-grid, .qa-report, .qa-story, .qa-faq, .qa-cta__inner { grid-template-columns: 1fr; }
  .qa-report__preview { order: -1; }
  .qa-story__photo { width: min(240px, 72vw); }
}
@media (max-width: 480px) {
  .qa-hero { padding-inline: 16px; }
  .qa-section { padding-inline: 16px; }
  .qa-pain-grid { grid-template-columns: 1fr; }
  .qa-capability-grid { gap: 10px; }
  .qa-frame { padding: 17px; }
  .qa-object__next { align-items: flex-start; flex-direction: column; }
  .qa-object__next .quiet-action { align-self: stretch; }
}
@media (prefers-reduced-motion: reduce) {
  .qa-faq__question svg { transition: none; }
  .qa-story__photo { transform: none; }
}
`;

function TrialAction({ secondary = false }: { secondary?: boolean }) {
  const openPopup = useSignupPopup();
  const action = secondary ? "See the sample report" : HERO_COPY.primaryAction;
  const href = secondary ? SAMPLE_REPORT_COPY.href : "/onboarding";
  const icon = <Icon name="next" size={20} />;
  return openPopup && !secondary ? (
    <QuietAction kind="primary" size="large" onClick={openPopup} icon={icon}>{action}</QuietAction>
  ) : (
    <QuietAction kind={secondary ? "secondary" : "primary"} size="large" href={href} icon={icon}>{action}</QuietAction>
  );
}

function QuietHeroHeadline() {
  const marker = "assistant";
  const index = HERO_COPY.headline.indexOf(marker);
  if (index < 0) return <>{HERO_COPY.headline}</>;
  return <>{HERO_COPY.headline.slice(0, index)}<em>{marker}</em>{HERO_COPY.headline.slice(index + marker.length)}</>;
}

function HeroObject() {
  const tasks = [
    ["Butterfly math", "Practice page ready", "20m"],
    ["Read together", "Choose a book", "15m"],
    ["Science walk", "Log what you noticed", "30m"],
  ] as const;
  return (
    <QuietFrame tone="contained" as="article" className="qa-object">
      <div className="qa-object__head"><span>Monday · Maya&apos;s plan</span><QuietStatus tone="constructive">Ready to start</QuietStatus></div>
      <div className="qa-object__work">
        <span className="qa-eyebrow">One useful next move</span>
        <h2>Make space for a curious morning.</h2>
        <p>Homa keeps the plan clear, then gives you the next thing to try.</p>
        <div className="qa-object__tasks" role="list" aria-label="Today's plan">
          {tasks.map(([title, body, time], index) => (
            <div className="qa-object__task" key={title} role="listitem">
              <span className="qa-object__task-mark" aria-hidden="true">{index === 0 ? <Check size={16} strokeWidth={3} /> : null}</span>
              <div><strong>{title}</strong><span>{body}</span></div>
              <time>{time}</time>
            </div>
          ))}
        </div>
      </div>
      <div className="qa-object__next">
        <div><small>After the lesson</small><strong>Keep the record, too.</strong></div>
        <QuietAction kind="quiet" href="#features" icon={<Icon name="next" size={20} />}>See how</QuietAction>
      </div>
    </QuietFrame>
  );
}

function QuietCapabilityProof({ capabilityId }: { capabilityId: CapabilityId }) {
  if (capabilityId === "plan") {
    return <div className="qa-proof"><div className="qa-proof__meta"><strong>Maya · age 4</strong><span>Tuesday · 1h 25m</span></div><div className="qa-proof__rows">{[["Butterfly math", "Done"], ["Butterfly book", "20m"], ["Science walk", "30m"]].map(([title, meta], index) => <div className="qa-proof__row" key={title}><span className="qa-proof__mark">{index === 0 ? <Check size={11} strokeWidth={3} /> : null}</span><span>{title}</span><small>{meta}</small></div>)}</div></div>;
  }
  if (capabilityId === "practice") {
    return <div className="qa-proof qa-proof__document"><Image src="/images/hero-butterfly-math.png" alt="" width={1024} height={1536} sizes="62px" /><div><div className="qa-proof__meta"><strong>Made for Maya</strong><span>Tuesday</span></div><p>A practice page shaped around this week&apos;s lesson.</p><span className="qa-proof__document-status">Ready to print</span></div></div>;
  }
  if (capabilityId === "binder") {
    return <div className="qa-proof"><div className="qa-proof__folder"><span className="qa-proof__folder-thumb"><Image src="/images/hero-butterfly-math.png" alt="" width={1024} height={1536} sizes="42px" /></span><span><strong>Butterfly math</strong><small>Practice page</small></span><small>Tue</small></div><div className="qa-proof__folder"><span className="qa-proof__folder-thumb" /><span><strong>Progress report</strong><small>Started with strengths</small></span><small>Mon</small></div></div>;
  }
  return <div className="qa-proof"><div className="qa-proof__metric"><strong>4.5h</strong><span>shared this week<br />across 3 subjects</span></div><div className="qa-proof__bar" aria-hidden="true" /></div>;
}

function QuietFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="qa-faq__list">
      {FAQ_ITEMS.map(([question, answer], index) => {
        const open = openIndex === index;
        const answerId = `quiet-faq-answer-${index}`;
        return (
          <div className="qa-faq__item" data-open={open ? "true" : undefined} key={question}>
            <h3 style={{ margin: 0 }}>
              <button className="qa-faq__question" type="button" aria-expanded={open} aria-controls={answerId} onClick={() => setOpenIndex(open ? null : index)}>
                <span>{question}</span><span aria-hidden="true">{open ? "−" : "+"}</span>
              </button>
            </h3>
            {open ? <p className="qa-faq__answer" id={answerId}>{answer}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export function QuietLanding() {
  return (
    <div className="quiet-landing">
      <style>{QUIET_LANDING_CSS}</style>
      <SignupPopupProvider>
        <Nav />
        <main>
          <section className="qa-hero" aria-labelledby="quiet-hero-title">
            <div className="qa-hero__grid">
              <div className="qa-hero__copy">
                <div className="qa-kicker">Made for homeschool parents</div>
                <h1 id="quiet-hero-title"><QuietHeroHeadline /></h1>
                <p className="qa-hero__body">{HERO_COPY.body}</p>
                <div className="qa-hero__actions"><TrialAction /><TrialAction secondary /></div>
                <p className="qa-hero__note">{HERO_COPY.primaryActionNote}</p>
                <ul className="qa-hero__proofs"><li><Check size={15} strokeWidth={3} /> Weekly plans that adapt</li><li><Check size={15} strokeWidth={3} /> Practice pages made for your child</li><li><Check size={15} strokeWidth={3} /> Records you can find again</li></ul>
                <QuietThread className="qa-thread" label="A line connecting today's work to what comes next" />
              </div>
              <HeroObject />
            </div>
          </section>

          <section id="how" className="qa-band qa-section" aria-labelledby="quiet-how-title">
            <div className="qa-section__intro"><div className="qa-eyebrow">The work around teaching</div><h2 id="quiet-how-title">Planning and records take time.</h2><p className="qa-section__lead">Homa prepares the week, keeps the record, and leaves you with more attention for the part only you can do.</p></div>
            <div className="qa-pain-grid">{PAIN_ITEMS.map(({ id, title, body }) => { const Icon = PAIN_ICONS[id]; return <QuietFrame as="article" tone="paper" className="qa-frame qa-pain-card" key={id}><span className="qa-pain-card__icon"><Icon size={20} aria-hidden="true" /></span><h3>{title}</h3><p>{body}</p></QuietFrame>; })}</div>
            <p className="qa-closing">{PAIN_CLOSING}</p>
          </section>

          <section id="features" className="qa-band qa-section" aria-labelledby="quiet-features-title">
            <div className="qa-section__intro"><div className="qa-eyebrow">One connected record</div><h2 id="quiet-features-title">Plans, pages, and proof in one place.</h2><p className="qa-section__lead">Every piece of the week stays connected, from the first idea to the page you print and the time you share.</p></div>
            <div className="qa-capability-grid">{CAPABILITY_ITEMS.map(({ id, title, body }) => <QuietFrame as="article" tone="paper" className="qa-frame qa-capability-card" key={id}><h3>{title}</h3><p>{body}</p><div className="qa-capability-card__proof"><QuietCapabilityProof capabilityId={id} /></div></QuietFrame>)}</div>
          </section>

          <section id="sample-report" className="qa-band qa-section" aria-labelledby="quiet-report-title">
            <div className="qa-report"><div><div className="qa-eyebrow">{SAMPLE_REPORT_COPY.eyebrow}</div><h2 id="quiet-report-title">{SAMPLE_REPORT_COPY.headline}</h2><p className="qa-report__reassurance">{SAMPLE_REPORT_COPY.reassurance}</p><p className="qa-report__body">{SAMPLE_REPORT_COPY.body}</p><div className="qa-hero__actions"><QuietAction kind="secondary" size="large" href={SAMPLE_REPORT_COPY.href} icon={<Icon name="next" size={20} />}>{SAMPLE_REPORT_COPY.action}</QuietAction></div></div><div className="qa-report__preview"><ReportPreview /></div></div>
          </section>

          <section id="stories" className="qa-band qa-section" aria-labelledby="quiet-story-title">
            <div className="qa-story"><div><div className="qa-eyebrow">{FOUNDER_STORY_COPY.eyebrow}</div><h2 id="quiet-story-title">{FOUNDER_STORY_COPY.headline}</h2><p className="qa-story__body">{FOUNDER_STORY_COPY.body}</p><p className="qa-story__signature">{FOUNDER_STORY_COPY.signature}</p></div><div className="qa-story__photo"><Image src="/images/founders.jpg" alt="Alessa and Carolyng, Homa's co-founders, smiling together outside in the sun" width={920} height={868} sizes="280px" /></div></div>
          </section>

          <section id="faq" className="qa-band qa-section" aria-labelledby="quiet-faq-title"><div className="qa-faq"><div className="qa-section__intro"><div className="qa-eyebrow">Good to know</div><h2 id="quiet-faq-title">Questions, answered.</h2><p className="qa-section__lead">Short answers, before you begin.</p></div><QuietFaq /></div></section>

          <section className="qa-cta qa-section" aria-labelledby="quiet-cta-title"><div className="qa-cta__inner"><div><div className="qa-eyebrow" style={{ color: "var(--homa-paper)" }}>Start with a calmer week</div><h2 id="quiet-cta-title">Every plan starts with 7 free days.</h2><p className="qa-section__lead">Nothing is charged during them. We email you a reminder before the first charge.</p></div><TrialAction /></div></section>
        </main>
        <QuietFooter />
      </SignupPopupProvider>
    </div>
  );
}
