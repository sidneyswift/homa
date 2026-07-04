import React from 'react';

/**
 * Homa Skeleton, warm shimmer placeholder while content loads.
 */
export function Skeleton({ width = '100%', height = 16, radius = 'var(--radius-sm)', style = {} }) {
  React.useEffect(() => {
    if (!document.getElementById('homa-skeleton-kf')) {
      const s = document.createElement('style');
      s.id = 'homa-skeleton-kf';
      s.textContent = '@keyframes homaShimmer{0%{background-position:120% 0}100%{background-position:-20% 0}}';
      document.head.appendChild(s);
    }
  }, []);
  return (
    <span aria-hidden="true" style={{
      display: 'block', width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--stone-100) 40%, var(--stone-200) 50%, var(--stone-100) 60%) 0 0 / 200% 100%',
      animation: 'homaShimmer 1.6s ease-in-out infinite',
      ...style,
    }} />
  );
}
