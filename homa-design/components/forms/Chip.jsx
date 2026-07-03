import React from 'react';

/**
 * HOMA Chip, selectable/removable pill. Great for subjects & filters.
 */
export function Chip({ children, selected = false, onClick, onRemove, iconLeft = null, style = {} }) {
  const [hover, setHover] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 600,
        padding: '7px 14px', borderRadius: 'var(--radius-pill)', cursor: onClick ? 'pointer' : 'default',
        background: selected ? 'var(--brand)' : (hover && onClick ? 'var(--stone-100)' : 'var(--surface-card)'),
        color: selected ? '#fff' : 'var(--text-body)',
        border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--border-default)'}`,
        outline: 'none',
        boxShadow: focus ? 'var(--shadow-focus)' : 'none',
        transition: 'all var(--dur-fast) var(--ease-out)', ...style,
      }}
    >
      {iconLeft}
      {children}
      {onRemove && (
        <span onClick={e => { e.stopPropagation(); onRemove(); }} style={{ display: 'inline-flex', marginRight: -4, opacity: 0.7 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </span>
      )}
    </span>
  );
}
