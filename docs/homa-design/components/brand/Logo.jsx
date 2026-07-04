import React from 'react';

/**
 * Homa logo, "The bright home" mark (a home with a spark of magic inside)
 * paired with the chunky lowercase wordmark. Single source of truth for the
 * brand lockup across every surface.
 */
export function Logo({ size = 32, variant = 'full', tone = 'light', treatment = 'line', style = {}, ...rest }) {
  // tone = the BACKGROUND the logo sits on.
  const onDark = tone === 'dark';
  const duo = treatment === 'duo';
  const stroke = onDark ? 'var(--clay-400)' : 'var(--brand)';
  const spark = duo ? (onDark ? 'var(--gold-400)' : 'var(--gold-500)') : (onDark ? 'var(--gold-400)' : 'var(--brand)');
  const houseFill = duo ? (onDark ? 'rgba(224,144,108,0.16)' : 'var(--clay-50)') : 'none';
  const word = onDark ? '#FFFFFF' : 'var(--text-strong)';

  const mark = (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none"
      stroke={stroke} strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round"
      style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <path d="M9 22 L24 9 L39 22 V37 A2 2 0 0 1 37 39 H11 A2 2 0 0 1 9 37 Z" fill={houseFill} />
      <path d="M24 20 C24.7 25 25.5 25.8 30 26.5 C25.5 27.2 24.7 28 24 33 C23.3 28 22.5 27.2 18 26.5 C22.5 25.8 23.3 25 24 20 Z"
        fill={spark} stroke="none" />
    </svg>
  );

  if (variant === 'mark') {
    return <span role="img" aria-label="Homa" style={{ display: 'inline-flex', ...style }} {...rest}>{mark}</span>;
  }

  return (
    <span role="img" aria-label="Homa" style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.34, ...style }} {...rest}>
      {mark}
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: size * 1.02, lineHeight: 1, letterSpacing: '-0.01em', color: word, marginTop: size * -0.06 }}>homa</span>
    </span>
  );
}
