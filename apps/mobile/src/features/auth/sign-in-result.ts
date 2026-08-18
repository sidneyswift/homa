/**
 * Shared result shape for the Google and Apple sign-in flows, so the
 * sign-in screen handles every provider the same way.
 *
 * The split between `provider-declined` and `failed` is the whole point:
 * it decides whether Homa speaks. Apple and Google show the parent their
 * own sheets, their own errors, and their own way forward. When the
 * refusal came from them, they have already said it better than Homa
 * can, and a second message on top only contradicts the first. When the
 * parent cleared the provider and our own exchange is what broke, nobody
 * else is going to explain it, so Homa has to.
 */
export type SignInFlowResult =
  /** Session established. SessionProvider takes it from here. */
  | { status: "signed-in" }
  /** The parent backed out (closed the sheet, tapped cancel). */
  | { status: "dismissed" }
  /**
   * The provider refused, having already told the parent why and what to
   * do about it. Homa stays quiet. `reason` is for logs, never for parents.
   */
  | { status: "provider-declined"; reason: string }
  /**
   * The provider said yes and our side could not finish. The parent did
   * everything right and has seen no explanation, so this one speaks.
   * `reason` is for logs, never for parents.
   */
  | { status: "failed"; reason: string };
