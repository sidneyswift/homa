import type { SendTurnInput } from "eve/client";

type EvalMessageOptions = Pick<Exclude<SendTurnInput, string>, "clientContext" | "headers">;
type EvalMessage = EvalMessageOptions & { readonly message: string };
type EvalMessageSender<T> =
  | { send(input: EvalMessage): Promise<T> }
  | { readonly start: unknown; send(message: string, options: EvalMessageOptions): Promise<T> };

/** Keep per-turn context and headers when comparing the two reviewed Eve APIs. */
export function sendEvalMessage<T>(sender: EvalMessageSender<T>, input: EvalMessage): Promise<T> {
  // Eve 0.54.3 exposes start and takes message/options separately. Eve 0.19.0
  // accepts one payload; passing a second argument there silently drops it.
  if ("start" in sender) {
    if (typeof sender.start !== "function") throw new Error("Unsupported Eve eval sender");
    const { message, ...options } = input;
    return sender.send(message, options);
  }
  return sender.send(input);
}
