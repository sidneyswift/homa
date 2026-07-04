import React from 'react';

/**
 * HOMA Card, soft warm surface container. The workhorse of every layout.
 */
export function Card({ padding = 'md', interactive = false, elevated = false, children, onClick, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const pads = { none: 0, sm: 'var(--space-4)', md: 'var(--space-6)', lg: 'var(--space-8)' };
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: pads[padding],
        boxShadow: elevated ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: 'box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
        cursor: interactive ? 'pointer' : 'default',
        ...(interactive && hover ? { boxShadow: 'var(--shadow-lg)', transform: 'translateY(-2px)' } : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
