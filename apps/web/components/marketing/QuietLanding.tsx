"use client";

import Image from "next/image";
import { useState } from "react";

import { QuietAction } from "../design/QuietAction";
import { QuietFrame } from "../design/QuietFrame";
import { QuietThread } from "../design/QuietThread";
import { Icon } from "../design/Icon";
import type { SemanticIconName } from "../design/Icon";
import { QuietFooter } from "../design/QuietFooter";
import { Logo } from "../brand/Logo";
import { ReportPreview } from "../../app/onboarding/report-preview";
import { FAQ_ITEMS } from "./faq-items";
import { HERO_COPY, PAIN_CLOSING, PAIN_ITEMS, CAPABILITY_FEATURE_HREFS, CAPABILITY_ITEMS, FOUNDER_STORY_COPY, SAMPLE_REPORT_COPY, type CapabilityId, type PainId } from "./landing-content";
import { Nav } from "./Nav";
import { SignupPopupProvider, useSignupPopup } from "./SignupPopupProvider";

const PAIN_ICONS: Record<PainId, SemanticIconName> = {
  planning: "time",
  proof: "help",
  scattered: "files",
  paperwork: "document",
};

const QUIET_LANDING_CSS = `
.quiet-landing { min-width: 320px; overflow-x: clip; background: var(--homa-canvas); color: var(--homa-ink); }
.quiet-landing .quiet-nav { position: sticky; top: 0; z-index: 50; background: transparent; }
.quiet-landing .quiet-nav__row { max-width: 1180px; }
.quiet-landing #how, .quiet-landing #features, .quiet-landing #sample-report, .quiet-landing #stories, .quiet-landing #faq { scroll-margin-top: calc(var(--quiet-nav-height) + 12px); }
.quiet-landing .quiet-nav__link { color: var(--homa-muted-ink); border-radius: var(--homa-radius-control); }
.quiet-landing .quiet-nav__link:hover, .quiet-landing .quiet-nav__link[aria-current="true"] { color: var(--homa-ink); }
.quiet-landing .quiet-nav__link::after { background: var(--homa-visual-coral); }
.quiet-landing .quiet-nav__signin { color: var(--homa-ink); }

.qa-eyebrow { color: var(--homa-brand-text); font: 800 .72rem/1.2 var(--font-sans); letter-spacing: .1em; text-transform: uppercase; }
.qa-section h2, .qa-frame h3 { font-family: var(--font-display); font-weight: 600; letter-spacing: -.02em; }
.qa-opening { padding: clamp(18px, 3vw, 34px) clamp(16px, 4vw, 48px) clamp(46px, 7vw, 88px); }
.qa-opening__shell { max-width: 1240px; margin: 0 auto; overflow: hidden; border: 1px solid color-mix(in srgb, var(--homa-ink) 14%, transparent); border-radius: clamp(18px, 2.5vw, 30px); box-shadow: 0 30px 80px color-mix(in srgb, var(--homa-ink) 12%, transparent); }
.qa-opening__world { position: relative; min-height: clamp(520px, 59vw, 720px); overflow: hidden; isolation: isolate; }
.qa-opening__world::after { content: ""; position: absolute; z-index: -1; inset: 0; background: linear-gradient(90deg, color-mix(in srgb, var(--homa-midnight-action) 96%, transparent) 0%, color-mix(in srgb, var(--homa-midnight-action) 86%, transparent) 34%, color-mix(in srgb, var(--homa-midnight-action) 42%, transparent) 70%, color-mix(in srgb, var(--homa-midnight-action) 8%, transparent) 100%), linear-gradient(0deg, color-mix(in srgb, var(--homa-midnight-action) 32%, transparent), transparent 58%); }
.qa-opening__photo { position: absolute !important; z-index: -2; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 64% 56%; filter: saturate(.78) contrast(.96); }
.qa-opening__copy { position: absolute; z-index: 2; left: clamp(24px, 6vw, 82px); top: 50%; width: min(650px, calc(100% - 48px)); transform: translateY(-50%); animation: qa-opening-enter 480ms var(--homa-motion-ease-out) both; }
.qa-opening__kicker { color: color-mix(in srgb, var(--homa-paper) 82%, var(--homa-visual-coral)); font: 800 .72rem/1.2 var(--font-sans); letter-spacing: .1em; text-transform: uppercase; }
.qa-opening__copy h1 { max-width: 660px; margin: 15px 0 0; color: var(--homa-paper); font: 400 clamp(3.6rem, 7.7vw, 6.8rem)/.88 var(--font-display); letter-spacing: -.045em; text-wrap: balance; }
.qa-opening__copy h1 span { color: var(--homa-visual-coral); }
.qa-opening__copy p { max-width: 540px; margin: 20px 0 0; color: color-mix(in srgb, var(--homa-paper) 88%, transparent); font-size: clamp(1.02rem, 1.4vw, 1.24rem); line-height: 1.55; }
.qa-opening__next { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 11px; align-items: center; width: fit-content; max-width: 100%; margin-top: 25px; border: 1px solid color-mix(in srgb, var(--homa-paper) 35%, transparent); border-radius: 18px; background: color-mix(in srgb, var(--homa-midnight-action) 72%, transparent); box-shadow: 0 16px 34px color-mix(in srgb, var(--homa-ink) 26%, transparent); padding: 10px 14px 10px 10px; backdrop-filter: blur(12px); }
.qa-opening__next-mark { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--homa-visual-coral); color: var(--homa-ink); font: 800 18px/1 var(--font-sans); }
.qa-opening__next small { display: block; color: color-mix(in srgb, var(--homa-visual-coral) 66%, var(--homa-paper)); font: 800 .68rem/1.2 var(--font-sans); letter-spacing: .06em; text-transform: uppercase; }
.qa-opening__next strong { display: block; margin-top: 3px; color: var(--homa-paper); font: 700 .92rem/1.3 var(--font-sans); }
.qa-opening__thread { position: absolute; z-index: 1; left: clamp(22px, 5.7vw, 78px); bottom: clamp(24px, 6vw, 72px); width: min(520px, 60vw); height: auto; opacity: .92; }
.qa-opening__thread path { stroke: var(--homa-visual-coral); stroke-dasharray: 760; stroke-dashoffset: 760; animation: qa-thread-draw 760ms 180ms var(--homa-motion-ease-out) forwards; }
.qa-opening__character { position: absolute; z-index: 3; right: clamp(18px, 4vw, 58px); bottom: clamp(16px, 3vw, 38px); padding: 12px; border-radius: 22px; background: color-mix(in srgb, var(--homa-visual-coral) 92%, transparent); box-shadow: 0 14px 24px color-mix(in srgb, var(--homa-ink) 28%, transparent); animation: qa-character-peek 520ms 260ms var(--homa-motion-ease-out) both; }
.qa-opening__character svg { display: block; width: clamp(48px, 6vw, 74px); height: auto; }
.qa-authority { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, .9fr); gap: clamp(28px, 5vw, 78px); align-items: center; min-height: 580px; overflow: hidden; background: var(--homa-contained-band); padding: clamp(42px, 6vw, 84px); isolation: isolate; }
.qa-authority::before { content: ""; position: absolute; z-index: -1; width: min(55vw, 700px); aspect-ratio: 1; right: -17%; top: -36%; border-radius: 42% 58% 47% 53% / 56% 41% 59% 44%; background: color-mix(in srgb, var(--homa-info-ink) 16%, transparent); transform: rotate(-9deg); }
.qa-authority__copy { position: relative; z-index: 2; }
.qa-authority__kicker { display: inline-flex; align-items: center; gap: 9px; color: color-mix(in srgb, var(--homa-paper) 82%, var(--homa-visual-coral)); font: 800 .72rem/1.2 var(--font-sans); letter-spacing: .1em; text-transform: uppercase; }
.qa-authority__kicker::before { content: ""; width: 30px; height: 2px; border-radius: 2px; background: var(--homa-visual-coral); }
.qa-authority h2 { max-width: 720px; margin: 18px 0 0; color: var(--homa-paper); font: 400 clamp(3.1rem, 6.4vw, 5.6rem)/.93 var(--font-display); letter-spacing: -.04em; }
.qa-authority h2 span { color: var(--homa-visual-coral); }
.qa-authority__copy > p { max-width: 640px; margin: 22px 0 0; color: color-mix(in srgb, var(--homa-paper) 86%, transparent); font-size: clamp(1.02rem, 1.4vw, 1.24rem); line-height: 1.6; }
.qa-authority__copy > .qa-opening__note { margin-top: 12px; color: color-mix(in srgb, var(--homa-paper) 68%, transparent); font-size: .78rem; line-height: 1.45; }
.qa-authority__actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.qa-authority > .qa-authority__copy .qa-authority__actions .quiet-action--secondary { border-color: color-mix(in srgb, var(--homa-paper) 42%, transparent); color: var(--homa-paper); }
.qa-product { position: relative; z-index: 2; border: 1px solid color-mix(in srgb, var(--homa-paper) 42%, transparent); border-radius: 28px; background: var(--homa-paper); box-shadow: 0 30px 70px color-mix(in srgb, var(--homa-ink) 32%, transparent); color: var(--homa-ink); padding: 18px; transform: rotate(1deg); animation: qa-product-enter 480ms var(--homa-motion-ease-out) both; }
.qa-product__top { display: flex; justify-content: space-between; gap: 12px; align-items: center; color: var(--homa-muted-ink); font: 650 .75rem/1.3 var(--font-sans); }
.qa-product__top .quiet-status { display: inline-flex; align-items: center; gap: 7px; border-radius: 999px; background: var(--homa-constructive-tint); color: var(--homa-constructive-ink); padding: 7px 10px; font-size: .72rem; }
.qa-product__top .quiet-status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--homa-constructive-ink); }
.qa-product__question { margin: 26px 4px 0; }
.qa-product__question small { color: var(--homa-brand-text); font: 800 .68rem/1.2 var(--font-sans); letter-spacing: .08em; text-transform: uppercase; }
.qa-product__question h3 { max-width: 420px; margin: 9px 0 0; color: var(--homa-ink); font: 500 clamp(2.15rem, 4vw, 3.2rem)/.98 var(--font-display); letter-spacing: -.03em; }
.qa-product__state { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; align-items: center; margin-top: 24px; border: 1px solid var(--homa-soft-boundary); border-radius: 18px; background: var(--homa-paper); padding: 14px; }
.qa-product__mark { display: grid; place-items: center; width: 60px; height: 56px; border-radius: 16px; background: color-mix(in srgb, var(--homa-visual-coral) 14%, var(--homa-paper)); transition: transform var(--homa-motion-base) var(--homa-motion-ease-out), box-shadow var(--homa-motion-base) var(--homa-motion-ease-out); }
.qa-product__mark svg { width: 47px; height: 47px; }
.qa-product__state[data-state="listening"] .qa-product__mark { transform: scale(1.04); box-shadow: 0 0 0 6px color-mix(in srgb, var(--homa-visual-coral) 18%, transparent); }
.qa-product__state[data-state="working"] .qa-product__mark svg { animation: qa-mark-orient 900ms ease-in-out infinite alternate; }
.qa-product__state[data-state="ready"] .qa-product__mark { transform: translateY(-2px); }
.qa-product__state-copy strong { display: block; color: var(--homa-ink); font-size: .88rem; }
.qa-product__state-copy span { display: block; margin-top: 3px; color: var(--homa-muted-ink); font-size: .75rem; line-height: 1.4; }
.qa-product__activity { grid-column: 2; display: flex; align-items: center; gap: 9px; min-height: 18px; color: var(--homa-brand-text); font-size: .72rem; }
.qa-product__activity i { display: block; width: 4px; height: 12px; border-radius: 999px; background: currentColor; }
.qa-product__activity i:nth-child(2) { height: 20px; }
.qa-product__activity i:nth-child(3) { height: 8px; }
.qa-product__state[data-state="listening"] .qa-product__activity i { animation: qa-wave 700ms ease-in-out infinite alternate; }
.qa-product__state[data-state="listening"] .qa-product__activity i:nth-child(2) { animation-delay: 120ms; }
.qa-product__state[data-state="listening"] .qa-product__activity i:nth-child(3) { animation-delay: 240ms; }
.qa-product__activity span { margin-left: 2px; }
.qa-product__controls { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
.qa-product__control { min-height: 40px; border: 1px solid var(--homa-control-boundary); border-radius: 10px; background: var(--homa-paper); color: var(--homa-muted-ink); padding: 6px 8px; font: 700 .68rem/1 var(--font-sans); cursor: pointer; transition: background var(--homa-motion-fast) var(--homa-motion-ease-out), border-color var(--homa-motion-fast) var(--homa-motion-ease-out), color var(--homa-motion-fast) var(--homa-motion-ease-out); }
.qa-product__control[aria-pressed="true"] { border-color: var(--homa-midnight-action); background: color-mix(in srgb, var(--homa-midnight-action) 8%, var(--homa-paper)); color: var(--homa-midnight-action); }
.qa-product__control:focus-visible { outline: 3px solid color-mix(in srgb, var(--homa-visual-coral) 64%, transparent); outline-offset: 3px; }
.qa-product__next { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; border-top: 1px solid var(--homa-soft-boundary); padding-top: 14px; }
.qa-product__next b { display: block; color: var(--homa-ink); font-size: .76rem; }
.qa-product__next span { display: block; margin-top: 3px; color: var(--homa-muted-ink); font-size: .68rem; line-height: 1.35; }
.qa-product__next i { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: color-mix(in srgb, var(--homa-visual-coral) 16%, var(--homa-paper)); color: var(--homa-brand-text); font-style: normal; }
.qa-product__artifact { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 12px; align-items: center; margin-top: 12px; border: 1px solid var(--homa-soft-boundary); border-radius: 14px; background: var(--homa-highlight-tint); padding: 8px; }
.qa-product__artifact img { display: block; width: 70px; height: 62px; object-fit: cover; object-position: center 28%; border-radius: 8px; }
.qa-product__artifact small { display: block; color: var(--homa-brand-text); font: 800 .61rem/1.2 var(--font-sans); letter-spacing: .06em; text-transform: uppercase; }
.qa-product__artifact strong { display: block; margin-top: 4px; color: var(--homa-ink); font: 500 1.03rem/1.05 var(--font-display); }
.qa-product__artifact p { margin: 4px 0 0; color: var(--homa-muted-ink); font-size: .66rem; line-height: 1.35; }
@keyframes qa-opening-enter { from { opacity: 0; transform: translateY(calc(-50% + 12px)); } to { opacity: 1; transform: translateY(-50%); } }
@keyframes qa-product-enter { from { opacity: 0; transform: translateY(18px) rotate(1deg); } to { opacity: 1; transform: translateY(0) rotate(1deg); } }
@keyframes qa-thread-draw { to { stroke-dashoffset: 0; } }
@keyframes qa-character-peek { from { opacity: 0; transform: translateY(12px) scale(.92); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes qa-mark-orient { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
@keyframes qa-wave { from { transform: scaleY(.65); } to { transform: scaleY(1.15); } }

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
  .qa-opening__world { min-height: 600px; }
  .qa-authority { grid-template-columns: 1fr; }
  .qa-product { max-width: 620px; margin-inline: auto; }
  .qa-pain-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .qa-story { grid-template-columns: minmax(0, 1fr) 230px; }
}
@media (max-width: 700px) {
  .qa-opening { padding-inline: 0; }
  .qa-opening__shell { border-right: 0; border-left: 0; border-radius: 0; }
  .qa-opening__world { min-height: 650px; }
  .qa-opening__copy h1 { font-size: clamp(3.4rem, 15vw, 5.5rem); }
  .qa-opening__thread { width: min(520px, 82vw); }
  .qa-authority { padding: 42px 24px 48px; }
  .qa-capability-grid, .qa-report, .qa-story, .qa-faq, .qa-cta__inner { grid-template-columns: 1fr; }
  .qa-report__preview { order: -1; }
  .qa-story__photo { width: min(240px, 72vw); }
}
@media (max-width: 480px) {
  .qa-section { padding-inline: 16px; }
  .qa-pain-grid { grid-template-columns: 1fr; }
  .qa-capability-grid { gap: 10px; }
  .qa-frame { padding: 17px; }
  .qa-opening__world { min-height: 680px; }
  .qa-opening__copy { left: 20px; width: calc(100% - 40px); }
  .qa-opening__copy h1 { font-size: clamp(3.2rem, 15vw, 4.7rem); }
  .qa-opening__copy p { font-size: 1rem; }
  .qa-opening__next { width: 100%; }
  .qa-opening__thread { bottom: 38px; left: 20px; width: 88vw; }
  .qa-opening__character { right: 18px; bottom: 16px; }
  .qa-authority h2 { font-size: clamp(2.9rem, 14vw, 4.2rem); }
  .qa-product { padding: 14px; }
  .qa-product__controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .qa-faq__question svg { transition: none; }
  .qa-story__photo { transform: none; }
  .qa-opening__copy, .qa-product, .qa-opening__character { animation: none; }
  .qa-opening__thread path { animation: none; stroke-dashoffset: 0; }
  .qa-product__state[data-state="working"] .qa-product__mark svg,
  .qa-product__state[data-state="listening"] .qa-product__activity i { animation: none; }
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

const QUIET_DEMO_STATES = {
  idle: { title: "Homa is here", description: "Talk, type, or open the plan already waiting for you.", activity: "Waiting for you" },
  listening: { title: "Homa is listening", description: "She is making room for the thought you are working through.", activity: "Listening" },
  working: { title: "Homa is working", description: "She is shaping the next useful piece of the week.", activity: "Working" },
  ready: { title: "Your week is ready", description: "The plan is saved, with one useful next move in view.", activity: "Ready" },
} as const;

type QuietDemoState = keyof typeof QUIET_DEMO_STATES;

function QuietProductMoment() {
  const [state, setState] = useState<QuietDemoState>("idle");
  const copy = QUIET_DEMO_STATES[state];

  return (
    <article className="qa-product" aria-label="Quiet authority product moment">
      <div className="qa-product__top">
        <Logo size={19} />
        <span className="quiet-status">Saturday is ready</span>
      </div>
      <div className="qa-product__question">
        <small>Your family</small>
        <h3>What can I take off your plate?</h3>
      </div>
      <div className="qa-product__state" data-state={state}>
        <div className="qa-product__mark"><Logo size={47} variant="mark" /></div>
        <div className="qa-product__state-copy"><strong>{copy.title}</strong><span aria-live="polite">{copy.description}</span></div>
        <div className="qa-product__activity" aria-hidden="true"><i /><i /><i /><span>{copy.activity}</span></div>
      </div>
      <div className="qa-product__controls" role="group" aria-label="Preview Homa state motion">
        {(Object.keys(QUIET_DEMO_STATES) as QuietDemoState[]).map((nextState) => (
          <button className="qa-product__control" type="button" key={nextState} aria-pressed={state === nextState} onClick={() => setState(nextState)}>
            {nextState[0].toUpperCase() + nextState.slice(1)}
          </button>
        ))}
      </div>
      <div className="qa-product__next"><div><b>Three useful things for Maya today</b><span>Reading first, lighter math, and a leaf walk if everyone needs air.</span></div><i aria-hidden="true">→</i></div>
      <div className="qa-product__artifact">
        <Image src="/images/hero-butterfly-math.png" alt="A practice page made for a child's butterfly math lesson" width={1024} height={1536} sizes="70px" />
        <div><small>Real work, kept in context</small><strong>Dinosaurs became today&apos;s counting page.</strong><p>Saved with the plan, ready to print, and easy to change.</p></div>
      </div>
    </article>
  );
}

function QuietCapabilityProof({ capabilityId }: { capabilityId: CapabilityId }) {
  if (capabilityId === "plan") {
    return <div className="qa-proof"><div className="qa-proof__meta"><strong>Maya · age 4</strong><span>Tuesday · 1h 25m</span></div><div className="qa-proof__rows">{[["Butterfly math", "Done"], ["Butterfly book", "20m"], ["Science walk", "30m"]].map(([title, meta], index) => <div className="qa-proof__row" key={title}><span className="qa-proof__mark">{index === 0 ? <Icon name="check" size={16} /> : null}</span><span>{title}</span><small>{meta}</small></div>)}</div></div>;
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
          <section className="qa-opening" aria-labelledby="quiet-hero-title">
            <div className="qa-opening__shell">
              <div className="qa-opening__world">
                <Image className="qa-opening__photo" src="/images/hero-family.png" alt="A parent and child turning a learning page into a hands-on moment" fill priority sizes="(max-width: 700px) 100vw, 1240px" />
                <div className="qa-opening__copy">
                  <span className="qa-opening__kicker">The Homa feeling</span>
                  <h1 id="quiet-hero-title">Real curiosity.<br />One useful<br />next move<span>.</span></h1>
                  <p>A family&apos;s actual work leads. Homa quietly keeps the thread, brings forward what matters, and makes tomorrow feel lighter.</p>
                  <div className="qa-opening__next"><span className="qa-opening__next-mark" aria-hidden="true">→</span><div><small>One useful next move</small><strong>Print the butterfly counting page</strong></div></div>
                </div>
                <QuietThread className="qa-opening__thread" label="A coral line connecting today's work to what comes next" />
                <div className="qa-opening__character" aria-hidden="true"><Logo size={74} variant="mark" tone="dark" /></div>
              </div>
              <div className="qa-authority">
                <div className="qa-authority__copy">
                  <span className="qa-authority__kicker">Quiet authority in full</span>
                  <h2>Calm enough to trust. Curious enough to feel alive<span>.</span></h2>
                  <p>Homa should feel like a thoughtful guide with a beautiful worktable: editorial where emotion matters, crisp where decisions happen, and playful only where it makes the family&apos;s work feel lighter.</p>
                  <div className="qa-authority__actions"><TrialAction /><QuietAction kind="secondary" href="#features" icon={<Icon name="next" size={20} />}>See your week</QuietAction></div>
                  <p className="qa-opening__note">{HERO_COPY.primaryActionNote}</p>
                </div>
                <QuietProductMoment />
              </div>
            </div>
          </section>

          <section id="how" className="qa-band qa-section" aria-labelledby="quiet-how-title">
            <div className="qa-section__intro"><div className="qa-eyebrow">The work around teaching</div><h2 id="quiet-how-title">Planning and records take time.</h2><p className="qa-section__lead">Homa prepares the week, keeps the record, and leaves you with more attention for the part only you can do.</p></div>
            <div className="qa-pain-grid">{PAIN_ITEMS.map(({ id, title, body }) => { const icon = PAIN_ICONS[id]; return <QuietFrame as="article" tone="paper" className="qa-frame qa-pain-card" key={id}><span className="qa-pain-card__icon"><Icon name={icon} size={20} /></span><h3>{title}</h3><p>{body}</p></QuietFrame>; })}</div>
            <p className="qa-closing">{PAIN_CLOSING}</p>
          </section>

          <section id="features" className="qa-band qa-section" aria-labelledby="quiet-features-title">
            <div className="qa-section__intro"><div className="qa-eyebrow">One connected record</div><h2 id="quiet-features-title">Plans, pages, and proof in one place.</h2><p className="qa-section__lead">Every piece of the week stays connected, from the first idea to the page you print and the time you share.</p></div>
            <div className="qa-capability-grid">{CAPABILITY_ITEMS.map(({ id, title, body }) => <QuietFrame as="article" tone="paper" className="qa-frame qa-capability-card" key={id}><h3>{title}</h3><p>{body}</p><div className="qa-capability-card__proof"><QuietCapabilityProof capabilityId={id} /></div><div style={{ marginTop: 18 }}><QuietAction kind="quiet" href={CAPABILITY_FEATURE_HREFS[id]} icon={<Icon name="next" size={16} />}>See this feature</QuietAction></div></QuietFrame>)}</div>
          </section>

          <section id="sample-report" className="qa-band qa-section" aria-labelledby="quiet-report-title">
            <div className="qa-report"><div><div className="qa-eyebrow">{SAMPLE_REPORT_COPY.eyebrow}</div><h2 id="quiet-report-title">{SAMPLE_REPORT_COPY.headline}</h2><p className="qa-report__reassurance">{SAMPLE_REPORT_COPY.reassurance}</p><p className="qa-report__body">{SAMPLE_REPORT_COPY.body}</p><div className="qa-authority__actions"><QuietAction kind="secondary" size="large" href={SAMPLE_REPORT_COPY.href} icon={<Icon name="next" size={20} />}>{SAMPLE_REPORT_COPY.action}</QuietAction></div></div><div className="qa-report__preview"><ReportPreview /></div></div>
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
