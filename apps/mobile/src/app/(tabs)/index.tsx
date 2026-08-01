import { Redirect } from "expo-router";

/** Voice is Homa's front door. Text remains one tap away in chat, but a
 * parent should never have to find a separate mode to talk with Homa. */
export default function IndexRedirect() {
  return <Redirect href="/voice" />;
}
