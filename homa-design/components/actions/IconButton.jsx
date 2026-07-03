import React from 'react';

/**
 * HOMA IconButton, square/circular button holding a single Icon.
 */
export function IconButton({
  variant = 'ghost',
  size = 'md',
  round = true,
  disabled = false,
  onClick,
  ariaLabel,
  children,
  style = {},
  ...rest
}) {
  const sizes = { sm: 32, md: 40, lg: 48 };
  const dim = sizes[size];

  const variants = {
    ghost:   { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' },
    soft:    { background: 'var(--stone-100)', color: 'var(--text-body)', border: '1px solid transparent' },
    outline: { background: 'var(--surface-card)', color: 'var(--text-body)', border: '1px solid var(--border-default)' },
    primary: { background: 'var(--brand)', color: '#fff', border: '1px solid transparent' },
  };

  const hoverBg = {
    ghost: 'var(--stone-100)',
    soft: 'var(--stone-200)',
    outline: 'var(--stone-50)',
    primary: 'var(--brand-hover)',
  };

  const [hover, setHover] = React.useState(false);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim,
        height: dim,
        borderRadius: round ? 'var(--radius-pill)' : 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--dur-fast) var(--ease-out)',
        ...variants[variant],
        background: disabled ? variants[variant].background : (hover ? hoverBg[variant] : variants[variant].background),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
