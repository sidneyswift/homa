import { extractBearerToken, localDev, vercelOidc, type AuthFn } from "eve/channels/auth";
import { defaultEveAuth, eveChannel } from "eve/channels/eve";
import { createClient } from "@supabase/supabase-js";

import { familyAccountGate } from "../../lib/billing/wall";
import {
  canonicalInboundAuthAttributes,
} from "../../lib/conversation-continuity/canonical-inbound";
import {
  loadRecentContinuityForMember,
  resolveInboundContinuity,
  resolvedContinuityAttributes,
} from "../../lib/conversation-continuity/ledger";
import {
  EVAL_FIXTURE_SESSION_ATTRIBUTE,
  evalFamilyFixtureAuth,
} from "../../lib/family-context-eval-fixture";
import {
  familyOnboardingActive,
  onboardingRowFromMembership,
} from "../../lib/onboarding/state";
import { readViewContextCookie, VIEW_CONTEXT_FAMILY } from "../../lib/view-context";
import {
  messageModalityFromRequest,
  voiceTranscriptionContext,
} from "../../lib/web-message-modality";
import {
  trustedVoiceBridgeRequest,
  voiceBridgeMessageMatches,
} from "../../lib/voice/voice-bridge-auth";

/**
 * Route auth for the eve channel (minimal M1-01 slice of FR-1).
 *
 * The chat UI sends the caller's Supabase access token as a bearer header
 * (resolved fresh per request by useEveAgent, so browser-side auto-refresh
 * keeps it valid). This AuthFn verifies the token against Supabase Auth,
 * resolves the caller's family under their OWN RLS context, and stamps the
 * principal eve carries through the whole durable session:
 *
 *   principalId          the Supabase user id
 *   attributes.channel   "web", from this authenticated web entry point
 *   attributes.familyId  from family_members, under the caller's RLS
 *   attributes.supabaseAccessToken  the raw JWT, for tools to query the DB
 *                        as the caller (RLS stays the tenancy wall inside
 *                        tools too, per BUILD.md law #1)
 *
 * The token in attributes is server-custody session state, never shown to
 * the model. It is re-verified on every inbound request (this walk runs
 * again), but it is a SNAPSHOT: a long turn can outlive it, since the
 * browser cannot push a refreshed token into a turn already running.
 * lib/agent-db.ts owns that boundary: an expired snapshot degrades the
 * turn to the family-pinned path behind a live membership re-check (the
 * Llanes JWT-expired incident, 2026-07-17). The proper per-request
 * re-scoping pattern (M1-02, SET LOCAL) replaces this at
 * walking-skeleton time.
 *
 * Walk order: our Supabase auth first, then vercelOidc() (Vercel-internal
 * callers such as subagents), then localDev() (local eve dev tooling).
 * Tools that need a family refuse to act when attributes.familyId is
 * absent, which covers both fallback principals.
 *
 * The one exception to that refusal is sandboxed eval runs: localDev()
 * is wrapped in evalFamilyFixtureAuth, which stamps local-dev eval
 * sessions as family-pinned on the seeded Walker fixture family, but
 * only while `pnpm eval:sandbox` provides the disposable database
 * (lib/family-context-eval-fixture.ts owns the gate; it is inert on
 * Vercel and under HOMA_EVAL_ALLOW_PROD_WRITES). Requests that a real
 * authenticator accepts never reach the wrapped entry, so a production
 * principal can never be re-pinned by it.
 */
