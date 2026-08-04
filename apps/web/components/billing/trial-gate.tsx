"use client";

import Image from "next/image";
import { useEffect, useSyncExternalStore } from "react";

import type { WallCheckout } from "../../lib/billing/wall-types";
import { Icon } from "../design/Icon";
import { sendWallBeacon } from "./wall-beacon";
import { TierOptions } from "./tier-options";
import {
  TRIAL_GATE_ACCOUNT_READY,
  TRIAL_GATE_AGE_RANGE,
  TRIAL_GATE_ARTIFACT_CAPTION,
  TRIAL_GATE_EVERY_PLAN_HEADING,
  TRIAL_GATE_WHAT_IT_IS,
  TRIAL_GATE_CHARGE_NOTE,
  TRIAL_GATE_EVERY_PLAN,
  TRIAL_GATE_HEADLINE,
  TRIAL_GATE_LAPSED_REASSURANCE,
  TRIAL_GATE_MAKERS_LINE,
  TRIAL_GATE_MANAGE_BILLING,
  TRIAL_GATE_METHOD_LINK,
  TRIAL_GATE_REASSURANCE,
  TRIAL_GATE_SAMPLE_LINK,
  TRIAL_GATE_SAVED_LINE,
  trialChargeNoteDated,
  trialDatesFromNow,
} from "./wall-copy";

/**
 * The signup trial gate's body (/onboarding/trial, founder directive
 * 2026-07-26; rebuilt 2026-07-28). A full page rather than a modal:
 * there is no product behind it to dismiss back into, so a dialog's
 * "Not now" would be a door painted on a wall. The honest way out is
 * named in TRIAL_GATE_SAVED_LINE instead (offers never commands:
 * leaving costs nothing and the page says so).
 *
 * The 2026-07-28 rebuild, and the measurements behind it. The first
 * version led with an eyebrow, a headline, a two-sentence reassurance,
 * a three-card "Today / Day 4 / Day 7" timeline, and a 24-word list of
 * everything the trial included, and only then reached the prices. On a
 * 390px phone that put the first price 1.1 screenfuls down behind 149
 * words, with none of the three prices visible in the first screenful
 * and three competing buttons once you got there. A teardown of 17
 * shipping pricing pages put the median distance from the top of a
 * phone screen to the first price at 12 words, with a practical ceiling
 * around 15: every page under it landed a price in the first screenful,
 * every page over it did not.
 *
 * So the order inverted, and the page is now built as a control panel
 * rather than a document. Headline, one line that answers the only
 * question that stops a scan this early, then the prices. Everything
 * that was above the picker and is still true moved below it, in the
 * order a scan actually wants it: what this costs after the trial
 * (under the button, where the decision is made), then the mechanics,
 * then what every plan holds, then the proof, then the way out. Nothing
 * was deleted for being long; each thing was moved to where it is read
 * or dropped for being said twice.
 *
 * Why the trial timeline is a sentence now and not three cards. The
 * three beats were right (they came from the card-upfront pattern where
 * naming the reminder-before-charge promise is what earns the card), but
 * they cost a full screenful of chrome to deliver 40 words, and the
 * parent has already been told the same terms once: the landing CTA
 * carries "7 free days, then plans from $19 a month. Cancel anytime."
 * before she ever clicks. TRIAL_GATE_CHARGE_NOTE keeps all three facts
 * in one sentence directly under the button, which is where a pricing
 * scan ends.
 *
 * What is deliberately NOT here: testimonials, ratings, and any
 * customer count. On the day this shipped Homa had no paying families,
 * so every one of those would have to be invented (ruling C2). The
 * proof row under the picker points at things that are real instead: a
 * sample report she can read before paying, the method behind it, and
 * the two homeschooling mothers who built it.
 *
 * Analytics: one wall_viewed beacon (door "signup") plus the per-card
 * funnel step ("paywall"), both fire-and-forget on mount, so the
 * founder console can see account-created -> gate-viewed ->
 * checkout_started -> trial_started as one ladder.
 */
