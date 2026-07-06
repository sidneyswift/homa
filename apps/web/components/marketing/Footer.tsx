import { Logo } from "../brand/Logo";

/**
 * Navy site footer, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx: brand column + Product /
 * Company / Support link columns + copyright rule.
 */

const COLUMNS: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
  ["Product", [["Your child's progress report", "/map"], ["How the report works", "/map/method"], ["Features", "/#features"], ["Try it", "/#try"]]],
  ["Company", [["Our story", "/#stories"], ["Blog", "/blog"], ["Founding families", "/#pricing"]]],
  ["Support", [["Privacy", "/privacy"], ["Contact", "mailto:hello@mail.thankshoma.com"]]],
];

export function Footer() {
  return (
    <footer className="lp-pad" style={{ background: "var(--pop-navy)", color: "var(--stone-300)", padding: "72px 40px 36px" }}>
      <div className="lp-4col" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 32 }}>
        <div>
          <Logo size={28} tone="dark" />
          <p style={{ marginTop: 14, maxWidth: 260, lineHeight: 1.55, fontSize: "0.92rem", color: "var(--stone-400)" }}>
            The calm, capable co-pilot for homeschooling families.
          </p>
        </div>
        {COLUMNS.map(([heading, links]) => (
          <div key={heading}>
            <div style={{ color: "#fff", fontWeight: 700, marginBottom: 12, fontSize: "0.95rem" }}>{heading}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {links.map(([label, href]) => (
                <a key={label} href={href} style={{ color: "var(--stone-400)", textDecoration: "none", fontSize: "0.9rem" }}>
                  {label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          maxWidth: 1100,
          margin: "32px auto 0",
          paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.18)",
          fontSize: "0.85rem",
          color: "var(--stone-400)",
        }}
      >
        &copy; 2026 Homa. Made for families who teach.
      </div>
    </footer>
  );
}
