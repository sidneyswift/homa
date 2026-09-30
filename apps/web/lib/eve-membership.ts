import { EveAuthServiceUnavailableError } from "./eve-authentication";
import { measureChatPreparation } from "./observability/chat-preparation";

export { EveAuthServiceUnavailableError as EveMembershipUnavailableError } from "./eve-authentication";

interface MembershipReadResult {
  error: unknown;
  status: number;
}

/** Keep backend outages distinct from denied access without retrying a send. */
export async function readEveMembership<T extends MembershipReadResult>(
  read: () => PromiseLike<T>,
  stage: "membership" | "binding_membership" = "membership",
): Promise<T> {
  return await measureChatPreparation(stage, async () => {
    const result = await read();
    if (
      result.error &&
      (result.status === 0 ||
        result.status === 408 ||
        result.status === 429 ||
        (result.status >= 500 && result.status < 600))
    ) {
      // GH #1178: Supabase resolves a 504 as an error value. Returning null
      // from auth mislabeled that outage as a 401 and logged it as success.
      throw new EveAuthServiceUnavailableError();
    }
    return result;
  });
}
