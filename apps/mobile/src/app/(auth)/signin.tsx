import { Redirect } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "../../components/brand/logo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { TextField } from "../../components/ui/text-field";
import { useSession } from "../../features/auth/session-provider";
import { supabase } from "../../lib/supabase";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";

/**
 * Email + password sign in and sign up, matching the web /signin flow
 * (signups are auto-confirmed by a DB trigger, so signUp is followed by
 * an immediate password sign-in, same as apps/web/app/signin/actions.ts).
 * Google OAuth needs a deep-link redirect registered in Supabase first;
 * it arrives with that setup (HUMAN-TODO).
 */
export default function SignInScreen() {
  const { session } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  async function submit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email and password are both needed.");
      return;
    }
    setPending(true);
    setError(null);
    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      if (signUpError) {
        setPending(false);
        setError(signUpError.message);
        return;
      }
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setPending(false);
    if (signInError) setError(signInError.message);
    // Success: SessionProvider picks up the session and this screen redirects.
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: space.lg,
            gap: space.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", gap: space.md }}>
            <Logo size={44} />
            <Text
              style={{
                textAlign: "center",
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              {"You've got this. Homa's got the rest."}
            </Text>
          </View>

          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <ModeTab
                label="Sign in"
                active={mode === "signin"}
                onPress={() => setMode("signin")}
              />
              <ModeTab
                label="Create account"
                active={mode === "signup"}
                onPress={() => setMode("signup")}
              />
            </View>

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? "8 characters or more" : undefined}
            />

            {error ? (
              <Text
                accessibilityRole="alert"
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  color: colors.danger,
                }}
              >
                {error}
              </Text>
            ) : null}

            <Button
              label={
                pending
                  ? "One moment\u2026"
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"
              }
              onPress={() => void submit()}
              disabled={pending}
              size="lg"
            />
          </Card>

          <Text
            style={{
              textAlign: "center",
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textMuted,
            }}
          >
            Google sign-in works on the web today and is coming to the app.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ModeTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: active ? colors.brand : colors.card,
        paddingHorizontal: space.md,
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodyMedium,
          fontSize: fontSize.sm,
          color: active ? colors.onBrand : colors.textStrong,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
