import React from 'react';

/**
 * HOMA Checkbox, soft rounded box with clay check when selected.
 */
export function Checkbox({ checked = false, onChange, label, disabled = false, id, style = {} }) {
  const fieldId = id || (label ? 'cb-' + label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <label
      htmlFor={fieldId}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', color: 'var(--text-body)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, ...style,
      }}
    >
      <span
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          width: 22, height: 22, flexShrink: 0,
          borderRadius: 'var(--radius-xs)',
          border: `1.5px solid ${checked ? 'var(--brand)' : 'var(--border-strong)'}`,
          background: checked ? 'var(--brand)' : 'var(--surface-card)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all var(--dur-fast) var(--ease-out)',
        }}
      >
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {label && <span>{label}</span>}
      <input id={fieldId} type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange && onChange(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
    </label>
  );
}
