import React from 'react';

/**
 * Homa Doodle, small hand-drawn decorative shapes scattered like margin
 * stickers: star, heart, sun, sparkle, squiggle. Decoration only, never UI.
 */
export function Doodle({ name = 'star', size = 24, color = 'var(--pop-cobalt)', rotate = 0, style = {} }) {
  const fills = {
    star: <path d="M12 1 C13.1 8.2 15.8 10.9 23 12 C15.8 13.1 13.1 15.8 12 23 C10.9 15.8 8.2 13.1 1 12 C8.2 10.9 10.9 8.2 12 1 Z" fill={color} />,
    heart: <path d="M12 21.5 C5.4 16 2.5 12.2 2.5 8.6 C2.5 5.8 4.7 3.8 7.2 3.8 C9.1 3.8 10.9 4.9 12 6.7 C13.1 4.9 14.9 3.8 16.8 3.8 C19.3 3.8 21.5 5.8 21.5 8.6 C21.5 12.2 18.6 16 12 21.5 Z" fill={color} />,
    sun: (
      <g stroke={color} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.2" fill={color} stroke="none" />
        <line x1="12" y1="1.5" x2="12" y2="4.5" /><line x1="12" y1="19.5" x2="12" y2="22.5" />
        <line x1="1.5" y1="12" x2="4.5" y2="12" /><line x1="19.5" y1="12" x2="22.5" y2="12" />
        <line x1="4.6" y1="4.6" x2="6.7" y2="6.7" /><line x1="17.3" y1="17.3" x2="19.4" y2="19.4" />
        <line x1="4.6" y1="19.4" x2="6.7" y2="17.3" /><line x1="17.3" y1="6.7" x2="19.4" y2="4.6" />
      </g>
    ),
    sparkle: (
      <g stroke={color} strokeWidth="2.4" strokeLinecap="round">
        <line x1="12" y1="2.5" x2="12" y2="21.5" /><line x1="2.5" y1="12" x2="21.5" y2="12" />
        <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" /><line x1="5.5" y1="18.5" x2="18.5" y2="5.5" />
      </g>
    ),
    squiggle: <path d="M2 14 Q5.5 7.5 9 12.5 T16 11.5 T22 8.5" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      style={{ display: 'inline-block', transform: rotate ? `rotate(${rotate}deg)` : 'none', flexShrink: 0, ...style }}>
      {fills[name] || fills.star}
    </svg>
  );
}
