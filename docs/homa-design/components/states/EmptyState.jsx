import React from 'react';

/**
 * HOMA EmptyState, a warm invitation, never a dead end.
 */
export function EmptyState({ icon = null, title, body, action = null, hand, style = {} }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      padding: 'var(--space-10) var(--space-6)', fontFamily: 'var(--font-sans)', ...style,
    }}>
      {icon && (
        <span style={{
          width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>{icon}</span>
      )}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 500, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>{title}</div>
      {body && <div style={{ color: 'var(--text-muted)', maxWidth: 400, lineHeight: 1.55, marginTop: 8, fontSize: '0.95rem' }}>{body}</div>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
      {hand && <div style={{ fontFamily: 'var(--font-hand)', fontSize: '1.5rem', color: 'var(--sage-600)', marginTop: 16, lineHeight: 1 }}>{hand}</div>}
    </div>
  );
}
