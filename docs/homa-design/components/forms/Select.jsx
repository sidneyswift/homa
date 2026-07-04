import React from 'react';

/**
 * Homa Select, styled native select with chevron.
 */
export function Select({ label, hint, options = [], value, onChange, disabled = false, id, placeholder, style = {} }) {
  const [focus, setFocus] = React.useState(false);
  const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)', ...style }}>
      {label && <label htmlFor={fieldId} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-body)' }}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <select
          id={fieldId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            appearance: 'none', WebkitAppearance: 'none',
            width: '100%', fontFamily: 'inherit', fontSize: '1rem', color: 'var(--text-strong)',
            background: disabled ? 'var(--stone-100)' : 'var(--surface-card)',
            border: `1.5px solid ${focus ? 'var(--clay-400)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)', padding: '11px 40px 11px 14px', minHeight: 46,
            cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none',
            boxShadow: focus ? 'var(--shadow-focus)' : 'none',
            transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
          }}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map(opt => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const lbl = typeof opt === 'string' ? opt : opt.label;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
        <svg style={{ position: 'absolute', right: 14, pointerEvents: 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-subtle)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {hint && <span style={{ fontSize: '0.8125rem', color: 'var(--text-subtle)' }}>{hint}</span>}
    </div>
  );
}
