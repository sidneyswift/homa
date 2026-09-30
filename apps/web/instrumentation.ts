import { registerTimingFetch } from "./lib/observability/chat-timing-io";
import { registerChatTiming } from "./lib/observability/chat-timing-server";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") { registerChatTiming(); registerTimingFetch(); }
}
