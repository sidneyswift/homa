import React from 'react';

/**
 * Homa logo, "the little home": a chunky rounded clay house with bright eyes,
 * Homa personified, warm, watchful, a little playful, beside the bounced
 * Fredoka wordmark (each letter nudged off the baseline). Default treatment
 * is the solid character; "line" is a quiet one-color outline for stamps and
 * prints. Never redraw the mark or re-set the wordmark by hand.
 */
const HOUSE = 'M24 5.6 C22.5 5.6 21 6.2 19.8 7.3 L7.1 18.9 C5.5 20.4 4.6 22.5 4.6 24.7 L4.6 35.2 C4.6 40.1 8.5 44 13.4 44 L34.6 44 C39.5 44 43.4 40.1 43.4 35.2 L43.4 24.7 C43.4 22.5 42.5 20.4 40.9 18.9 L28.2 7.3 C27 6.2 25.5 5.6 24 5.6 Z';

export function Logo({ size = 32, variant = 'full', tone = 'light', treatment = 'solid', style = {}, ...rest }) {
  const body = tone === 'dark' ? 'var(--clay-400)' : 'var(--brand)';
  const word = tone === 'dark' ? '#FFFFFF' : 'var(--text-strong)';
  const svgStyle = { display: 'block', flexShrink: 0 };
  const mark = treatment === 'line' ? (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={svgStyle}>
      <path d={HOUSE} fill="none" stroke={body} strokeWidth="3.2" strokeLinejoin="round" />
      <circle cx="17.4" cy="26" r="2.7" fill={body} />
      <circle cx="30.6" cy="26" r="2.7" fill={body} />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={svgStyle}>
      <path d={HOUSE} fill={body} />
      <circle cx="17.4" cy="26" r="4.8" fill="#FFFFFF" />
      <circle cx="30.6" cy="26" r="4.8" fill="#FFFFFF" />
      <circle cx="18.3" cy="26.7" r="2.2" fill="#221E1A" />
      <circle cx="31.5" cy="26.7" r="2.2" fill="#221E1A" />
    </svg>
  );
  if (variant === 'mark') {
    return <span role="img" aria-label="Homa" style={{ display: 'inline-flex', ...style }} {...rest}>{mark}</span>;
  }
  const letters = [['H', '-0.06em', -3], ['o', '0.05em', 0], ['m', '-0.04em', 2], ['a', '0.06em', -2]];
  return (
    <span role="img" aria-label="Homa" style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3, ...style }} {...rest}>
      {mark}
      <span aria-hidden="true" style={{ fontFamily: 'var(--font-wordmark)', fontWeight: 600, fontSize: size * 0.98, lineHeight: 1, color: word, display: 'inline-flex', marginTop: size * -0.04 }}>
        {letters.map(([ch, ty, r]) => (
          <span key={ch} style={{ display: 'inline-block', transform: 'translateY(' + ty + ') rotate(' + r + 'deg)' }}>{ch}</span>
        ))}
      </span>
    </span>
  );
}
