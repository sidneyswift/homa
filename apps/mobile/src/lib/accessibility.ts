import { useEffect, useRef, useState, type RefObject } from "react";
import { AccessibilityInfo, View } from "react-native";

/** Sends React Native's supported focus event to a mounted host view. */
export function sendAccessibilityFocus(target: View | null | undefined): boolean {
  if (!target) return false;
  AccessibilityInfo.sendAccessibilityEvent(target, "focus");
  return true;
}

/**
 * Announces a transient state once per distinct appearance while a screen
 * reader is running. Passing null clears the dedupe boundary, so the same
 * message can be announced again when it represents a later event.
 */
export function useAccessibilityAnnouncement(
  message: string | null | undefined,
  occurrenceId?: string | number,
): void {
  const lastAnnounced = useRef<string | null>(null);

  useEffect(() => {
    const nextMessage = message?.trim() ?? "";
    const nextOccurrence = occurrenceId ?? nextMessage;
    const announcementKey = nextMessage ? `${nextOccurrence}\u0000${nextMessage}` : "";
    if (!nextMessage) {
      lastAnnounced.current = null;
      return;
    }
    if (lastAnnounced.current === announcementKey) return;

    lastAnnounced.current = announcementKey;
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (active && enabled && lastAnnounced.current === announcementKey) {
          AccessibilityInfo.announceForAccessibility(nextMessage);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [message, occurrenceId]);
}

/**
 * Moves accessibility focus after a stepped surface replaces its prompt.
 * The optional callback runs only after the new node is laid out and focus
 * has been requested, allowing callers to keep old answer positions inert.
 */
export function useAccessibilityFocusOnChange(
  targetRef: RefObject<View | null>,
  changeKey: string | number | null,
  onFocused?: () => void,
): void {
  const onFocusedRef = useRef(onFocused);

  useEffect(() => {
    onFocusedRef.current = onFocused;
  }, [onFocused]);

  useEffect(() => {
    if (changeKey === null) return;
    let cancelled = false;
    let frame = 0;
    let attempts = 0;
    const requestFocus = () => {
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        attempts += 1;
        if (sendAccessibilityFocus(targetRef.current)) {
          onFocusedRef.current?.();
          return;
        }
        if (attempts < 3) requestFocus();
      });
    };
    requestFocus();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [changeKey, targetRef]);
}

/** Tracks the system screen-reader setting, including changes while open. */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((next) => {
        if (active) setEnabled(next);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setEnabled,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
