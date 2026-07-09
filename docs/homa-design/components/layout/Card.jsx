import React from 'react';

/** SSR-safe CSS media-query subscription via useSyncExternalStore (server
 * snapshot is false, then swaps to the live value after hydration), so the
 * hover-lift can respect hover capability and reduced motion, the
 * emil-design-eng rules inline styles cannot express. */
function useMediaQuery(query) {
  const subscribe = React.useCallback((onChange) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  const getSnapshot = React.useCallback(() => window.matchMedia(query).matches, [query]);
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Homa Card, soft warm surface container. The workhorse of every layout.
 * The interactive hover-lift fires only on hover-capable devices (never on a
 * touch tap), and its translate is dropped under reduced motion while the
 * shadow depth cue stays.
 */
export function Card({ padding = 'md', interactive = false, elevated = false, children, onClick, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const lifted = interactive && hover && canHover;
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
        ...(lifted
          ? { boxShadow: 'var(--shadow-lg)', ...(reduceMotion ? {} : { transform: 'translateY(-2px)' }) }
          : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
