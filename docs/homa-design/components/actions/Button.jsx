import React from 'react';

/**
 * Homa Button, primary interactive element.
 * Variants: primary (clay), secondary (sage-outline), ghost, soft, danger.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  type = 'button',
  onClick,
  children,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: { padding: '8px 14px', fontSize: '0.875rem', gap: '6px', minHeight: 36 },
    md: { padding: '11px 20px', fontSize: '1rem', gap: '8px', minHeight: 44 },
    lg: { padding: '15px 28px', fontSize: '1.0625rem', gap: '10px', minHeight: 52 },
  };

  const variants = {
    primary: {
      background: 'var(--brand)',
      color: 'var(--on-brand)',
      border: '1px solid transparent',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--sage-700)',
      border: '1.5px solid var(--sage-300)',
    },
    soft: {
      background: 'var(--brand-soft)',
      color: 'var(--clay-700)',
      border: '1px solid transparent',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-body)',
      border: '1px solid transparent',
    },
    danger: {
      background: 'var(--danger)',
      color: '#fff',
      border: '1px solid transparent',
    },
  };

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizes[size].gap,
    fontFamily: 'var(--font-sans)',
    fontWeight: 700,
    fontSize: sizes[size].fontSize,
    lineHeight: 1,
    padding: sizes[size].padding,
    minHeight: sizes[size].minHeight,
    width: fullWidth ? '100%' : 'auto',
    borderRadius: 'var(--radius-pill)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
    whiteSpace: 'nowrap',
    ...variants[variant],
    ...style,
  };

  const hoverBg = {
    primary: 'var(--brand-hover)',
    secondary: 'var(--sage-50)',
    soft: 'var(--brand-soft-2)',
    ghost: 'var(--stone-100)',
    danger: 'var(--rose-600)',
  };

  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const [focus, setFocus] = React.useState(false);

  const dynamic = disabled ? {} : {
    background: hover ? hoverBg[variant] : base.background,
    transform: active ? 'scale(var(--press-scale))' : 'none',
    outline: 'none',
    boxShadow: focus ? 'var(--shadow-focus)' : 'none',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{ ...base, ...dynamic }}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
