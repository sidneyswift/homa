import { createSupabaseBrowserClient } from "./supabase/client";

/**
 * uploadAvatarPhoto(file): Promise<string | null>
 * Browser-to-bucket upload of an adult's own profile photo into the
 * public avatars bucket (owner-scoped storage policies, migration #29:
 * each user writes only under their own auth.uid() folder). Returns the
 * public URL, or null on any failure so callers surface an inline error
 * instead of blocking a save silently. Used by onboarding's FamilyStep
 * and the settings adults card; the server re-checks the URL points at
 * our bucket before storing it.
 */
export async function uploadAvatarPhoto(file: File): Promise<string | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) return null;
    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}
