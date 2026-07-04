import React from 'react';

/**
 * Homa ProgressBar, rounded track, clay/sage fill. Optional label + value.
 */
export function ProgressBar({ value = 0, max = 100, tone = 'brand', label, showValue = false, size = 'md', style = {} }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fills = { brand: 'var(--brand)', sage: 'var(--sage-500)', gold: 'var(--gold-500)', info: 'var(--info)' };
  const h = { sm: 6, md: 10, lg: 14 }[size];
  return (
    <div style={{ fontFamily: 'var(--font-sans)', ...style }}>
      {(label || showValue) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8125rem' }}>
          {label && <span style={{ color: 'var(--text-body)', fontWeight: 600 }}>{label}</span>}
          {showValue && <span style={{ color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(pct)}%</span>}
        </div>
      )}
      <div style={{ height: h, borderRadius: 'var(--radius-pill)', background: 'var(--stone-200)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', borderRadius: 'var(--radius-pill)', background: fills[tone], transition: 'width var(--dur-slow) var(--ease-out)' }} />
      </div>
    </div>
  );
}
