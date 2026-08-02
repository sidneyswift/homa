import { Component, type ReactNode } from "react";
import * as Updates from "expo-updates";
import { ScrollView, StyleSheet, Text } from "react-native";

import { reportCrash } from "../lib/crash-reporting";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";
import { Button } from "./ui/button";

/**
 * The last line of defense. Without this, a render error is a blank white
 * screen with no way back short of force-quitting, which is how a code
 * bug becomes a one-star review. Class component because React only
 * supports error boundaries via getDerivedStateFromError/componentDidCatch,
 * no hook equivalent exists.
 */

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    reportCrash(error, { componentStack: info.componentStack ?? undefined });
  }

  handleReload = () => {
    if (Updates.isEmbeddedLaunch === false || Updates.channel) {
      void Updates.reloadAsync();
      return;
    }
    // Dev client / no expo-updates runtime: reset the boundary so the
    // next render attempt has a chance to succeed.
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Homa hit a snag.</Text>
        <Text style={styles.body}>
          {
            "Your family's information is safe; nothing here was lost. Try reloading the app."
          }
        </Text>
        <Button label="Reload" onPress={this.handleReload} />
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
    gap: space.md,
  },
  title: {
    fontFamily: fontFamilies.displaySemibold,
    fontSize: fontSize.xl,
    color: colors.textStrong,
    textAlign: "center",
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: fontSize.base,
    color: colors.textBody,
    textAlign: "center",
  },
});
