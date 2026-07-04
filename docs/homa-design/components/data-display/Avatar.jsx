import React from 'react';

/**
 * HOMA Avatar, circular initials/photo. Warm auto-color from name.
 */
export function Avatar({ name = '', src = null, size = 40, tone, style = {} }) {
  const palette = ['var(--clay-400)', 'var(--sage-500)', 'var(--gold-500)', 'var(--sky-500)', 'var(--clay-500)'];
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const idx = name.length % palette.length;
  const bg = tone || palette[idx];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: src ? 'transparent' : bg, color: '#fff', overflow: 'hidden',
      fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: size * 0.4,
      border: '2px solid var(--surface-card)', boxShadow: 'var(--shadow-xs)', ...style,
    }}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </span>
  );
}
