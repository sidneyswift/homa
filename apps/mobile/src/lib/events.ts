import { emitEvent, type EventName, type EventProps } from "@homa/core";

import { env } from "./env";
import { supabase } from "./supabase";

/**
 * Typed event emission under the caller's own token (events policy,
 * migration #13), the mobile twin of the web chat's emit path. Silently
 * a no-op when signed out; analytics never block or break the product.
 */
export async function emitFamilyEvent<N extends EventName>(
  familyId: string | null,
  name: N,
  props: EventProps<N>,
): Promise<void> {
  if (!familyId) return;
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return;
  await emitEvent(
    {
      supabaseUrl: env.supabaseUrl,
      supabaseKey: env.supabasePublishableKey,
      accessToken,
      familyId,
    },
    name,
    props,
  );
}
