import React from 'react';

/**
 * Homa Badge, small status/label pill.
 */
export function Badge({ tone = 'neutral', variant = 'soft', children, iconLeft = null, style = {} }) {
  const tones = {
    neutral: { soft: ['var(--stone-100)', 'var(--stone-700)'], solid: ['var(--stone-700)', '#fff'] },
    brand:   { soft: ['var(--clay-50)', 'var(--clay-700)'], solid: ['var(--brand)', '#fff'] },
    sage:    { soft: ['var(--sage-50)', 'var(--sage-700)'], solid: ['var(--sage-600)', '#fff'] },
    gold:    { soft: ['var(--gold-100)', '#8a6410'], solid: ['var(--gold-500)', '#402e05'] },
    success: { soft: ['var(--success-soft)', 'var(--sage-700)'], solid: ['var(--success)', '#fff'] },
    warning: { soft: ['var(--warning-soft)', '#8a6410'], solid: ['var(--warning)', '#402e05'] },
    danger:  { soft: ['var(--danger-soft)', 'var(--rose-600)'], solid: ['var(--danger)', '#fff'] },
    info:    { soft: ['var(--info-soft)', 'var(--sky-600)'], solid: ['var(--info)', '#fff'] },
  };
  const [bg, fg] = tones[tone][variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: bg, color: fg,
      fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600,
      padding: '4px 10px', borderRadius: 'var(--radius-pill)',
      letterSpacing: '0.01em', whiteSpace: 'nowrap', ...style,
    }}>
      {iconLeft}{children}
    </span>
  );
}
