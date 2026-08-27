import { Redirect } from "expo-router";

/** Text is Homa's front door. Voice opens only when a parent taps the mic. */
export default function IndexRedirect() {
  return <Redirect href="/chat" />;
}
