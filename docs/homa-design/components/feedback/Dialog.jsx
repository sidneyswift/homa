import React from 'react';

/**
 * Homa Dialog, centered modal over a warm scrim.
 */
export function Dialog({ open, onClose, title, children, footer, width = 480, style = {} }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(51, 42, 33, 0.42)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)', width, maxWidth: '100%', maxHeight: '90vh',
          overflow: 'auto', fontFamily: 'var(--font-sans)', ...style,
        }}
      >
        <div style={{ padding: 'var(--space-6) var(--space-6) var(--space-4)' }}>
          {title && <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-strong)' }}>{title}</h2>}
        </div>
        <div style={{ padding: '0 var(--space-6)', color: 'var(--text-body)', lineHeight: 'var(--leading-normal)' }}>
          {children}
        </div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: 'var(--space-6)' }}>{footer}</div>}
      </div>
    </div>
  );
}
