import React from 'react';

/**
 * HOMA Toast, quiet confirmation pill, fixed bottom-center.
 */
export function Toast({ open = true, message, icon = null, action, onAction, tone = 'dark', inline = false, style = {} }) {
  if (!open) return null;
  const dark = tone === 'dark';
  return (
    <div role="status" style={{
      position: inline ? 'static' : 'fixed',
      left: inline ? 'auto' : '50%',
      bottom: inline ? 'auto' : 28,
      transform: inline ? 'none' : 'translateX(-50%)',
      zIndex: 1100,
      display: 'inline-flex', alignItems: 'center', gap: 10,
      background: dark ? 'var(--stone-900)' : 'var(--surface-card)',
      color: dark ? 'var(--stone-50)' : 'var(--text-body)',
      border: dark ? 'none' : '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-pill)',
      padding: '12px 20px',
      boxShadow: 'var(--shadow-lg)',
      fontFamily: 'var(--font-sans)', fontSize: '0.925rem', fontWeight: 500,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {icon}
      <span>{message}</span>
      {action && (
        <button onClick={onAction} style={{
          border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, marginLeft: 6,
          color: dark ? 'var(--gold-400)' : 'var(--brand)',
          fontWeight: 700, fontFamily: 'inherit', fontSize: 'inherit',
        }}>{action}</button>
      )}
    </div>
  );
}
