import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { InlineError } from "../../components/ui/inline-error";
import { NativeHeading, NativeText } from "../../components/ui/semantic";
import { useSession } from "../../features/auth/session-provider";
import {
  freshNewParentEmail,
  isLocalPersonaId,
  LOCAL_PERSONA_PASSWORD,
  LOCAL_PERSONAS,
  type LocalPersona,
} from "../../features/dev/local-personas";
import { env } from "../../lib/env";
import { isLocalBackendUrl } from "../../lib/local-backend";
import { supabase } from "../../lib/supabase";
import { quietColors } from "../../theme/native-projection";

/**
 * Signs in as one persona and returns an error message, or null on
 * success. Leaves whoever was signed in before first; scope local so the
 * switch never revokes anything server side.
 */
async function signInAsPersona(persona: LocalPersona): Promise<string | null> {
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  const result =
    persona.email === null
      ? await supabase.auth.signUp({
          email: freshNewParentEmail(),
          password: LOCAL_PERSONA_PASSWORD,
        })
      : await supabase.auth.signInWithPassword({
          email: persona.email,
          password: LOCAL_PERSONA_PASSWORD,
        });
  if (result.error || !result.data.session) {
    return (
      `${result.error?.message ?? "No session came back."} ` +
      `Is the stack up? Try pnpm dev:stack persona ${persona.id}.`
    );
  }
  return null;
}

/**
 * Local test parents: sign in as a new, mid-onboarding or established
 * parent in one tap, against the local stack only
 * (tooling/local-stack/README.md). Dev builds only: Metro blocks
 * src/app/labs/ from production bundles, and the screen refuses to act
 * unless the app points at a backend on this machine.
 *
 * `homa://labs/personas?as=established` signs straight in, which is what
 * `pnpm dev:stack open <id>` uses.
 */
export default function LocalPersonasLab() {
  const router = useRouter();
  const { as } = useLocalSearchParams<{ as?: string }>();
  const { session } = useSession();
  const local = isLocalBackendUrl(env.supabaseUrl);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const autoStarted = useRef(false);

  function finish(failure: string | null) {
    setPending(null);
    if (failure) setError(failure);
    else setSignedIn(true);
  }

  function choose(persona: LocalPersona) {
    if (!local || pending) return;
    setPending(persona.id);
    setError(null);
    void signInAsPersona(persona).then(finish);
  }

  useEffect(() => {
    if (!local || autoStarted.current || !isLocalPersonaId(as)) return;
    autoStarted.current = true;
    const persona = LOCAL_PERSONAS.find((candidate) => candidate.id === as);
    if (persona) void signInAsPersona(persona).then(finish);
  }, [as, local]);

  // Leave the way (auth)/email.tsx does, by rendering a Redirect, never
  // router.replace: the sign-in screen beneath this one redirects on the
  // new session too, and an imperative replace racing that Redirect
  // mounted the onboarding gate twice, whose two concurrent bootstrap
  // calls each created a family for the same new parent.
  if (signedIn && session) return <Redirect href="/" />;

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: quietColors.page }}
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <View style={{ gap: 6 }}>
          <NativeHeading>Local test parents</NativeHeading>
          <NativeText role="body" tone="muted">
            {local
              ? "Each one signs in to the private Supabase on this Mac. Nothing here touches production."
              : "This build points at a hosted backend, so test parents are off. Run pnpm dev:stack mobile to use them."}
          </NativeText>
        </View>

        {error ? <InlineError message={error} /> : null}

        {local
          ? LOCAL_PERSONAS.map((persona) => (
              <View key={persona.id} style={{ gap: 8 }}>
                <Button
                  label={pending === persona.id ? "Signing in…" : persona.label}
                  variant="secondary"
                  size="lg"
                  onPress={() => choose(persona)}
                  disabled={pending !== null}
                  busy={pending === persona.id}
                />
                <NativeText role="caption" tone="muted">
                  {persona.detail}
                </NativeText>
              </View>
            ))
          : null}

        <Button label="Back" variant="ghost" size="sm" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}
