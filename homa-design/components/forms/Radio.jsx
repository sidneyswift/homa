import React from 'react';

/**
 * HOMA Radio group, pick one. Renders a set of options.
 */
export function Radio({ options = [], value, onChange, name = 'radio', disabled = false, style = {} }) {
  return (
    <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'var(--font-sans)', ...style }}>
      {options.map(opt => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const lbl = typeof opt === 'string' ? opt : opt.label;
        const selected = value === val;
        return (
          <label key={val} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: '0.9375rem', color: 'var(--text-body)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
            <span style={{
              width: 22, height: 22, flexShrink: 0, borderRadius: '50%',
              border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--border-strong)'}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all var(--dur-fast) var(--ease-out)',
            }}>
              {selected && <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--brand)' }} />}
            </span>
            <span>{lbl}</span>
            <input type="radio" name={name} checked={selected} disabled={disabled} onChange={() => onChange && onChange(val)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          </label>
        );
      })}
    </div>
  );
}
