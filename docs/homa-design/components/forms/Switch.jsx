import React from 'react';

/**
 * Homa Switch, pill toggle, clay when on.
 */
export function Switch({ checked = false, onChange, label, disabled = false, size = 'md', style = {} }) {
  const dims = { sm: { w: 38, h: 22, k: 16 }, md: { w: 46, h: 26, k: 20 } }[size];
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', color: 'var(--text-body)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, ...style }}>
      <span
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          width: dims.w, height: dims.h, flexShrink: 0, borderRadius: 'var(--radius-pill)',
          background: checked ? 'var(--brand)' : 'var(--stone-300)',
          position: 'relative', transition: 'background var(--dur-base) var(--ease-out)',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? dims.w - dims.k - 3 : 3,
          width: dims.k, height: dims.k, borderRadius: '50%', background: '#fff',
          boxShadow: 'var(--shadow-sm)', transition: 'left var(--dur-base) var(--ease-out)',
        }} />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}
