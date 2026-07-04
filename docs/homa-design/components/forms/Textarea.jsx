import React from 'react';

/**
 * Homa Textarea, multi-line field, auto-styled to match Input.
 */
export function Textarea({
  label, hint, error, rows = 4, disabled = false,
  value, onChange, placeholder, id, style = {}, ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)', ...style }}>
      {label && (
        <label htmlFor={fieldId} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-body)' }}>{label}</label>
      )}
      <textarea
        id={fieldId}
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          resize: 'vertical',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          fontSize: '1rem',
          lineHeight: 'var(--leading-normal)',
          color: 'var(--text-strong)',
          background: disabled ? 'var(--stone-100)' : 'var(--surface-card)',
          border: `1.5px solid ${error ? 'var(--danger)' : focus ? 'var(--clay-400)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '11px 14px',
          outline: 'none',
          boxShadow: focus ? 'var(--shadow-focus)' : 'none',
          transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
        }}
        {...rest}
      />
      {(hint || error) && (
        <span style={{ fontSize: '0.8125rem', color: error ? 'var(--danger)' : 'var(--text-subtle)' }}>{error || hint}</span>
      )}
    </div>
  );
}
