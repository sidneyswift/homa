import { Logo } from "../brand/Logo";

/**
 * Marketing site footer, ported from
 * docs/homa-design/templates/landing-page/LandingPage.dc.html's footer
 * pattern (logo + italic serif tagline, one row). No link columns, there is
 * no blog, careers page, or published privacy policy yet (see TRUST_POINTS
 * in page.tsx), and a footer full of dead links is worse than a short one.
 */
export function Footer() {
  return (
    <footer
      className="px-6 py-8 sm:px-10"
      style={{ background: "var(--pop-navy)" }}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
        <Logo size={26} tone="dark" />
        <p className="font-serif text-base italic text-[var(--stone-400)]">
          Homeschooling, made calm.
        </p>
      </div>
      <p className="mx-auto mt-4 max-w-5xl text-center text-xs text-[var(--stone-400)] sm:text-right">
        &copy; 2026 Homa
      </p>
    </footer>
  );
}
