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

import { GoogleGlyph } from "../../components/brand/GoogleGlyph";
import { Logo } from "../../components/brand/logo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { TextField } from "../../components/ui/text-field";
import { useSession } from "../../features/auth/session-provider";
import { signInWithGoogle } from "../../lib/google-auth";
import { supabase } from "../../lib/supabase";
import { openWebOnboarding } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, pressScale, radius, space } from "../../theme/tokens";

/**
 * Email + password sign-in, matching the web /signin flow. Account
 * creation stays behind the web onboarding entry, so every door gathers
 * the same setup context before a family reaches the app.
 */
export default function SignInScreen() {
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);

  if (session) return <Redirect href="/" />;

  async function submit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email and password are both needed.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setPending(false);
    if (signInError) {
      console.error("mobile signin failed:", signInError.message);
      setError("That email and password didn't match. You can try again when you're ready.");
    }
    // Success: SessionProvider picks up the session and this screen redirects.
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGooglePending(true);
    const { error: googleError } = await signInWithGoogle();
    setGooglePending(false);
    if (googleError) {
      setError(googleError);
    }
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
            {/* Google sign-in — matches web's "Continue with Google" button */}
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleGoogleSignIn()}
              disabled={googlePending}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                minHeight: 48,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                paddingVertical: 12,
                paddingHorizontal: space.lg,
                opacity: googlePending ? 0.6 : 1,
                transform: [{ scale: pressed ? pressScale : 1 }],
              })}
            >
              <GoogleGlyph />
              <Text
                style={{
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.base,
                  color: colors.textStrong,
                }}
              >
                {googlePending ? "Redirecting to Google\u2026" : "Continue with Google"}
              </Text>
            </Pressable>

            {/* Divider */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: colors.borderSubtle }} />
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  color: colors.textMuted,
                }}
              >
                or
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.borderSubtle }} />
            </View>

            {/* Email + password */}
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
              autoComplete="current-password"
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
              label={pending ? "One moment\u2026" : "Sign in"}
              onPress={() => void submit()}
              disabled={pending}
              size="lg"
            />
          </Card>

          <View style={{ gap: space.sm }}>
            <Text
              style={{
                textAlign: "center",
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                color: colors.textMuted,
              }}
            >
              New to Homa? Start with the web onboarding, then sign in here.
            </Text>
            <Button
              label="Open onboarding"
              variant="ghost"
              onPress={() => void openWebOnboarding()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
