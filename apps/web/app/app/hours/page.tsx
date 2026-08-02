import { permanentRedirect } from "next/navigation";

/** Compatibility door for old bookmarks. Planner is now canonical. */
export default function HoursPage() {
  permanentRedirect("/app/planner?view=hours");
}