/** The trial dates never change while the page is open, so the store
 *  has nothing to publish and the snapshot is computed once. Both are
 *  module scope so their identity is stable across renders, which is
 *  what useSyncExternalStore requires of a snapshot. */
const subscribeToNothing = () => () => {};
let cachedTrialDates: { remindOn: string; chargeOn: string } | null = null;
const clientTrialDates = () => (cachedTrialDates ??= trialDatesFromNow(new Date()));
const serverTrialDates = () => null;

export function TrialGate({
  checkout,
  lapsed,
  portalAvailable,
}: {
  checkout: WallCheckout;
  /** True when this family had a trial or subscription that ended:
   *  the first line welcomes her back instead of greeting a stranger. */
  lapsed: boolean;
  /** True when a Stripe billing relationship exists, so the gate can
   *  offer the self-serve portal (fix a card, restart the old plan). */
  portalAvailable: boolean;
}) {
  // The charge dates come from HER clock, not the server's. FamilyRow
  // carries no time zone, so a server-rendered date can be a day wrong,
  // and a wrong date on a charge promise is worse than a relative one.
  //
  // useSyncExternalStore rather than an effect: the server snapshot is
  // null, so the first paint matches on both sides of hydration, and
  // React swaps in the client value without a second render pass. The
  // client snapshot has to be referentially stable or React re-reads it
  // forever, which is what CLIENT_TRIAL_DATES caches.
  const dates = useSyncExternalStore(subscribeToNothing, clientTrialDates, serverTrialDates);

  useEffect(() => {
    sendWallBeacon({ kind: "wall_viewed", door: "signup" });
    void fetch("/api/map/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "paywall" }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return (
    <div className="quiet-paywall__content quiet-paywall__gate" data-brand-layer="trial-gate">
      {/* text-balance so the headline never leaves "days" alone on a
          second line at phone width. */}
      <h1 className="quiet-paywall__gate-headline">
        {TRIAL_GATE_HEADLINE}
      </h1>
      {/* One line, and the last words before the prices. A returning
          family gets her own greeting here instead, because a gate that
          greets her as a stranger reads as a bug. */}
      {/* What Homa IS, before what she costs. The first rebuild put a
          price in the first screenful in ten words and then failed a
          ten-parent comprehension check ten times out of ten: every
          persona recalled the numbers, none could say what they bought,
          and two named exactly that as the reason they would not
          proceed. This sentence breaks the word budget that produced
          that result, which is the correct trade. */}
      <p className="quiet-paywall__gate-identity">{TRIAL_GATE_WHAT_IT_IS}</p>
      {/* Five of ten personas named this the most persuasive sentence
          on the page, and it was in small grey type below the fold,
          styled like a legal footnote. It is the only trust signal
          available to a product with no customers to quote. */}
      <p className="quiet-paywall__gate-makers">
        {lapsed ? `${TRIAL_GATE_LAPSED_REASSURANCE} ` : ""}
        {TRIAL_GATE_MAKERS_LINE}
      </p>

      {/* The last words before the prices, and the one sentence that
          has to survive every future edit of this page.
          It was dropped by accident when the identity sentence went in
          above it, and the review panel's comprehension score on "am I
          charged today" went from ten of ten correct to zero of ten in
          one round. It is four words. Nothing else on the page answers
          that question this early, and the whole card-upfront gate
          turns on it. */}
      <p className="quiet-paywall__gate-reassurance">{TRIAL_GATE_REASSURANCE}</p>

      <TierOptions door="signup" checkout={checkout} />

      {/* Body weight, not muted fine print, and directly under the
          control that consents to the charge. Nine of ten personas
          named this the strongest sentence on the page and several
          said it was styled like a disclaimer. It is also the legally
          load-bearing one: ROSCA (15 U.S.C. 8403) requires material
          terms clearly and conspicuously BEFORE billing information is
          collected, and California's ARL as amended by AB 2863 requires
          the auto-renewal terms in visual proximity to the request for
          consent. Do not shrink it, grey it, or move it into an
          accordion. Do not reword it either: the exact sentence tested
          best. */}
      <p className="quiet-paywall__gate-charge-note">
        {dates
          ? trialChargeNoteDated(dates.remindOn, dates.chargeOn)
          : TRIAL_GATE_CHARGE_NOTE}
      </p>

      <hr className="quiet-paywall__rule" />

      <h2 className="quiet-paywall__section-heading">
        {lapsed ? TRIAL_GATE_ACCOUNT_READY : TRIAL_GATE_EVERY_PLAN_HEADING}
      </h2>
      {/* A list, not the 60-word paragraph it was: five of ten personas
          said they skipped every word of that block, and it is the only
          place the page says what is included. */}
      <ul className="quiet-paywall__included">
        {TRIAL_GATE_EVERY_PLAN.map((line) => (
          <li key={line} className="quiet-paywall__included-item">
            <Icon name="check" size={16} className="quiet-paywall__included-icon" />
            {line}
          </li>
        ))}
      </ul>
      {/* The one age fact this page can verify in code (bands.ts), for
          the parent of an older child asking whether Homa reaches him.
          The sample below is a counting page for a five-year-old, and
          three personas with older children read it as evidence that
          Homa is for little ones. */}
      <p className="quiet-paywall__gate-age">{TRIAL_GATE_AGE_RANGE}</p>

      {/* The honest proof, below the CTA where it costs the fold
          nothing: a real practice page Homa made, not a description of
          one. Five personas would have left over never seeing the
          product, and a text link asking them to leave this page at
          9:40pm is not an answer. Testimonials would be the usual
          filler here and there are none to quote, so the artifact does
          that job instead. */}
      <figure className="quiet-paywall__artifact">
        <div className="quiet-paywall__artifact-frame">
          <Image
            src="/images/hero-butterfly-math.png"
            alt="A Homa practice page titled Butterfly math, asking a child to count each butterfly and caterpillar and color one box for each."
            width={1024}
            height={1536}
            sizes="(max-width: 640px) 100vw, 34rem"
            className="h-56 w-full object-cover object-top"
          />
        </div>
        <figcaption className="quiet-paywall__artifact-caption">
          {TRIAL_GATE_ARTIFACT_CAPTION}
        </figcaption>
      </figure>

      {/* Body size, not the smallest type on the page. Five personas
          named these two links as the only things they actually wanted
          and the hardest things to see. They stay text links rather
          than buttons so they never compete with the CTA. */}
      <p className="quiet-paywall__proof-links">
        <a
          // clay-700, not the brand clay: brand clay on the warm page
          // background measures 3.01:1, under the 4.5:1 WCAG AA floor
          // for text this size.
          className="quiet-paywall__proof-link"
          href="/onboarding/sample"
        >
          {TRIAL_GATE_SAMPLE_LINK}
        </a>
        {" · "}
        <a
          className="quiet-paywall__proof-link"
          href="/onboarding/method"
        >
          {TRIAL_GATE_METHOD_LINK}
        </a>
      </p>

      {/* The way out, kept but demoted out of the closing position.
          Three personas read it last and took it, and all three called
          it kind: the last thing on a page is an emotional beat, and
          this one gave permission to leave at the exact moment they
          were wobbling. The fact stays true and stated (offers never
          commands); it just is not the final word. */}
      <p className="quiet-paywall__way-out">
        {TRIAL_GATE_SAVED_LINE}
        {lapsed && portalAvailable ? (
          <>
            {" "}
            <a
              href="/api/billing/portal"
              className="quiet-paywall__portal-link"
            >
              {TRIAL_GATE_MANAGE_BILLING}
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}
