import { useEffect, useState, type ReactNode } from "react";
import type { MobileBootstrapFailureReason } from "@homa/core";
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";

import {
  APPLE_NATIVE_PROVIDER_PRODUCTS,
  PURCHASABLE_HOMA_PLANS,
  planDefinition,
  weeklyEquivalentUsd,
  type PlanTier,
} from "../features/billing/constants";
import { useApplePurchase } from "../features/billing/use-apple-purchase";
import { useBillingGate } from "../features/billing/use-billing-gate";
import { useSession } from "../features/auth/session-provider";
import { type BillingGateState } from "../lib/billing";
import { getMyChildren, type ChildRecord } from "../lib/family";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { LoadingStatus } from "./ui/loading-status";

function joinNatural(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The paywall's own line, not the door's: a family who just finished
 * onboarding already has a real page and real answers on file when she
 * hits this screen (gh#1009's fix stopped the door from promising free
 * access; this is the other half, the effort-moat gap the same session
 * found: the paywall itself never mentioned what she just made). Only
 * fires for a genuinely new, unwalled-by-lapse family with a child on
 * file; a lapsed return or a childless account keeps the plain line.
 */
function firstPageLine(kids: ChildRecord[] | null, lapsed: boolean): string | null {
  if (lapsed || !kids || kids.length === 0) return null;
  // "their", never "her": no pronoun is stored on a child record, and
  // the house law is the parent's own words or singular "they", never a
  // guess from the name.
  const names = joinNatural(kids.map((kid) => kid.name));
  return `${names}'s first page is already in their Binder. Subscribing keeps Homa making their pages, planning their weeks, and tracking their progress.`;
}

/**
 * The mobile twin of familyAccountGate() on the web: blocks every tab
 * until the family is entitled, the same way AiConsentGate blocks Chat
 * until consent is recorded (component shape, not billing logic). An
 * open family never mounts the paywall at all; a walled family never
 * sees Today, Chat, or Family underneath it.
 */
export function BillingGate({
  children,
  familyId,
}: {
  children: ReactNode;
  familyId: string;
}) {
  const { gate, checked, failureReason, refresh } = useBillingGate();
  const { continueSignedOut } = useSession();

  return (
    <StoreKitBillingBoundary
      familyId={familyId}
      checked={checked}
      gate={gate}
      failureReason={failureReason}
      onUnlocked={refresh}
      onContinueSignedOut={continueSignedOut}
    >
      {children}
    </StoreKitBillingBoundary>
  );
}

/** checked is true but gate is still null: the check itself failed
 *  (offline, signed out, server error, or the endpoint unreachable),
 *  not "still loading". Distinct from the paywall on purpose: this
 *  family's entitlement is simply unknown, never assumed walled. */
function GateCheckFailed({
  failureReason,
  onRetry,
  onContinueSignedOut,
}: {
  failureReason: MobileBootstrapFailureReason | null;
  onRetry: () => Promise<void>;
  onContinueSignedOut: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: space.lg,
          justifyContent: "center",
          gap: space.lg,
        }}
      >
        <Card style={{ gap: space.md }}>
          <Text
            style={{ fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong }}
          >
            {"Couldn't check your account"}
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            {failureReason === "expired_session"
              ? "Your sign-in has expired. Sign in again before Homa checks your plan."
              : "That did not load. Check your connection and try again."}
          </Text>
          <Button
            label={retrying ? "Trying again…" : "Try again"}
            onPress={() => void handleRetry()}
            disabled={retrying}
          />
          {failureReason === "expired_session" ? (
            <Button
              label="Continue to sign in"
              variant="secondary"
              onPress={onContinueSignedOut}
              disabled={retrying}
            />
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function StoreKitBillingBoundary({
  children,
  familyId,
  checked,
  gate,
  failureReason,
  onUnlocked,
  onContinueSignedOut,
}: {
  children: ReactNode;
  familyId: string;
  checked: boolean;
  gate: BillingGateState | null;
  failureReason: MobileBootstrapFailureReason | null;
  onUnlocked: () => Promise<void>;
  onContinueSignedOut: () => void;
}) {
  const [myChildren, setMyChildren] = useState<ChildRecord[] | null>(null);
  const [tier, setTier] = useState<PlanTier>("regular");
  const router = useRouter();
  const pathname = usePathname();

  // The whole purchase machine (interlock, recovery, finish journal)
  // lives in the shared engine; this boundary only renders the wall.
  const {
    connected,
    subscriptions,
    productsChecked,
    reloadProducts,
    step,
    unlockFailed,
    errorMessage,
    buy,
    restore,
  } = useApplePurchase({
    familyId,
    fetchWhen: checked && gate !== null && !gate.open,
    onEntitled: onUnlocked,
  });

  useEffect(() => {
    if (!checked || !gate || gate.open || gate.lapsed) return;
    let cancelled = false;
    void getMyChildren(familyId)
      .then((kids) => {
        if (!cancelled) setMyChildren(kids);
      })
      .catch(() => {
        if (!cancelled) setMyChildren([]);
      });
    return () => {
      cancelled = true;
    };
  }, [checked, familyId, gate]);

  // The wall merchandises the monthly term; the walk's paywall owns the
  // annual-default presentation (D3). Explicit period match, because the
  // native catalog now carries both periods.
  const selectedProviderProduct = APPLE_NATIVE_PROVIDER_PRODUCTS.find(
    (product) => product.tier === tier && product.period === "monthly",
  );
  const product = subscriptions.find((item) => item.id === selectedProviderProduct?.productId);
  const selectedPlan = planDefinition(tier);
  const displayPrice = product?.displayPrice ?? null;
  const weeklyEquivalent = weeklyEquivalentUsd(tier, "monthly").toFixed(2);

  async function handleBuy() {
    if (!selectedProviderProduct) return;
    await buy(selectedProviderProduct.productId);
  }

  async function handleRestore() {
    await restore();
  }

  if (!checked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <LoadingStatus label="Checking your Homa plan" />
      </View>
    );
  }

  if (gate === null) {
    return (
      <GateCheckFailed
        failureReason={failureReason}
        onRetry={onUnlocked}
        onContinueSignedOut={onContinueSignedOut}
      />
    );
  }

  if (gate.open) return <>{children}</>;

  // The kept state (D5, ruled 2026-08-31): pages a family made are
  // theirs to keep, viewable and printable forever, so the Binder stays
  // readable behind the wall. Nothing new can be made from there (its
  // one create affordance routes to /chat, which this same gate walls
  // the moment the path changes), and every other screen keeps the
  // paywall one tap away. Route-scoped, re-evaluated on navigation.
  if (pathname === "/binder") return <>{children}</>;

  const productsUnavailable = connected && productsChecked && subscriptions.length === 0;
  const busy = step !== "idle";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: space.lg,
          justifyContent: "center",
          gap: space.lg,
        }}
      >
        <Card style={{ gap: space.md }}>
          <Text
            style={{ fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong }}
          >
            {gate.lapsed ? "Continue with Homa" : "Start with Homa"}
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            {firstPageLine(myChildren, gate.lapsed) ??
              "Weekly plans, practice pages, progress reports, and teaching-hour records."}
          </Text>

          {unlockFailed ? (
            <Text
              style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}
            >
              {
                "Your payment went through, but we couldn't unlock your account yet. This usually sorts itself out within a minute. Try closing and reopening the app. If it's still stuck, contact us and we'll fix it."
              }
            </Text>
          ) : null}

          {errorMessage ? (
            <Text
              style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}
            >
              {errorMessage}
            </Text>
          ) : null}

          {productsUnavailable ? (
            <View style={{ gap: space.sm }}>
              <Text
                style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}
              >
                {"We can't reach the App Store right now. Check your connection and try again in a moment."}
              </Text>
              <Button
                label="Try again"
                variant="secondary"
                onPress={reloadProducts}
              />
            </View>
          ) : !product ? (
            <View style={{ gap: space.md }}>
              {/* A picker with one option reads as a fake choice
                  (found by the copy-reviewer gate, 2026-08-25); only
                  show it once there is a real second plan to pick. */}
              {PURCHASABLE_HOMA_PLANS.length > 1 ? (
                <PlanPicker tier={tier} onChange={setTier} />
              ) : null}
              <LoadingStatus label="Loading App Store plans" style={{ marginVertical: space.sm }} />
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              {PURCHASABLE_HOMA_PLANS.length > 1 ? (
                <PlanPicker tier={tier} onChange={setTier} />
              ) : null}
              <View
                style={{
                  gap: space.xs,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: space.md,
                }}
              >
                <Text
                  style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.lg, color: colors.textStrong }}
                >
                  {selectedPlan.name}
                </Text>
                <Text
                  style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
                >
                  {`${displayPrice} a month`}
                </Text>
                <Text
                  style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}
                >
                  {`About $${weeklyEquivalent} a week, billed monthly.`}
                </Text>
              </View>
              <Button
                label={
                  step === "purchasing" || step === "confirming"
                    ? "One moment…"
                    : `Subscribe for ${displayPrice} a month`
                }
                onPress={() => void handleBuy()}
                disabled={busy || !familyId}
              />
              <Text
                style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}
              >
                Billed monthly through your Apple Account. Cancel in your Apple Account subscription settings.
              </Text>
            </View>
          )}

          <Button
            label={step === "restoring" ? "Restoring…" : "Restore purchases"}
            variant="ghost"
            onPress={() => void handleRestore()}
            disabled={busy}
          />
          {/* "Open Homa settings" read as a stray door out of the
              subscribe decision (copy-reviewer gate, 2026-08-25): a
              walled family reaches this screen to sign out or delete
              their account (settings.tsx's own comment), never to
              browse settings, so the label says which. */}
          <Button
            label="Sign out or delete account"
            variant="ghost"
            onPress={() => router.push("/settings")}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanPicker({ tier, onChange }: { tier: PlanTier; onChange: (tier: PlanTier) => void }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.4;
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: stacked ? "column" : "row", gap: space.xs }}>
      {PURCHASABLE_HOMA_PLANS.map((plan) => {
        const selected = plan.tier === tier;
        return (
          <Pressable
            key={plan.tier}
            accessibilityRole="radio"
            accessibilityLabel={`${plan.name} plan`}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(plan.tier)}
            style={{
              flex: stacked ? undefined : 1,
              minHeight: 44,
              borderRadius: 999,
              paddingVertical: space.sm,
              paddingHorizontal: space.xs,
              alignItems: "center",
              backgroundColor: selected ? colors.brandHover : colors.page,
              borderWidth: selected ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.sm,
                color: selected ? colors.onBrand : colors.textStrong,
              }}
            >
              {plan.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