function supabaseAuth(): AuthFn<Request> {
  return async (request) => {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) return null; // not ours; fall through the walk

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error } = await supabase.auth.getUser(token);
    if (error || !userData.user) return null;

    // The caller's OWN membership row (user_id filter matters since
    // migration #49 let members read the whole family roster). The
    // embedded family rides the same round trip: chat-first onboarding
    // needs two of its columns on every turn, and a second query here
    // would land on the cold path the pre-warmed welcome exists to hide.
    //
    // Live families only, newest membership first. This used to be a bare
    // limit(1) with no order and no status filter, which is correct only
    // while an account has exactly one membership row and silently picks
    // an arbitrary one the moment it has two. An account that had its
    // family deleted and was re-attached has two, and the row Postgres
    // handed back was the DELETED family: every turn then read and wrote
    // a retired household while the page rendered the live one, with
    // nothing anywhere reporting a mismatch. The `!inner` matters, since
    // a filter on a plain embed narrows the embed rather than the parent.
    const { data: membership, error: membershipError } = await supabase
      .from("family_members")
      .select(
        "family_id, display_name, created_at, families!inner(profile_completed_at, context, status)",
      )
      .eq("user_id", userData.user.id)
      .neq("families.status", "deleted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (membershipError) {
      console.error(
        "eve channel: membership lookup failed:",
        membershipError.message,
      );
      return null;
    }

    // The mobile client sends this header on every eve request (never the
    // web chat client), so it is a deliberate signal, not sniffed: never
    // defaults to "mobile" on an absent or unrecognized value. Exists
    // solely to scope the onboarding gate exemption below to mobile
    // (gh#305, "phone app only" founder ruling 2026-07-28); every other
    // reader of attributes.channel still only sees "web" today.
    const channel = request.headers.get("x-homa-channel") === "mobile" ? "mobile" : "web";

    // attributes only admits string values; absent facts are omitted keys.
    const attributes: Record<string, string> = {
      channel,
      messageModality: messageModalityFromRequest(request),
      supabaseAccessToken: token,
    };
    const voiceBridge = trustedVoiceBridgeRequest(request, {
      accessToken: token,
    });
    if (voiceBridge) {
      attributes.voiceBridge = "true";
      attributes.voiceBridgeMessageId = voiceBridge.messageId;
      attributes.voiceBridgeMessageSha256 = voiceBridge.messageSha256;
      if (voiceBridge.activeObjectContext) {
        attributes.voiceBridgeActiveObjectContext = voiceBridge.activeObjectContext;
      }
    }
    if (membership?.family_id) attributes.familyId = membership.family_id;
    attributes.memberUserId = userData.user.id;
    // Chat-first onboarding is a state of the FAMILY, not of a page
    // (plans/2026-07-21-chat-first-onboarding.md §2.2). Stamping it here
    // means the mode follows her: abandon /onboarding on the phone,
    // open /app on a laptop three days later, and the same conversation
    // picks up from what the family record says, across refreshes,
    // devices, and the 4am session rotation. Derived from database
    // truth, so the client is never asked and never trusted.
    if (familyOnboardingActive(onboardingRowFromMembership(membership))) {
      attributes.onboardingActive = "true";
    }
    if (membership?.display_name) attributes.memberName = membership.display_name;
    if (userData.user.email) attributes.email = userData.user.email;

    // The context switcher's selection rides the same-origin request as a
    // cookie. It is a UI HINT, not an auth fact: family-context validates
    // it against the family's own children before the model ever hears a
    // name, so a stale or forged id simply drops (tenancy law).
    const viewContext = readViewContextCookie(request.headers.get("cookie"));
    if (viewContext && viewContext !== VIEW_CONTEXT_FAMILY) {
      attributes.viewChildId = viewContext;
    }

    return {
      authenticator: "app",
      principalId: userData.user.id,
      principalType: "user" as const,
      attributes,
    };
  };
}

