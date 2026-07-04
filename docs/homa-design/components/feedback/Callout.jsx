import React from 'react';

/**
 * Homa Callout, inline banner for tips, notes, and Homa suggestions.
 */
export function Callout({ tone = 'brand', title, icon = null, children, style = {} }) {
  const tones = {
    brand:   ['var(--clay-50)', 'var(--clay-200)', 'var(--clay-700)'],
    sage:    ['var(--sage-50)', 'var(--sage-200)', 'var(--sage-700)'],
    gold:    ['var(--gold-100)', 'var(--gold-300)', '#8a6410'],
    info:    ['var(--info-soft)', 'var(--sky-300)', 'var(--sky-600)'],
    warning: ['var(--warning-soft)', 'var(--gold-300)', '#8a6410'],
    danger:  ['var(--danger-soft)', 'var(--rose-500)', 'var(--rose-600)'],
  };
  const [bg, border, fg] = tones[tone];
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      background: bg, border: `1px solid ${border}`, borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4) var(--space-5)', fontFamily: 'var(--font-sans)', ...style,
    }}>
      {icon && <span style={{ color: fg, display: 'inline-flex', flexShrink: 0, marginTop: 1 }}>{icon}</span>}
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 700, color: fg, marginBottom: 2, fontSize: '0.9375rem' }}>{title}</div>}
        <div style={{ color: 'var(--text-body)', fontSize: '0.9375rem', lineHeight: 'var(--leading-normal)' }}>{children}</div>
      </div>
    </div>
  );
}
