"use client";

import { APP_NAV_ITEMS } from "../dashboard/sidebar-nav";
import { QuietNav, type QuietNavMenuItem } from "../design/QuietNav";
import { HERO_COPY } from "./landing-content";
import { useSignedIn } from "./use-signed-in";
import { useSignupPopup } from "./SignupPopupProvider";

/**
 * Marketing adapter for the reusable Quiet shell. Auth and signup behavior
 * stays here, while the design primitive owns layout, motion, and focus.
 */
export function Nav() {
  const signedIn = useSignedIn();
  const openPopup = useSignupPopup();
  const signedInItems: readonly QuietNavMenuItem[] = [
    ...APP_NAV_ITEMS,
    { href: "/app/settings", label: "Settings", icon: "settings", dividerBefore: true },
  ];

  return (
    <QuietNav
      signedIn={signedIn}
      primaryActionLabel={HERO_COPY.primaryAction}
      primaryActionHref="/onboarding"
      onPrimaryAction={openPopup ?? undefined}
      signedInItems={signedInItems}
    />
  );
}

export { QUIET_NAV_LINKS } from "../design/QuietNav";
