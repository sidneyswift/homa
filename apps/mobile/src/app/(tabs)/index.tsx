import { Redirect } from "expo-router";

/** Chat is the app's front door now (founder call 2026-07-29, matching
 *  web: /app IS chat). The former Today tab's content lives in
 *  chat.tsx's own welcome state; this route just hands off to it. */
export default function IndexRedirect() {
  return <Redirect href="/chat" />;
}