export default eveChannel({
  auth: [supabaseAuth(), vercelOidc(), evalFamilyFixtureAuth(localDev())],
  async onMessage(ctx, message) {
    const auth = defaultEveAuth(ctx);
    if (!auth) return { auth };

    // Sandboxed eval sessions skip continuity on purpose: they all
    // authenticate as the same local-dev principal, so the ledger would
    // stitch unrelated evals into one episode and feed one eval's
    // messages into the next one's context.
    if (auth.attributes[EVAL_FIXTURE_SESSION_ATTRIBUTE] === "true") {
      return { auth };
    }

    const familyId = auth.attributes.familyId;
    const memberUserId = auth.attributes.memberUserId;
    const modalityContext = voiceTranscriptionContext(
      auth.attributes.messageModality === "voice" ? "voice" : "text",
    );
    const text =
      typeof message === "string"
        ? message
        : message
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n");
    if (auth.attributes.voiceBridge === "true") {
      const messageId = auth.attributes.voiceBridgeMessageId;
      const expectedSha256 = auth.attributes.voiceBridgeMessageSha256;
      if (
        typeof messageId === "string" &&
        typeof expectedSha256 === "string" &&
        voiceBridgeMessageMatches(text, expectedSha256)
      ) {
        Object.assign(
          auth.attributes,
          canonicalInboundAuthAttributes({ text, messageId }),
        );
      } else {
        const mutableAttributes = auth.attributes as Record<string, unknown>;
        delete mutableAttributes.voiceBridge;
        delete mutableAttributes.voiceBridgeMessageId;
        delete mutableAttributes.voiceBridgeMessageSha256;
        delete mutableAttributes.voiceBridgeActiveObjectContext;
      }
    }
    if (typeof familyId !== "string" || text.trim().length === 0) {
      return { auth };
    }

    // The signup paywall holds at TURN admission, not just page render
    // (founder directive 2026-07-26): proxy.ts never sees this channel,
    // and the mobile app mounts it directly, so a page-only gate would
    // hand walled and lapsed families the whole toolbox through here
    // (the dc4ab64b bypass class). Denial is deterministic: familyId is
    // withheld from the session, so every family tool refuses and no
    // family context loads; the note below only shapes how Homa says
    // it. familyAccountGate fails open on read errors and is a no-op
    // while HOMA_SIGNUP_PAYWALL_ENABLED is dark.
    const accountGate = await familyAccountGate(familyId);
    // Mobile-only exemption (gh#305, founder ruling 2026-07-28, "phone
    // app only"): a walled family still mid-onboarding on the iOS app
    // keeps the conversation, so the paywall arrives after she has met
    // Homa, not before. Web is deliberately untouched: attributes.channel
    // only ever reads "mobile" when the request carried the header only
    // the mobile client sends (supabaseAuth() above), so this branch is
    // unreachable from the website regardless of onboardingActive.
    const mobileOnboardingExempt =
      auth.attributes.channel === "mobile" && auth.attributes.onboardingActive === "true";
    if (accountGate.checkout && !mobileOnboardingExempt) {
      const attributes: Record<string, string> = {
        ...auth.attributes,
        accountWalled: "true",
      };
      delete attributes.familyId;
      return {
        auth: {
          ...auth,
          attributes,
        },
        context: [
          ...modalityContext,
          [
            "## Account gate",
            "",
            "This account's 7 free days have not started, or the",
            "subscription that opened them has ended, so no family",
            "context is loaded and family tools are unavailable this",
            "turn. Answer warmly, and point the way in plainly: her",
            "account setup continues at thankshoma.com/onboarding,",
            "and everything she has saved is waiting there. Do not",
            "describe pricing, trial mechanics, or billing terms;",
            "that page is where those live. Do not attempt family",
            "tools.",
          ].join("\n"),
        ],
      };
    }

    // The native realtime transcript already owns canonical persistence and
    // reply resolution. This inner agent turn is a private execution detail,
    // so it may read recent continuity but must never bind a second thread,
    // claim the same reply twice, or create a duplicate episode.
    if (auth.attributes.voiceBridge === "true") {
      try {
        const continuityContext = await loadRecentContinuityForMember({
          familyId,
          memberUserId:
            typeof memberUserId === "string" ? memberUserId : null,
        });
        return {
          auth,
          context: [
            ...modalityContext,
            ...(typeof auth.attributes.voiceBridgeActiveObjectContext === "string"
              ? [auth.attributes.voiceBridgeActiveObjectContext]
              : []),
            ...(continuityContext ? [continuityContext] : []),
          ],
        };
      } catch (error) {
        console.error(
          "eve channel: voice bridge continuity read failed:",
          error instanceof Error ? error.message : "unknown",
        );
        return {
          auth,
          context: [
            ...modalityContext,
            ...(typeof auth.attributes.voiceBridgeActiveObjectContext === "string"
              ? [auth.attributes.voiceBridgeActiveObjectContext]
              : []),
          ],
        };
      }
    }

    try {
      const continuity = await resolveInboundContinuity({
        familyId,
        memberUserId:
          typeof memberUserId === "string" ? memberUserId : null,
        channel: "web",
        transportThreadKey: `web:${auth.principalId}`,
        runtimeSessionId: ctx.eve.sessionId ?? null,
        providerMessageId: null,
        providerReplyTo: null,
        destinationKey: auth.principalId,
        text,
      });
      const continuityAttributes = resolvedContinuityAttributes(continuity, {
        memberUserId:
          typeof memberUserId === "string" ? memberUserId : null,
        providerMessageId: null,
      });
      return {
        auth: {
          ...auth,
          attributes: {
            ...auth.attributes,
            ...continuityAttributes,
          },
        },
        context: [
          ...modalityContext,
          ...(continuity.contextMarkdown
            ? [continuity.contextMarkdown]
            : []),
        ],
      };
    } catch (error) {
      console.error(
        "eve channel: continuity resolution failed:",
        error instanceof Error ? error.message : "unknown",
      );
      return { auth, context: modalityContext };
    }
  },
});
