import { measureChatPreparation } from "./observability/chat-preparation";

interface MembershipReadResult {
  error: unknown;
  status: number;
}

/** Eve's routeAuth forwards structured error responses before admitting a turn. */
export class EveMembershipUnavailableError extends Error {
  readonly response: Response;

  constructor() {
    const message = "Chat access could not be checked. Please try again.";
    super(message);
    this.name = "EveMembershipUnavailableError";
    this.response = Response.json(
      { ok: false, code: "auth_service_unavailable", error: message },
      {
        status: 503,
        headers: { "cache-control": "no-store", "retry-after": "1" },
      },
    );
  }
}

/** Keep backend outages distinct from denied access without retrying a send. */
export async function readEveMembership<T extends MembershipReadResult>(
  read: () => PromiseLike<T>,
): Promise<T> {
  return await measureChatPreparation("membership", async () => {
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
      throw new EveMembershipUnavailableError();
    }
    return result;
  });
}
