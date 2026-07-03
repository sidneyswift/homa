import React from 'react';

/**
 * HOMA Icon, thin wrapper over Lucide (loaded from CDN). Renders an <i> that
 * lucide.createIcons() upgrades to an SVG. In this design system Lucide is the
 * canonical icon set: rounded joins, 1.75 stroke, friendly but precise.
 */
export function Icon({ name, size = 20, strokeWidth = 1.75, color = 'currentColor', style = {}, ...rest }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide && ref.current) {
      // Re-render just this node
      try { window.lucide.createIcons({ nameAttr: 'data-lucide', icons: window.lucide.icons }); } catch (e) {}
    }
  }, [name]);
  return (
    <i
      ref={ref}
      data-lucide={name}
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        color,
        strokeWidth,
        verticalAlign: 'middle',
        ...style,
      }}
      {...rest}
    />
  );
}
