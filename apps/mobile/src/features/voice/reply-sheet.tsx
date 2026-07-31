import { useRef } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, shadows, space } from "../../theme/tokens";
import { MarkdownText } from "../chat/markdown-text";

/**
 * The full last reply, on demand: tapping the ribbon's whisper line
 * opens this small sheet with Homa's complete answer rendered the way
 * chat renders it (markdown-text.tsx), scrollable. Deliberately LOCAL
 * to the voice screen (plain state, not the overlay model): a tool
 * overlay arriving while this is open wins, and the screen closes this
 * sheet in its favor.
 *
 * The chassis values mirror overlay-host.tsx's sheet exactly (warm
 * scrim, rounded top, 65% height, grab handle, scrim tap or handle
 * swipe-down to dismiss) so the two sheets read as one family. Not
 * shared code on purpose: overlay-host belongs to the overlay layer and
 * carries its float puck; this stays a leaf.
 */

const SCRIM_COLOR = "rgba(51,42,33,0.42)";
/** Swipe-down travel on the grab handle that reads as "close". */
const DISMISS_DRAG_PX = 48;

export function ReplySheet({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  // Same responder-props swipe as overlay-host (no PanResponder; its
  // create-with-closures shape trips the react-hooks/refs rule).
  const dragStartY = useRef<number | null>(null);

  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? "fade" : "slide"}
      onRequestClose={onDismiss}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: SCRIM_COLOR,
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          accessibilityLabel="The full reply"
          style={{
            height: "65%",
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: insets.bottom,
            ...shadows.md,
          }}
        >
          <View
            onStartShouldSetResponder={() => true}
            onResponderGrant={(event) => {
              dragStartY.current = event.nativeEvent.pageY;
            }}
            onResponderRelease={(event) => {
              const startY = dragStartY.current;
              dragStartY.current = null;
              if (
                startY !== null &&
                event.nativeEvent.pageY - startY > DISMISS_DRAG_PX
              ) {
                onDismiss();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Swipe down to close"
            style={{
              alignItems: "center",
              paddingTop: space.sm,
              paddingBottom: space.xs,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: colors.border,
              }}
            />
          </View>
          <ScrollView
            contentContainerStyle={{
              padding: space.md,
              paddingTop: space.sm,
              paddingBottom: space.xl,
            }}
          >
            <MarkdownText text={text} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
