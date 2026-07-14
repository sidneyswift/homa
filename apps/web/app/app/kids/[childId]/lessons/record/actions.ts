"use server";

import { revalidatePath } from "next/cache";

import { getMyFamily } from "../../../../../../lib/family";
import { setLessonAudioConsent } from "../../../../../../lib/family-profile";
import { emitMapEvent } from "../../../../../../lib/map/events";
import { createSupabaseServerClient } from "../../../../../../lib/supabase/server";

/**
 * The lesson listen consent screen's agree button (LL-0, ruling
 * lesson-listen-child-audio): stamps who agreed and when on the
 * family, once. Until this stamp exists no lesson can be recorded or
 * uploaded, here or through any API route (the server gate in
 * lib/lessons/route-auth.ts checks the same column).
 */
export async function agreeLessonAudioConsentAction(): Promise<{
  error: string | null;
}> {
  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in and try again." };

  if (!family.lesson_audio_consent_at) {
    await setLessonAudioConsent(family.id, user.id);
    await emitMapEvent("family.lesson_audio_consented", {
      family_id: family.id,
    });
  }
  revalidatePath("/app", "layout");
  return { error: null };
}
