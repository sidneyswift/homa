import React from 'react';

/**
 * HOMA Input, text field with optional label, hint, error, and leading icon.
 */
export function Input({
  label,
  hint,
  error,
  iconLeft = null,
  size = 'md',
  disabled = false,
  value,
  onChange,
  placeholder,
  type = 'text',
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const sizes = {
    sm: { padding: '8px 12px', fontSize: '0.875rem', minHeight: 38 },
    md: { padding: '11px 14px', fontSize: '1rem', minHeight: 46 },
    lg: { padding: '14px 16px', fontSize: '1.0625rem', minHeight: 54 },
  };
  const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)', ...style }}>
      {label && (
        <label htmlFor={fieldId} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-body)' }}>
          {label}
        </label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxSizing: 'border-box',
          background: disabled ? 'var(--stone-100)' : 'var(--surface-card)',
          border: `1.5px solid ${error ? 'var(--danger)' : focus ? 'var(--clay-400)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)',
          padding: sizes[size].padding,
          minHeight: sizes[size].minHeight,
          boxShadow: focus ? 'var(--shadow-focus)' : 'none',
          transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
        }}
      >
        {iconLeft && <span style={{ color: 'var(--text-subtle)', display: 'inline-flex' }}>{iconLeft}</span>}
        <input
          id={fieldId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: sizes[size].fontSize,
            color: 'var(--text-strong)',
            minWidth: 0,
          }}
          {...rest}
        />
      </div>
      {(hint || error) && (
        <span style={{ fontSize: '0.8125rem', color: error ? 'var(--danger)' : 'var(--text-subtle)' }}>
          {error || hint}
        </span>
      )}
    </div>
  );
}
