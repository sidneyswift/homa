import React from 'react';

/**
 * Homa Tabs, underline tab bar. Controlled via value/onChange.
 */
export function Tabs({ tabs = [], value, onChange, style = {} }) {
  const [focused, setFocused] = React.useState(null);
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1.5px solid var(--border-subtle)', fontFamily: 'var(--font-sans)', ...style }}>
      {tabs.map(t => {
        const val = typeof t === 'string' ? t : t.value;
        const lbl = typeof t === 'string' ? t : t.label;
        const active = value === val;
        return (
          <button
            key={val}
            role="tab"
            aria-selected={active}
            onClick={() => onChange && onChange(val)}
            onFocus={() => setFocused(val)}
            onBlur={() => setFocused(null)}
            style={{
              appearance: 'none', border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '12px 16px', fontFamily: 'inherit', fontSize: '0.9375rem',
              fontWeight: active ? 700 : 500,
              color: active ? 'var(--brand)' : 'var(--text-muted)',
              borderBottom: `2.5px solid ${active ? 'var(--brand)' : 'transparent'}`,
              marginBottom: -1.5,
              outline: 'none',
              boxShadow: focused === val ? 'var(--shadow-focus)' : 'none',
              borderRadius: focused === val ? 'var(--radius-xs)' : 0,
              transition: 'color var(--dur-fast) var(--ease-out)',
            }}
          >
            {lbl}
          </button>
        );
      })}
    </div>
  );
}
