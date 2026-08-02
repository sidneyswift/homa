import type { ReactNode, RefObject } from "react";
import {
  AccessibilityInfo,
  Modal,
  View,
  findNodeHandle,
  type ModalProps,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

type AccessibleModalProps = Omit<ModalProps, "animationType" | "children" | "visible"> & {
  animationType?: ModalProps["animationType"];
  children: ReactNode;
  initialFocusRef: RefObject<View | null>;
  returnFocusRef?: RefObject<View | null>;
  title: string;
  visible: boolean;
};

function focusAccessibilityNode(target: View | null | undefined): void {
  const frame = requestAnimationFrame(() => {
    const node = target ? findNodeHandle(target) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  });
  void frame;
}

/**
 * One accessibility chassis for every native sheet and modal. It isolates
 * screen-reader navigation to the presented surface, names each presentation,
 * and removes its transition when the system Reduce Motion setting is on.
 */
export function AccessibleModal({
  animationType = "slide",
  children,
  initialFocusRef,
  onDismiss,
  onRequestClose,
  onShow,
  returnFocusRef,
  title,
  visible,
  ...modalProps
}: AccessibleModalProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Modal
      {...modalProps}
      visible={visible}
      animationType={reducedMotion ? "none" : animationType}
      onRequestClose={onRequestClose}
      onShow={(event) => {
        onShow?.(event);
        focusAccessibilityNode(initialFocusRef.current);
      }}
      onDismiss={() => {
        onDismiss?.();
        focusAccessibilityNode(returnFocusRef?.current);
      }}
    >
      <View
        accessibilityElementsHidden={!visible}
        accessibilityViewIsModal={visible}
        accessibilityLabel={title}
        onAccessibilityEscape={
          onRequestClose
            ? () => (onRequestClose as () => void)()
            : undefined
        }
        importantForAccessibility={visible ? "yes" : "no-hide-descendants"}
        style={{ flex: 1 }}
      >
        {children}
      </View>
    </Modal>
  );
}
