import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { ScreenHeader } from "../components/ui/screen-header";
import { useSession } from "../features/auth/session-provider";
import { supabase } from "../lib/supabase";
import { openWebSettings } from "../lib/web-links";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";

/**
 * Settings: the account block that used to sit at the bottom of Family.
 * Billing and deeper account management stay on the web (the mobile
 * twin of /app/settings links out rather than reimplementing Stripe).
 */
export default function SettingsScreen() {
  const { session } = useSession();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["top"]}>
      <ScreenHeader title="Settings" />
      <View style={{ padding: space.lg, gap: space.lg }}>
        <Card style={{ gap: space.sm }}>
          <Text
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.lg,
              color: colors.textStrong,
            }}
          >
            Account
          </Text>
          {session?.user.email ? (
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              Signed in as {session.user.email}
            </Text>
          ) : null}
          <Button
            label="Manage plan and account on the web"
            variant="secondary"
            onPress={() => void openWebSettings()}
          />
        </Card>

        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => void supabase.auth.signOut()}
        />
      </View>
    </SafeAreaView>
  );
}
