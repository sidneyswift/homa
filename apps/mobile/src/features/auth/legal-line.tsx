import { Pressable, View } from "react-native";

import { NativeText } from "../../components/ui/semantic";
import { openPrivacyPolicy, openTermsOfUse } from "../../lib/web-links";
import { quietColors } from "../../theme/native-projection";

/**
 * The one line on the entry screens where charm is withheld on purpose.
 * It is the only place that informs without first reassuring, which is
 * why it is last and quietest. Legal copy trying to be funny is the
 * fastest way to make a parent stop trusting the sentence above it.
 *
 * Six of ten comparable iOS auth screens carry this line adjacent to the
 * actions. Homa carried none anywhere, which is also an App Review
 * expectation, not only a norm.
 *
 * Both documents are named and both are reachable. openPrivacyPolicy
 * already existed and was going unused while the terms page was left to
 * link onward on the parent's behalf.
 *
 * Construction note. hitSlop is inert on a nested Text, which has no view
 * of its own, but these are real Pressables where it works. Reaching for
 * minHeight instead was a mistake worth recording: it bought the target
 * by adding 26pt of layout height between the two rows, so one sentence
 * rendered as two detached blocks, and it still left "terms" about 39pt
 * wide, under the contract's 44pt floor, because minHeight only fixes one
 * axis. hitSlop grows the target without touching layout, so the rows sit
 * one line apart and both axes clear 44.
 *
 * The leading run keeps width 100%: it forces the sentence onto its own
 * row so the line wraps between words rather than ragging at run
 * boundaries. That part was never the problem.
 */
/** 18pt caption line plus 14 each side clears the 44pt floor vertically,
 *  and 8 each side carries the short "terms" run over it horizontally. */
const LINK_HIT_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };
/** App 2's entry screens center the line and link in ink, not brand rust (gh#1236). */
export function LegalLine({
  align = "start",
  linkColor = quietColors.brandText,
}: { align?: "start" | "center"; linkColor?: string } = {}) {
  return (
    <View
      style={{
        marginTop: 8,
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : "flex-start",
      }}
    >
      <NativeText role="caption" tone="muted" style={{ width: "100%", textAlign: align === "center" ? "center" : "left" }}>
        By continuing, you agree to our
      </NativeText>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Terms of use"
        accessibilityHint="Opens Homa's terms in your browser"
        onPress={() => void openTermsOfUse()}
        hitSlop={LINK_HIT_SLOP}
        style={{ paddingRight: 4 }}
      >
        <NativeText
          role="caption"
          style={{
            color: linkColor,
            textDecorationLine: "underline",
          }}
        >
          terms
        </NativeText>
      </Pressable>

      <NativeText role="caption" tone="muted">
        and
      </NativeText>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Privacy policy"
        accessibilityHint="Opens Homa's privacy policy in your browser"
        onPress={() => void openPrivacyPolicy()}
        hitSlop={LINK_HIT_SLOP}
        style={{ paddingLeft: 4 }}
      >
        <NativeText
          role="caption"
          style={{
            color: linkColor,
            textDecorationLine: "underline",
          }}
        >
          privacy policy.
        </NativeText>
      </Pressable>
    </View>
  );
}
