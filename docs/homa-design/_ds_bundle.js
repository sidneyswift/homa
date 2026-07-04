/* @ds-bundle: {"format":4,"namespace":"HOMADesignSystem_113bd2","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"IconButton","sourcePath":"components/actions/IconButton.jsx"},{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"Avatar","sourcePath":"components/data-display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/data-display/Badge.jsx"},{"name":"ProgressBar","sourcePath":"components/data-display/ProgressBar.jsx"},{"name":"Callout","sourcePath":"components/feedback/Callout.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Chip","sourcePath":"components/forms/Chip.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Card","sourcePath":"components/layout/Card.jsx"},{"name":"Icon","sourcePath":"components/media/Icon.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"EmptyState","sourcePath":"components/states/EmptyState.jsx"},{"name":"Skeleton","sourcePath":"components/states/Skeleton.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"2a299fd2ed3d","components/actions/IconButton.jsx":"fcd54c8284ea","components/brand/Logo.jsx":"50a66d18e2bc","components/data-display/Avatar.jsx":"e1e9115f451b","components/data-display/Badge.jsx":"809e72b6ae74","components/data-display/ProgressBar.jsx":"7c795662f74f","components/feedback/Callout.jsx":"d458bcd6a38b","components/feedback/Dialog.jsx":"bcebdf00e408","components/feedback/Toast.jsx":"fe282413c927","components/forms/Checkbox.jsx":"16c7bcc5a8ba","components/forms/Chip.jsx":"aaa3008e11c1","components/forms/Input.jsx":"e4c4c289b084","components/forms/Radio.jsx":"362eb12e9614","components/forms/Select.jsx":"7e46a11c5938","components/forms/Switch.jsx":"3a95d7d452e8","components/forms/Textarea.jsx":"a07a39f398a4","components/layout/Card.jsx":"d24e6d2da82a","components/media/Icon.jsx":"43781948a0c5","components/navigation/Tabs.jsx":"a6786b409f67","components/states/EmptyState.jsx":"7a3277605318","components/states/Skeleton.jsx":"16634d88dd6a","ui_kits/landing/LandingPage.jsx":"1e89e706a31d","ui_kits/landing/image-slot.js":"ab557420166f","ui_kits/mobile-app/MobileApp.jsx":"14c7e11b1653","ui_kits/web-app/App.jsx":"851dafd03630","ui_kits/web-app/BenchmarksView.jsx":"4654a4a4b958","ui_kits/web-app/ChatView.jsx":"af4c6083aad5","ui_kits/web-app/CurriculumView.jsx":"7dd70e2c008b","ui_kits/web-app/DashboardView.jsx":"39d3e29b2007","ui_kits/web-app/DiscoverView.jsx":"6c0b07a18798","ui_kits/web-app/Onboarding.jsx":"68738f30c6fd","ui_kits/web-app/PlannerView.jsx":"3eca09c3a157","ui_kits/web-app/Sidebar.jsx":"b9c3681e3125"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.HOMADesignSystem_113bd2 = window.HOMADesignSystem_113bd2 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * HOMA Button, primary interactive element.
 * Variants: primary (clay), secondary (sage-outline), ghost, soft, danger.
 */
function Button({
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
    sm: {
      padding: '8px 14px',
      fontSize: '0.875rem',
      gap: '6px',
      minHeight: 36
    },
    md: {
      padding: '11px 20px',
      fontSize: '1rem',
      gap: '8px',
      minHeight: 44
    },
    lg: {
      padding: '15px 28px',
      fontSize: '1.0625rem',
      gap: '10px',
      minHeight: 52
    }
  };
  const variants = {
    primary: {
      background: 'var(--brand)',
      color: 'var(--on-brand)',
      border: '1px solid transparent'
    },
    secondary: {
      background: 'transparent',
      color: 'var(--sage-700)',
      border: '1.5px solid var(--sage-300)'
    },
    soft: {
      background: 'var(--brand-soft)',
      color: 'var(--clay-700)',
      border: '1px solid transparent'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-body)',
      border: '1px solid transparent'
    },
    danger: {
      background: 'var(--danger)',
      color: '#fff',
      border: '1px solid transparent'
    }
  };
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizes[size].gap,
    fontFamily: 'var(--font-sans)',
    fontWeight: 'var(--weight-semibold)',
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
    ...style
  };
  const hoverBg = {
    primary: 'var(--brand-hover)',
    secondary: 'var(--sage-50)',
    soft: 'var(--brand-soft-2)',
    ghost: 'var(--stone-100)',
    danger: 'var(--rose-600)'
  };
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  const dynamic = disabled ? {} : {
    background: hover ? hoverBg[variant] : base.background,
    transform: active ? 'scale(var(--press-scale))' : 'none',
    outline: 'none',
    boxShadow: focus ? 'var(--shadow-focus)' : 'none'
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      ...base,
      ...dynamic
    }
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/actions/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * HOMA IconButton, square/circular button holding a single Icon.
 */
function IconButton({
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
  const sizes = {
    sm: 32,
    md: 40,
    lg: 48
  };
  const dim = sizes[size];
  const variants = {
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)',
      border: '1px solid transparent'
    },
    soft: {
      background: 'var(--stone-100)',
      color: 'var(--text-body)',
      border: '1px solid transparent'
    },
    outline: {
      background: 'var(--surface-card)',
      color: 'var(--text-body)',
      border: '1px solid var(--border-default)'
    },
    primary: {
      background: 'var(--brand)',
      color: '#fff',
      border: '1px solid transparent'
    }
  };
  const hoverBg = {
    ghost: 'var(--stone-100)',
    soft: 'var(--stone-200)',
    outline: 'var(--stone-50)',
    primary: 'var(--brand-hover)'
  };
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": ariaLabel,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
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
      background: disabled ? variants[variant].background : hover ? hoverBg[variant] : variants[variant].background,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/brand/Logo.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * HOMA logo, "The bright home" mark (a home with a spark of magic inside)
 * paired with the Newsreader wordmark. Single source of truth for the brand
 * lockup across every surface.
 */
function Logo({
  size = 32,
  variant = 'full',
  tone = 'light',
  treatment = 'line',
  style = {},
  ...rest
}) {
  // tone = the BACKGROUND the logo sits on.
  const onDark = tone === 'dark';
  const duo = treatment === 'duo';
  const stroke = onDark ? 'var(--clay-400)' : 'var(--brand)';
  const spark = duo ? onDark ? 'var(--gold-400)' : 'var(--gold-500)' : onDark ? 'var(--gold-400)' : 'var(--brand)';
  const houseFill = duo ? onDark ? 'rgba(224,144,108,0.16)' : 'var(--clay-50)' : 'none';
  const word = onDark ? '#FFFFFF' : 'var(--text-strong)';
  const mark = /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: stroke,
    strokeWidth: "3",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    style: {
      display: 'block',
      flexShrink: 0
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M9 22 L24 9 L39 22 V37 A2 2 0 0 1 37 39 H11 A2 2 0 0 1 9 37 Z",
    fill: houseFill
  }), /*#__PURE__*/React.createElement("path", {
    d: "M24 20 C24.7 25 25.5 25.8 30 26.5 C25.5 27.2 24.7 28 24 33 C23.3 28 22.5 27.2 18 26.5 C22.5 25.8 23.3 25 24 20 Z",
    fill: spark,
    stroke: "none"
  }));
  if (variant === 'mark') {
    return /*#__PURE__*/React.createElement("span", _extends({
      role: "img",
      "aria-label": "HOMA",
      style: {
        display: 'inline-flex',
        ...style
      }
    }, rest), mark);
  }
  return /*#__PURE__*/React.createElement("span", _extends({
    role: "img",
    "aria-label": "HOMA",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: size * 0.34,
      ...style
    }
  }, rest), mark, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: size * 0.92,
      lineHeight: 1,
      letterSpacing: '0.005em',
      color: word
    }
  }, "HOMA"));
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Avatar.jsx
try { (() => {
/**
 * HOMA Avatar, circular initials/photo. Warm auto-color from name.
 */
function Avatar({
  name = '',
  src = null,
  size = 40,
  tone,
  style = {}
}) {
  const palette = ['var(--clay-400)', 'var(--sage-500)', 'var(--gold-500)', 'var(--sky-500)', 'var(--clay-500)'];
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const idx = name.length % palette.length;
  const bg = tone || palette[idx];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      background: src ? 'transparent' : bg,
      color: '#fff',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      fontWeight: 700,
      fontSize: size * 0.4,
      border: '2px solid var(--surface-card)',
      boxShadow: 'var(--shadow-xs)',
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Badge.jsx
try { (() => {
/**
 * HOMA Badge, small status/label pill.
 */
function Badge({
  tone = 'neutral',
  variant = 'soft',
  children,
  iconLeft = null,
  style = {}
}) {
  const tones = {
    neutral: {
      soft: ['var(--stone-100)', 'var(--stone-700)'],
      solid: ['var(--stone-700)', '#fff']
    },
    brand: {
      soft: ['var(--clay-50)', 'var(--clay-700)'],
      solid: ['var(--brand)', '#fff']
    },
    sage: {
      soft: ['var(--sage-50)', 'var(--sage-700)'],
      solid: ['var(--sage-600)', '#fff']
    },
    gold: {
      soft: ['var(--gold-100)', '#8a6410'],
      solid: ['var(--gold-500)', '#402e05']
    },
    success: {
      soft: ['var(--success-soft)', 'var(--sage-700)'],
      solid: ['var(--success)', '#fff']
    },
    warning: {
      soft: ['var(--warning-soft)', '#8a6410'],
      solid: ['var(--warning)', '#402e05']
    },
    danger: {
      soft: ['var(--danger-soft)', 'var(--rose-600)'],
      solid: ['var(--danger)', '#fff']
    },
    info: {
      soft: ['var(--info-soft)', 'var(--sky-600)'],
      solid: ['var(--info)', '#fff']
    }
  };
  const [bg, fg] = tones[tone][variant];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: bg,
      color: fg,
      fontFamily: 'var(--font-sans)',
      fontSize: '0.75rem',
      fontWeight: 600,
      padding: '4px 10px',
      borderRadius: 'var(--radius-pill)',
      letterSpacing: '0.01em',
      whiteSpace: 'nowrap',
      ...style
    }
  }, iconLeft, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data-display/ProgressBar.jsx
try { (() => {
/**
 * HOMA ProgressBar, rounded track, clay/sage fill. Optional label + value.
 */
function ProgressBar({
  value = 0,
  max = 100,
  tone = 'brand',
  label,
  showValue = false,
  size = 'md',
  style = {}
}) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  const fills = {
    brand: 'var(--brand)',
    sage: 'var(--sage-500)',
    gold: 'var(--gold-500)',
    info: 'var(--info)'
  };
  const h = {
    sm: 6,
    md: 10,
    lg: 14
  }[size];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, (label || showValue) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 6,
      fontSize: '0.8125rem'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)',
      fontWeight: 600
    }
  }, label), showValue && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-subtle)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, Math.round(pct), "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: h,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--stone-200)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: pct + '%',
      height: '100%',
      borderRadius: 'var(--radius-pill)',
      background: fills[tone],
      transition: 'width var(--dur-slow) var(--ease-out)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Callout.jsx
try { (() => {
/**
 * HOMA Callout, inline banner for tips, notes, and HOMA suggestions.
 */
function Callout({
  tone = 'brand',
  title,
  icon = null,
  children,
  style = {}
}) {
  const tones = {
    brand: ['var(--clay-50)', 'var(--clay-200)', 'var(--clay-700)'],
    sage: ['var(--sage-50)', 'var(--sage-200)', 'var(--sage-700)'],
    gold: ['var(--gold-100)', 'var(--gold-300)', '#8a6410'],
    info: ['var(--info-soft)', 'var(--sky-300)', 'var(--sky-600)'],
    warning: ['var(--warning-soft)', 'var(--gold-300)', '#8a6410'],
    danger: ['var(--danger-soft)', 'var(--rose-500)', 'var(--rose-600)']
  };
  const [bg, border, fg] = tones[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4) var(--space-5)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      color: fg,
      display: 'inline-flex',
      flexShrink: 0,
      marginTop: 1
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: fg,
      marginBottom: 2,
      fontSize: '0.9375rem'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-body)',
      fontSize: '0.9375rem',
      lineHeight: 'var(--leading-normal)'
    }
  }, children)));
}
Object.assign(__ds_scope, { Callout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Callout.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
/**
 * HOMA Dialog, centered modal over a warm scrim.
 */
function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
  style = {}
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(51, 42, 33, 0.42)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-xl)',
      width,
      maxWidth: '100%',
      maxHeight: '90vh',
      overflow: 'auto',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-6) var(--space-6) var(--space-4)'
    }
  }, title && /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontSize: '1.5rem',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--space-6)',
      color: 'var(--text-body)',
      lineHeight: 'var(--leading-normal)'
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10,
      padding: 'var(--space-6)'
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
/**
 * HOMA Toast, quiet confirmation pill, fixed bottom-center.
 */
function Toast({
  open = true,
  message,
  icon = null,
  action,
  onAction,
  tone = 'dark',
  inline = false,
  style = {}
}) {
  if (!open) return null;
  const dark = tone === 'dark';
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      position: inline ? 'static' : 'fixed',
      left: inline ? 'auto' : '50%',
      bottom: inline ? 'auto' : 28,
      transform: inline ? 'none' : 'translateX(-50%)',
      zIndex: 1100,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      background: dark ? 'var(--stone-900)' : 'var(--surface-card)',
      color: dark ? 'var(--stone-50)' : 'var(--text-body)',
      border: dark ? 'none' : '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-pill)',
      padding: '12px 20px',
      boxShadow: 'var(--shadow-lg)',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.925rem',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      ...style
    }
  }, icon, /*#__PURE__*/React.createElement("span", null, message), action && /*#__PURE__*/React.createElement("button", {
    onClick: onAction,
    style: {
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      padding: 0,
      marginLeft: 6,
      color: dark ? 'var(--gold-400)' : 'var(--brand)',
      fontWeight: 700,
      fontFamily: 'inherit',
      fontSize: 'inherit'
    }
  }, action));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
/**
 * HOMA Checkbox, soft rounded box with clay check when selected.
 */
function Checkbox({
  checked = false,
  onChange,
  label,
  disabled = false,
  id,
  style = {}
}) {
  const fieldId = id || (label ? 'cb-' + label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: 'var(--font-sans)',
      fontSize: '0.9375rem',
      color: 'var(--text-body)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 22,
      height: 22,
      flexShrink: 0,
      borderRadius: 'var(--radius-xs)',
      border: `1.5px solid ${checked ? 'var(--brand)' : 'var(--border-strong)'}`,
      background: checked ? 'var(--brand)' : 'var(--surface-card)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all var(--dur-fast) var(--ease-out)'
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "3.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), label && /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("input", {
    id: fieldId,
    type: "checkbox",
    checked: checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Chip.jsx
try { (() => {
/**
 * HOMA Chip, selectable/removable pill. Great for subjects & filters.
 */
function Chip({
  children,
  selected = false,
  onClick,
  onRemove,
  iconLeft = null,
  style = {}
}) {
  const [hover, setHover] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    onClick: onClick,
    role: onClick ? 'button' : undefined,
    tabIndex: onClick ? 0 : undefined,
    onKeyDown: e => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick();
      }
    },
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-sans)',
      fontSize: '0.875rem',
      fontWeight: 600,
      padding: '7px 14px',
      borderRadius: 'var(--radius-pill)',
      cursor: onClick ? 'pointer' : 'default',
      background: selected ? 'var(--brand)' : hover && onClick ? 'var(--stone-100)' : 'var(--surface-card)',
      color: selected ? '#fff' : 'var(--text-body)',
      border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--border-default)'}`,
      outline: 'none',
      boxShadow: focus ? 'var(--shadow-focus)' : 'none',
      transition: 'all var(--dur-fast) var(--ease-out)',
      ...style
    }
  }, iconLeft, children, onRemove && /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      onRemove();
    },
    style: {
      display: 'inline-flex',
      marginRight: -4,
      opacity: 0.7
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  }))));
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Chip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * HOMA Input, text field with optional label, hint, error, and leading icon.
 */
function Input({
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
    sm: {
      padding: '8px 12px',
      fontSize: '0.875rem',
      minHeight: 38
    },
    md: {
      padding: '11px 14px',
      fontSize: '1rem',
      minHeight: 46
    },
    lg: {
      padding: '14px 16px',
      fontSize: '1.0625rem',
      minHeight: 54
    }
  };
  const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontSize: '0.875rem',
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
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
      transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)'
    }
  }, iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-subtle)',
      display: 'inline-flex'
    }
  }, iconLeft), /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: 'inherit',
      fontSize: sizes[size].fontSize,
      color: 'var(--text-strong)',
      minWidth: 0
    }
  }, rest))), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.8125rem',
      color: error ? 'var(--danger)' : 'var(--text-subtle)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
/**
 * HOMA Radio group, pick one. Renders a set of options.
 */
function Radio({
  options = [],
  value,
  onChange,
  name = 'radio',
  disabled = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, options.map(opt => {
    const val = typeof opt === 'string' ? opt : opt.value;
    const lbl = typeof opt === 'string' ? opt : opt.label;
    const selected = value === val;
    return /*#__PURE__*/React.createElement("label", {
      key: val,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontSize: '0.9375rem',
        color: 'var(--text-body)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 22,
        height: 22,
        flexShrink: 0,
        borderRadius: '50%',
        border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--border-strong)'}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all var(--dur-fast) var(--ease-out)'
      }
    }, selected && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 11,
        height: 11,
        borderRadius: '50%',
        background: 'var(--brand)'
      }
    })), /*#__PURE__*/React.createElement("span", null, lbl), /*#__PURE__*/React.createElement("input", {
      type: "radio",
      name: name,
      checked: selected,
      disabled: disabled,
      onChange: () => onChange && onChange(val),
      style: {
        position: 'absolute',
        opacity: 0,
        width: 0,
        height: 0
      }
    }));
  }));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
/**
 * HOMA Select, styled native select with chevron.
 */
function Select({
  label,
  hint,
  options = [],
  value,
  onChange,
  disabled = false,
  id,
  placeholder,
  style = {}
}) {
  const [focus, setFocus] = React.useState(false);
  const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontSize: '0.875rem',
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("select", {
    id: fieldId,
    value: value,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: 'none',
      WebkitAppearance: 'none',
      width: '100%',
      fontFamily: 'inherit',
      fontSize: '1rem',
      color: 'var(--text-strong)',
      background: disabled ? 'var(--stone-100)' : 'var(--surface-card)',
      border: `1.5px solid ${focus ? 'var(--clay-400)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '11px 40px 11px 14px',
      minHeight: 46,
      cursor: disabled ? 'not-allowed' : 'pointer',
      outline: 'none',
      boxShadow: focus ? 'var(--shadow-focus)' : 'none',
      transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)'
    }
  }, placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), options.map(opt => {
    const val = typeof opt === 'string' ? opt : opt.value;
    const lbl = typeof opt === 'string' ? opt : opt.label;
    return /*#__PURE__*/React.createElement("option", {
      key: val,
      value: val
    }, lbl);
  })), /*#__PURE__*/React.createElement("svg", {
    style: {
      position: 'absolute',
      right: 14,
      pointerEvents: 'none'
    },
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-subtle)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  }))), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.8125rem',
      color: 'var(--text-subtle)'
    }
  }, hint));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
/**
 * HOMA Switch, pill toggle, clay when on.
 */
function Switch({
  checked = false,
  onChange,
  label,
  disabled = false,
  size = 'md',
  style = {}
}) {
  const dims = {
    sm: {
      w: 38,
      h: 22,
      k: 16
    },
    md: {
      w: 46,
      h: 26,
      k: 20
    }
  }[size];
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: 'var(--font-sans)',
      fontSize: '0.9375rem',
      color: 'var(--text-body)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: dims.w,
      height: dims.h,
      flexShrink: 0,
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--brand)' : 'var(--stone-300)',
      position: 'relative',
      transition: 'background var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: checked ? dims.w - dims.k - 3 : 3,
      width: dims.k,
      height: dims.k,
      borderRadius: '50%',
      background: '#fff',
      boxShadow: 'var(--shadow-sm)',
      transition: 'left var(--dur-base) var(--ease-out)'
    }
  })), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * HOMA Textarea, multi-line field, auto-styled to match Input.
 */
function Textarea({
  label,
  hint,
  error,
  rows = 4,
  disabled = false,
  value,
  onChange,
  placeholder,
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontSize: '0.875rem',
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, label), /*#__PURE__*/React.createElement("textarea", _extends({
    id: fieldId,
    rows: rows,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
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
      transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)'
    }
  }, rest)), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.8125rem',
      color: error ? 'var(--danger)' : 'var(--text-subtle)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/layout/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * HOMA Card, soft warm surface container. The workhorse of every layout.
 */
function Card({
  padding = 'md',
  interactive = false,
  elevated = false,
  children,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const pads = {
    none: 0,
    sm: 'var(--space-4)',
    md: 'var(--space-6)',
    lg: 'var(--space-8)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: pads[padding],
      boxShadow: elevated ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      transition: 'box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
      cursor: interactive ? 'pointer' : 'default',
      ...(interactive && hover ? {
        boxShadow: 'var(--shadow-lg)',
        transform: 'translateY(-2px)'
      } : {}),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Card.jsx", error: String((e && e.message) || e) }); }

// components/media/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * HOMA Icon, thin wrapper over Lucide (loaded from CDN). Renders an <i> that
 * lucide.createIcons() upgrades to an SVG. In this design system Lucide is the
 * canonical icon set: rounded joins, 1.75 stroke, friendly but precise.
 */
function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  color = 'currentColor',
  style = {},
  ...rest
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide && ref.current) {
      // Re-render just this node
      try {
        window.lucide.createIcons({
          nameAttr: 'data-lucide',
          icons: window.lucide.icons
        });
      } catch (e) {}
    }
  }, [name]);
  return /*#__PURE__*/React.createElement("i", _extends({
    ref: ref,
    "data-lucide": name,
    style: {
      display: 'inline-flex',
      width: size,
      height: size,
      color,
      strokeWidth,
      verticalAlign: 'middle',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/media/Icon.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/**
 * HOMA Tabs, underline tab bar. Controlled via value/onChange.
 */
function Tabs({
  tabs = [],
  value,
  onChange,
  style = {}
}) {
  const [focused, setFocused] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1.5px solid var(--border-subtle)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, tabs.map(t => {
    const val = typeof t === 'string' ? t : t.value;
    const lbl = typeof t === 'string' ? t : t.label;
    const active = value === val;
    return /*#__PURE__*/React.createElement("button", {
      key: val,
      role: "tab",
      "aria-selected": active,
      onClick: () => onChange && onChange(val),
      onFocus: () => setFocused(val),
      onBlur: () => setFocused(null),
      style: {
        appearance: 'none',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: '12px 16px',
        fontFamily: 'inherit',
        fontSize: '0.9375rem',
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--brand)' : 'var(--text-muted)',
        borderBottom: `2.5px solid ${active ? 'var(--brand)' : 'transparent'}`,
        marginBottom: -1.5,
        outline: 'none',
        boxShadow: focused === val ? 'var(--shadow-focus)' : 'none',
        borderRadius: focused === val ? 'var(--radius-xs)' : 0,
        transition: 'color var(--dur-fast) var(--ease-out)'
      }
    }, lbl);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/states/EmptyState.jsx
try { (() => {
/**
 * HOMA EmptyState, a warm invitation, never a dead end.
 */
function EmptyState({
  icon = null,
  title,
  body,
  action = null,
  hand,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: 'var(--space-10) var(--space-6)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: 'var(--brand-soft)',
      color: 'var(--brand)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.35rem',
      fontWeight: 500,
      color: 'var(--text-strong)',
      letterSpacing: '-0.01em'
    }
  }, title), body && /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-muted)',
      maxWidth: 400,
      lineHeight: 1.55,
      marginTop: 8,
      fontSize: '0.95rem'
    }
  }, body), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, action), hand && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-hand)',
      fontSize: '1.5rem',
      color: 'var(--sage-600)',
      marginTop: 16,
      lineHeight: 1
    }
  }, hand));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/states/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/states/Skeleton.jsx
try { (() => {
/**
 * HOMA Skeleton, warm shimmer placeholder while content loads.
 */
function Skeleton({
  width = '100%',
  height = 16,
  radius = 'var(--radius-sm)',
  style = {}
}) {
  React.useEffect(() => {
    if (!document.getElementById('homa-skeleton-kf')) {
      const s = document.createElement('style');
      s.id = 'homa-skeleton-kf';
      s.textContent = '@keyframes homaShimmer{0%{background-position:120% 0}100%{background-position:-20% 0}}';
      document.head.appendChild(s);
    }
  }, []);
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'block',
      width,
      height,
      borderRadius: radius,
      background: 'linear-gradient(90deg, var(--stone-100) 40%, var(--stone-200) 50%, var(--stone-100) 60%) 0 0 / 200% 100%',
      animation: 'homaShimmer 1.6s ease-in-out infinite',
      ...style
    }
  });
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/states/Skeleton.jsx", error: String((e && e.message) || e) }); }

// ui_kits/landing/LandingPage.jsx
try { (() => {
// HOMA marketing landing page.
const {
  Button: LButton,
  Icon: LIcon,
  Card: LCard,
  Badge: LBadge,
  Avatar: LAvatar,
  Logo: LLogo
} = window.HOMADesignSystem_113bd2;
function Wordmark({
  light
}) {
  return /*#__PURE__*/React.createElement(LLogo, {
    size: 28,
    tone: light ? 'dark' : 'light'
  });
}
function Nav() {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      gap: 32,
      padding: '18px 40px',
      background: 'rgba(251,247,240,0.85)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement(Wordmark, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 28,
      marginLeft: 20
    }
  }, ['How it works', 'Features', 'Pricing', 'Stories'].map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      color: 'var(--text-muted)',
      textDecoration: 'none',
      fontWeight: 500,
      fontSize: '0.95rem'
    }
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: 'var(--text-body)',
      textDecoration: 'none',
      fontWeight: 600,
      fontSize: '0.95rem'
    }
  }, "Sign in"), /*#__PURE__*/React.createElement(LButton, {
    variant: "primary"
  }, "Start free")));
}
function Hero() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.05fr 1fr',
      gap: 48,
      alignItems: 'center',
      padding: '72px 40px 60px',
      maxWidth: 1200,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'var(--clay-50)',
      color: 'var(--clay-700)',
      padding: '6px 14px',
      borderRadius: 'var(--radius-pill)',
      fontWeight: 600,
      fontSize: '0.85rem'
    }
  }, /*#__PURE__*/React.createElement(LIcon, {
    name: "sparkles",
    size: 15
  }), " In your corner, every school day"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '3.6rem',
      fontWeight: 500,
      lineHeight: 1.02,
      letterSpacing: '-0.025em',
      color: 'var(--text-strong)',
      margin: '20px 0 0'
    }
  }, "You\u2019ve got this.", /*#__PURE__*/React.createElement("br", null), "HOMA\u2019s got the ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--clay-600)',
      fontStyle: 'italic',
      fontWeight: 400
    }
  }, "rest"), "."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '1.2rem',
      color: 'var(--text-muted)',
      lineHeight: 1.55,
      margin: '22px 0 0',
      maxWidth: 470
    }
  }, "The planning, the tracking, the what-do-we-do-today, hand it to HOMA. You get back to the part only you can do."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 30
    }
  }, /*#__PURE__*/React.createElement(LButton, {
    variant: "primary",
    size: "lg",
    iconRight: /*#__PURE__*/React.createElement(LIcon, {
      name: "arrow-right",
      size: 18,
      color: "#fff"
    })
  }, "Start free for 14 days"), /*#__PURE__*/React.createElement(LButton, {
    variant: "secondary",
    size: "lg",
    iconLeft: /*#__PURE__*/React.createElement(LIcon, {
      name: "play",
      size: 16
    })
  }, "Watch demo")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 22,
      color: 'var(--text-subtle)',
      fontSize: '0.9rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, ['Ana M', 'Dana K', 'Priya S', 'Lena R'].map((n, i) => /*#__PURE__*/React.createElement("span", {
    key: n,
    style: {
      marginLeft: i ? -10 : 0
    }
  }, /*#__PURE__*/React.createElement(LAvatar, {
    name: n,
    size: 30
  })))), "Loved by 12,000+ homeschooling families")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("image-slot", {
    id: "homa-hero",
    style: {
      width: '100%',
      height: 440
    },
    shape: "rounded",
    radius: "24",
    placeholder: "Drop a warm family / learning photo"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -22,
      right: 18,
      fontFamily: 'var(--font-hand)',
      fontSize: '2.4rem',
      color: 'var(--sage-600)',
      transform: 'rotate(-7deg)',
      lineHeight: 1
    }
  }, "you\u2019ve got this \u2726")));
}
function Features() {
  const items = [['clipboard-check', 'Know where they stand', 'A gentle skills checklist, for you, never a test for them, mapped to your state\'s standards.'], ['chart-line', 'Proof it\'s working', 'Watch HOMA\'s practice sets move the numbers. Math up 12 points since April, that kind of proof.'], ['file-pen', 'Practice that targets', 'Workbook pages and sensory activities tuned to exactly what each child is growing through.'], ['calendar-heart', 'Plans that flex', 'Tell HOMA how your week looks and she builds a schedule around real life, sick days, field trips, and all.'], ['compass', 'Your town, in the plan', 'Space week? There\'s a planetarium day Saturday. Museums, story hours, zoos, and co-ops, matched to your lessons.'], ['scale', 'Compare curriculums', 'Side-by-side, in plain language, against how your child actually learns, before you spend a dime.']];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '60px 40px',
      maxWidth: 1200,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 44
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.8rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--brand)'
    }
  }, "Everything in one place"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2.4rem',
      fontWeight: 600,
      color: 'var(--text-strong)',
      margin: '8px 0 0'
    }
  }, "Less admin. More teaching.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 20
    }
  }, items.map(([ic, t, d]) => /*#__PURE__*/React.createElement(LCard, {
    key: t,
    padding: "lg"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 'var(--radius-md)',
      background: 'var(--clay-50)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(LIcon, {
    name: ic,
    size: 24,
    color: "var(--brand)"
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.3rem',
      fontWeight: 600,
      color: 'var(--text-strong)',
      margin: '16px 0 6px'
    }
  }, t), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-muted)',
      lineHeight: 1.55,
      margin: 0,
      fontSize: '0.98rem'
    }
  }, d)))));
}
function HowItWorks() {
  const steps = [['1', 'Add your kids', 'Tell HOMA their ages, grades, and what you want to cover this year.'], ['2', 'Get your week', 'HOMA drafts a balanced weekly plan. Tweak anything with a tap or a message.'], ['3', 'Teach & track', 'Check off lessons, and watch progress fill in across every subject.']];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--bg-page-warm)',
      padding: '64px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1000,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2.4rem',
      fontWeight: 600,
      color: 'var(--text-strong)',
      textAlign: 'center',
      margin: '0 0 44px'
    }
  }, "Up and running in an afternoon"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 32
    }
  }, steps.map(([n, t, d]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: 'var(--brand)',
      color: '#fff',
      fontFamily: 'var(--font-display)',
      fontSize: '1.5rem',
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 16px'
    }
  }, n), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.3rem',
      fontWeight: 600,
      color: 'var(--text-strong)',
      margin: '0 0 8px'
    }
  }, t), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-muted)',
      lineHeight: 1.55,
      margin: 0
    }
  }, d))))));
}
function Quote() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '72px 40px',
      maxWidth: 820,
      margin: '0 auto',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(LIcon, {
    name: "quote",
    size: 36,
    color: "var(--clay-300)"
  }), /*#__PURE__*/React.createElement("blockquote", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2rem',
      fontWeight: 500,
      lineHeight: 1.35,
      color: 'var(--text-strong)',
      margin: '18px 0 24px'
    }
  }, "\u201CI was drowning in printables and half-made plans. HOMA gave me a calm week, every week, and my kids are further ahead than ever.\u201D"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(LAvatar, {
    name: "Priya Shah",
    size: 48
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, "Priya Shah"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-subtle)',
      fontSize: '0.9rem'
    }
  }, "Homeschooling 3 \xB7 Austin, TX"))));
}
function Pricing() {
  const tiers = [['Solo', '$9', '/mo', 'For one learner', ['1 child', 'Weekly planning', 'Progress tracking', 'Worksheet generator'], false], ['Family', '$19', '/mo', 'Most popular', ['Up to 5 children', 'Everything in Solo', 'Standards benchmarking', 'Priority support'], true], ['Co-op', '$39', '/mo', 'For groups', ['Unlimited children', 'Shared plans', 'Group reporting', 'Admin tools'], false]];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '60px 40px 80px',
      maxWidth: 1100,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2.4rem',
      fontWeight: 600,
      color: 'var(--text-strong)',
      textAlign: 'center',
      margin: '0 0 40px'
    }
  }, "Simple, family-friendly pricing"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 20,
      alignItems: 'start'
    }
  }, tiers.map(([name, price, per, tag, feats, hot]) => /*#__PURE__*/React.createElement("div", {
    key: name,
    style: {
      background: hot ? 'var(--brand)' : 'var(--surface-card)',
      border: hot ? 'none' : '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: 28,
      boxShadow: hot ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
      transform: hot ? 'scale(1.03)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: '1.1rem',
      color: hot ? '#fff' : 'var(--text-strong)'
    }
  }, name), hot && /*#__PURE__*/React.createElement(LBadge, {
    tone: "gold",
    variant: "solid"
  }, tag), !hot && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--text-subtle)'
    }
  }, tag)), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '18px 0',
      display: 'flex',
      alignItems: 'baseline',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '3rem',
      fontWeight: 600,
      color: hot ? '#fff' : 'var(--text-strong)'
    }
  }, price), /*#__PURE__*/React.createElement("span", {
    style: {
      color: hot ? 'rgba(255,255,255,0.85)' : 'var(--text-subtle)'
    }
  }, per)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginBottom: 22
    }
  }, feats.map(f => /*#__PURE__*/React.createElement("div", {
    key: f,
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      color: hot ? 'rgba(255,255,255,0.95)' : 'var(--text-body)',
      fontSize: '0.95rem'
    }
  }, /*#__PURE__*/React.createElement(LIcon, {
    name: "check",
    size: 17,
    color: hot ? '#fff' : 'var(--sage-600)'
  }), " ", f))), /*#__PURE__*/React.createElement(LButton, {
    variant: hot ? 'soft' : 'secondary',
    fullWidth: true
  }, "Choose ", name)))));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--stone-900)',
      color: 'var(--stone-300)',
      padding: '56px 40px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Wordmark, {
    light: true
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 14,
      maxWidth: 260,
      lineHeight: 1.55,
      fontSize: '0.92rem',
      color: 'var(--stone-400)'
    }
  }, "The calm, capable co-pilot for homeschooling families.")), [['Product', ['Features', 'Pricing', 'Worksheets', 'Mobile app']], ['Company', ['About', 'Blog', 'Careers', 'Contact']], ['Support', ['Help center', 'Community', 'Privacy', 'Terms']]].map(([h, links]) => /*#__PURE__*/React.createElement("div", {
    key: h
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#fff',
      fontWeight: 700,
      marginBottom: 12,
      fontSize: '0.95rem'
    }
  }, h), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      color: 'var(--stone-400)',
      textDecoration: 'none',
      fontSize: '0.9rem'
    }
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: '32px auto 0',
      paddingTop: 20,
      borderTop: '1px solid var(--stone-700)',
      fontSize: '0.85rem',
      color: 'var(--stone-500)'
    }
  }, "\xA9 2026 HOMA. Made for families who teach."));
}
function LandingPage() {
  React.useEffect(() => {
    setTimeout(() => window.lucide && window.lucide.createIcons(), 80);
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-page)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement(Nav, null), /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(Features, null), /*#__PURE__*/React.createElement(HowItWorks, null), /*#__PURE__*/React.createElement(Quote, null), /*#__PURE__*/React.createElement(Pricing, null), /*#__PURE__*/React.createElement(Footer, null));
}
Object.assign(window, {
  LandingPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/landing/LandingPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/landing/image-slot.js
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
/* BEGIN USAGE */
/**
 * <image-slot>, user-fillable image placeholder.
 *
 * Drop this into a deck, mockup, or page wherever you want the user to
 * supply an image. You control the slot's shape and size; the user fills it
 * by dragging an image file onto it (or clicking to browse). The dropped
 * image persists across reloads via a .image-slots.state.json sidecar,
 * same read-via-fetch / write-via-window.omelette pattern as
 * design_canvas.jsx, so the filled slot shows on share links, downloaded
 * zips, and PPTX export. Outside the omelette runtime the slot is read-only.
 *
 * The host bridge only allows sidecar writes at the project root, so the
 * HTML that uses this component is assumed to live at the project root too
 * (same constraint as design_canvas.jsx).
 *
 * Attributes:
 *   id           Persistence key. REQUIRED for the drop to survive reload,
 *                every slot on the page needs a distinct id.
 *   shape        'rect' | 'rounded' | 'circle' | 'pill'   (default 'rounded')
 *                'circle' applies 50% border-radius; on a non-square slot
 *                that's an ellipse, set equal width and height for a true
 *                circle.
 *   radius       Corner radius in px for 'rounded'.       (default 12)
 *   mask         Any CSS clip-path value. Overrides `shape`, use this for
 *                hexagons, blobs, arbitrary polygons.
 *   fit          object-fit: cover | contain | fill.       (default 'cover')
 *                With cover (the default) double-clicking the filled slot
 *                enters a reframe mode: the whole image spills past the mask
 *                (translucent outside, opaque inside), drag to reposition,
 *                corner-drag to scale. The crop persists alongside the image
 *                in the sidecar. contain/fill stay static.
 *   position     object-position for fit=contain|fill.     (default '50% 50%')
 *   placeholder  Empty-state caption.                      (default 'Drop an image')
 *   src          Optional initial/fallback image URL. A user drop overrides
 *                it; clearing the drop reveals src again.
 *
 * Size and layout come from ordinary CSS on the element, width/height
 * inline or from a parent grid, so it composes with any layout.
 *
 * Usage:
 *   <image-slot id="hero"   style="width:800px;height:450px" shape="rounded" radius="20"
 *               placeholder="Drop a hero image"></image-slot>
 *   <image-slot id="avatar" style="width:120px;height:120px" shape="circle"></image-slot>
 *   <image-slot id="kite"   style="width:300px;height:300px"
 *               mask="polygon(50% 0, 100% 50%, 50% 100%, 0 50%)"></image-slot>
 */
/* END USAGE */

(() => {
  const STATE_FILE = '.image-slots.state.json';
  // 2× a ~600px slot in a 1920-wide deck, retina-sharp without making the
  // sidecar enormous. A 1200px WebP at q=0.85 is ~150-300KB.
  const MAX_DIM = 1200;
  // Raster formats only. SVG is excluded (can carry script; createImageBitmap
  // on SVG blobs is inconsistent). GIF is excluded because the canvas
  // re-encode keeps only the first frame, so an animated GIF would silently
  // go still, better to reject than surprise.
  const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];

  // ── Shared sidecar store ────────────────────────────────────────────────
  // One fetch + immediate write-on-change for every <image-slot> on the
  // page. Reads via fetch() so viewing works anywhere the HTML and sidecar
  // are served together; writes go through window.omelette.writeFile, which
  // the host allowlists to *.state.json basenames only.
  const subs = new Set();
  let slots = {};
  // ids explicitly cleared before the sidecar fetch resolved, otherwise
  // the merge below can't tell "never set" from "just deleted" and would
  // resurrect the sidecar's stale value.
  const tombstones = new Set();
  let loaded = false;
  let loadP = null;
  function load() {
    if (loadP) return loadP;
    loadP = fetch(STATE_FILE).then(r => r.ok ? r.json() : null).then(j => {
      // Merge: sidecar loses to any in-memory change that raced ahead of
      // the fetch (drop or clear) so neither is clobbered by hydration.
      if (j && typeof j === 'object') {
        const merged = Object.assign({}, j, slots);
        // A framing-only write that raced ahead of hydration must not
        // drop a user image that's only on disk, inherit u from the
        // sidecar for any in-memory entry that lacks one.
        for (const k in slots) {
          if (merged[k] && !merged[k].u && j[k]) {
            merged[k].u = typeof j[k] === 'string' ? j[k] : j[k].u;
          }
        }
        for (const id of tombstones) delete merged[id];
        slots = merged;
      }
      tombstones.clear();
    }).catch(() => {}).then(() => {
      loaded = true;
      subs.forEach(fn => fn());
    });
    return loadP;
  }

  // Serialize writes so two near-simultaneous drops on different slots
  // can't reorder at the backend and leave the sidecar with only the
  // first. A save requested mid-flight just marks dirty and re-fires on
  // completion with the then-current slots.
  let saving = false;
  let saveDirty = false;
  function save() {
    if (saving) {
      saveDirty = true;
      return;
    }
    const w = window.omelette && window.omelette.writeFile;
    if (!w) return;
    saving = true;
    Promise.resolve(w(STATE_FILE, JSON.stringify(slots))).catch(() => {}).then(() => {
      saving = false;
      if (saveDirty) {
        saveDirty = false;
        save();
      }
    });
  }
  const S_MAX = 5;
  const clampS = s => Math.max(1, Math.min(S_MAX, s));

  // Normalize a stored slot value. Pre-reframe sidecars stored a bare
  // data-URL string; newer ones store {u, s, x, y}. Either shape is valid.
  function getSlot(id) {
    const v = slots[id];
    if (!v) return null;
    return typeof v === 'string' ? {
      u: v,
      s: 1,
      x: 0,
      y: 0
    } : v;
  }
  function setSlot(id, val) {
    if (!id) return;
    if (val) {
      slots[id] = val;
      tombstones.delete(id);
    } else {
      delete slots[id];
      if (!loaded) tombstones.add(id);
    }
    subs.forEach(fn => fn());
    // A drop is rare + high-value, write immediately so nav-away can't lose
    // it. Gate on the initial read so we don't overwrite a sidecar we haven't
    // merged yet; the merge in load() keeps this change once the read lands.
    if (loaded) save();else load().then(save);
  }

  // ── Image downscale ─────────────────────────────────────────────────────
  // Encode through a canvas so the sidecar carries resized bytes, not the
  // raw upload. Longest side is capped at 2× the slot's rendered width
  // (retina) and at MAX_DIM. WebP keeps alpha and is ~10× smaller than PNG
  // for photos, so there's no need for per-image format picking.
  async function toDataUrl(file, targetW) {
    const bitmap = await createImageBitmap(file);
    try {
      const cap = Math.min(MAX_DIM, Math.max(1, Math.round(targetW * 2)) || MAX_DIM);
      const scale = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
      return canvas.toDataURL('image/webp', 0.85);
    } finally {
      bitmap.close && bitmap.close();
    }
  }

  // ── Custom element ──────────────────────────────────────────────────────
  const stylesheet = ':host{display:inline-block;position:relative;vertical-align:top;' + '  font:13px/1.3 system-ui,-apple-system,sans-serif;color:rgba(0,0,0,.55);width:240px;height:160px}' + '.frame{position:absolute;inset:0;overflow:hidden;background:rgba(0,0,0,.04)}' +
  // .frame img (clipped) and .spill (unclipped ghost + handles) share the
  // same left/top/width/height in frame-%, computed by _applyView(), so the
  // inside-mask crop and the outside-mask spill stay pixel-aligned.
  '.frame img{position:absolute;max-width:none;transform:translate(-50%,-50%);' + '  -webkit-user-drag:none;user-select:none;touch-action:none}' +
  // Reframe mode (double-click): the full image spills past the mask. The
  // spill layer is sized to the IMAGE bounds so its corners are where the
  // resize handles belong. The ghost <img> inside is translucent; the real
  // clipped <img> underneath shows the opaque in-mask crop.
  '.spill{position:absolute;transform:translate(-50%,-50%);display:none;z-index:1;' + '  cursor:grab;touch-action:none}' + ':host([data-panning]) .spill{cursor:grabbing}' + '.spill .ghost{position:absolute;inset:0;width:100%;height:100%;opacity:.35;' + '  pointer-events:none;-webkit-user-drag:none;user-select:none;' + '  box-shadow:0 0 0 1px rgba(0,0,0,.2),0 12px 32px rgba(0,0,0,.2)}' + '.spill .handle{position:absolute;width:12px;height:12px;border-radius:50%;' + '  background:#fff;box-shadow:0 0 0 1.5px #c96442,0 1px 3px rgba(0,0,0,.3);' + '  transform:translate(-50%,-50%)}' + '.spill .handle[data-c=nw]{left:0;top:0;cursor:nwse-resize}' + '.spill .handle[data-c=ne]{left:100%;top:0;cursor:nesw-resize}' + '.spill .handle[data-c=sw]{left:0;top:100%;cursor:nesw-resize}' + '.spill .handle[data-c=se]{left:100%;top:100%;cursor:nwse-resize}' + ':host([data-reframe]){z-index:10}' + ':host([data-reframe]) .spill{display:block}' + ':host([data-reframe]) .frame{box-shadow:0 0 0 2px #c96442}' + '.empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' + '  justify-content:center;gap:6px;text-align:center;padding:12px;box-sizing:border-box;' + '  cursor:pointer;user-select:none}' + '.empty svg{opacity:.45}' + '.empty .cap{max-width:90%;font-weight:500;letter-spacing:.01em}' + '.empty .sub{font-size:11px}' + '.empty .sub u{text-underline-offset:2px;text-decoration-color:rgba(0,0,0,.25)}' + '.empty:hover .sub u{color:rgba(0,0,0,.75);text-decoration-color:currentColor}' + ':host([data-over]) .frame{outline:2px solid #c96442;outline-offset:-2px;' + '  background:rgba(201,100,66,.10)}' + '.ring{position:absolute;inset:0;pointer-events:none;border:1.5px dashed rgba(0,0,0,.25);' + '  transition:border-color .12s}' + ':host([data-over]) .ring{border-color:#c96442}' + ':host([data-filled]) .ring{display:none}' +
  // Controls sit BELOW the mask (top:100%), absolutely positioned so the
  // author-declared slot height is unaffected. The gap is padding, not a
  // top offset, so the hover target stays contiguous with the frame.
  '.ctl{position:absolute;top:100%;left:50%;transform:translateX(-50%);padding-top:8px;' + '  display:flex;gap:6px;opacity:0;pointer-events:none;transition:opacity .12s;z-index:2;' + '  white-space:nowrap}' + ':host([data-filled][data-editable]:hover) .ctl,:host([data-reframe]) .ctl' + '  {opacity:1;pointer-events:auto}' + '.ctl button{appearance:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer;' + '  background:rgba(0,0,0,.65);color:#fff;font:11px/1 system-ui,-apple-system,sans-serif;' + '  backdrop-filter:blur(6px)}' + '.ctl button:hover{background:rgba(0,0,0,.8)}' + '.err{position:absolute;left:8px;bottom:8px;right:8px;color:#b3261e;font-size:11px;' + '  background:rgba(255,255,255,.85);padding:4px 6px;border-radius:5px;pointer-events:none}';
  const icon = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' + 'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>' + '<path d="m21 15-5-5L5 21"/></svg>';
  class ImageSlot extends HTMLElement {
    static get observedAttributes() {
      return ['shape', 'radius', 'mask', 'fit', 'position', 'placeholder', 'src', 'id'];
    }
    constructor() {
      super();
      const root = this.attachShadow({
        mode: 'open'
      });
      // .spill and .ctl sit OUTSIDE .frame so overflow:hidden + border-radius
      // on the frame (circle, pill, rounded) can't clip them.
      root.innerHTML = '<style>' + stylesheet + '</style>' + '<div class="frame" part="frame">' + '  <img part="image" alt="" draggable="false" style="display:none">' + '  <div class="empty" part="empty">' + icon + '    <div class="cap"></div>' + '    <div class="sub">or <u>browse files</u></div></div>' + '  <div class="ring" part="ring"></div>' + '</div>' + '<div class="spill">' + '  <img class="ghost" alt="" draggable="false">' + '  <div class="handle" data-c="nw"></div><div class="handle" data-c="ne"></div>' + '  <div class="handle" data-c="sw"></div><div class="handle" data-c="se"></div>' + '</div>' + '<div class="ctl"><button data-act="replace" title="Replace image">Replace</button>' + '  <button data-act="clear" title="Remove image">Remove</button></div>' + '<input type="file" accept="' + ACCEPT.join(',') + '" hidden>';
      this._frame = root.querySelector('.frame');
      this._ring = root.querySelector('.ring');
      this._img = root.querySelector('.frame img');
      this._empty = root.querySelector('.empty');
      this._cap = root.querySelector('.cap');
      this._sub = root.querySelector('.sub');
      this._spill = root.querySelector('.spill');
      this._ghost = root.querySelector('.ghost');
      this._err = null;
      this._input = root.querySelector('input');
      this._depth = 0;
      this._gen = 0;
      this._view = {
        s: 1,
        x: 0,
        y: 0
      };
      this._subFn = () => this._render();
      // Shadow-DOM listeners live with the shadow DOM, bound once here so
      // disconnect/reconnect (e.g. React remount) doesn't stack handlers.
      this._empty.addEventListener('click', () => this._input.click());
      root.addEventListener('click', e => {
        const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'replace') {
          this._exitReframe(true);
          this._input.click();
        }
        if (act === 'clear') {
          this._exitReframe(false);
          this._gen++;
          this._local = null;
          if (this.id) setSlot(this.id, null);else this._render();
        }
      });
      this._input.addEventListener('change', () => {
        const f = this._input.files && this._input.files[0];
        if (f) this._ingest(f);
        this._input.value = '';
      });
      // naturalWidth/Height aren't known until load, re-apply so the cover
      // baseline is computed from real dimensions, not the 100%×100% fallback.
      this._img.addEventListener('load', () => this._applyView());
      // Gated on editable + fit=cover so share links and contain/fill slots
      // stay static.
      this.addEventListener('dblclick', e => {
        if (!this.hasAttribute('data-editable') || !this._reframes()) return;
        e.preventDefault();
        if (this.hasAttribute('data-reframe')) this._exitReframe(true);else this._enterReframe();
      });
      // Pan + resize both originate on the spill layer. A handle pointerdown
      // drives an aspect-locked resize anchored at the opposite corner; any
      // other pointerdown on the spill pans. Offsets are frame-% so a
      // reframed slot survives responsive resize / PPTX export.
      this._spill.addEventListener('pointerdown', e => {
        if (e.button !== 0 || !this.hasAttribute('data-reframe')) return;
        e.preventDefault();
        e.stopPropagation();
        this._spill.setPointerCapture(e.pointerId);
        const rect = this.getBoundingClientRect();
        const fw = rect.width || 1,
          fh = rect.height || 1;
        const corner = e.target.getAttribute && e.target.getAttribute('data-c');
        let move;
        if (corner) {
          // Resize about the OPPOSITE corner. Viewport-px throughout (rect
          // fw/fh, not clientWidth) so the math survives a transform:scale()
          // ancestor, deck_stage renders slides scaled-to-fit.
          const iw = this._img.naturalWidth || 1,
            ih = this._img.naturalHeight || 1;
          const base = Math.max(fw / iw, fh / ih);
          const sx = corner.includes('e') ? 1 : -1;
          const sy = corner.includes('s') ? 1 : -1;
          const s0 = this._view.s;
          const w0 = iw * base * s0,
            h0 = ih * base * s0;
          const cx0 = (50 + this._view.x) / 100 * fw;
          const cy0 = (50 + this._view.y) / 100 * fh;
          const ox = cx0 - sx * w0 / 2,
            oy = cy0 - sy * h0 / 2;
          const diag0 = Math.hypot(w0, h0);
          const ux = sx * w0 / diag0,
            uy = sy * h0 / diag0;
          move = ev => {
            const proj = (ev.clientX - rect.left - ox) * ux + (ev.clientY - rect.top - oy) * uy;
            const s = clampS(s0 * proj / diag0);
            const d = diag0 * s / s0;
            this._view.s = s;
            this._view.x = (ox + ux * d / 2) / fw * 100 - 50;
            this._view.y = (oy + uy * d / 2) / fh * 100 - 50;
            this._clampView();
            this._applyView();
          };
        } else {
          this.setAttribute('data-panning', '');
          const start = {
            px: e.clientX,
            py: e.clientY,
            x: this._view.x,
            y: this._view.y
          };
          move = ev => {
            this._view.x = start.x + (ev.clientX - start.px) / fw * 100;
            this._view.y = start.y + (ev.clientY - start.py) / fh * 100;
            this._clampView();
            this._applyView();
          };
        }
        const up = () => {
          try {
            this._spill.releasePointerCapture(e.pointerId);
          } catch {}
          this._spill.removeEventListener('pointermove', move);
          this._spill.removeEventListener('pointerup', up);
          this._spill.removeEventListener('pointercancel', up);
          this.removeAttribute('data-panning');
          this._dragUp = null;
        };
        // Stashed so _exitReframe (Escape / outside-click mid-drag) can
        // tear the capture + listeners down synchronously.
        this._dragUp = up;
        this._spill.addEventListener('pointermove', move);
        this._spill.addEventListener('pointerup', up);
        this._spill.addEventListener('pointercancel', up);
      });
      // Wheel zoom stays available inside reframe mode as a trackpad nicety,
      // zooms toward the cursor (offset' = cursor·(1-k) + offset·k).
      this.addEventListener('wheel', e => {
        if (!this.hasAttribute('data-reframe')) return;
        e.preventDefault();
        const r = this.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width * 100 - 50;
        const cy = (e.clientY - r.top) / r.height * 100 - 50;
        const prev = this._view.s;
        const next = clampS(prev * Math.pow(1.0015, -e.deltaY));
        if (next === prev) return;
        const k = next / prev;
        this._view.s = next;
        this._view.x = cx * (1 - k) + this._view.x * k;
        this._view.y = cy * (1 - k) + this._view.y * k;
        this._clampView();
        this._applyView();
      }, {
        passive: false
      });
    }
    connectedCallback() {
      // Warn once per page, an id-less slot works for the session but
      // cannot persist, and two id-less slots would share nothing.
      if (!this.id && !ImageSlot._warned) {
        ImageSlot._warned = true;
        console.warn('<image-slot> without an id will not persist its dropped image.');
      }
      this.addEventListener('dragenter', this);
      this.addEventListener('dragover', this);
      this.addEventListener('dragleave', this);
      this.addEventListener('drop', this);
      subs.add(this._subFn);
      // width%/height% in _applyView encode the frame aspect at call time,
      // a host resize (responsive grid, pane divider) would stretch the
      // image until the next _render. Re-render on size change: _render()
      // re-seeds _view from stored before clamp/apply, so a shrink→grow
      // cycle round-trips instead of ratcheting x/y toward the narrower
      // frame's clamp range.
      this._ro = new ResizeObserver(() => this._render());
      this._ro.observe(this);
      load();
      this._render();
    }
    disconnectedCallback() {
      subs.delete(this._subFn);
      this.removeEventListener('dragenter', this);
      this.removeEventListener('dragover', this);
      this.removeEventListener('dragleave', this);
      this.removeEventListener('drop', this);
      if (this._ro) {
        this._ro.disconnect();
        this._ro = null;
      }
      this._exitReframe(false);
    }
    _enterReframe() {
      if (this.hasAttribute('data-reframe')) return;
      this.setAttribute('data-reframe', '');
      this._applyView();
      // Close on click outside (the spill handler stopPropagation()s so
      // in-image drags don't reach this) and on Escape. Listeners are held
      // on the instance so _exitReframe / disconnectedCallback can detach
      // exactly what was attached.
      this._outside = e => {
        if (e.composedPath && e.composedPath().includes(this)) return;
        this._exitReframe(true);
      };
      this._esc = e => {
        if (e.key === 'Escape') this._exitReframe(true);
      };
      document.addEventListener('pointerdown', this._outside, true);
      document.addEventListener('keydown', this._esc, true);
    }
    _exitReframe(commit) {
      if (!this.hasAttribute('data-reframe')) return;
      if (this._dragUp) this._dragUp();
      this.removeAttribute('data-reframe');
      this.removeAttribute('data-panning');
      if (this._outside) document.removeEventListener('pointerdown', this._outside, true);
      if (this._esc) document.removeEventListener('keydown', this._esc, true);
      this._outside = this._esc = null;
      if (commit) this._commitView();
    }
    attributeChangedCallback() {
      if (this.shadowRoot) this._render();
    }

    // handleEvent, one listener object for all four drag events keeps the
    // add/remove symmetric and the depth counter correct.
    handleEvent(e) {
      if (e.type === 'dragenter' || e.type === 'dragover') {
        // Without preventDefault the browser never fires 'drop'.
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        if (e.type === 'dragenter') this._depth++;
        this.setAttribute('data-over', '');
      } else if (e.type === 'dragleave') {
        // dragenter/leave fire for every descendant crossing, count depth
        // so hovering the icon inside the empty state doesn't flicker.
        if (--this._depth <= 0) {
          this._depth = 0;
          this.removeAttribute('data-over');
        }
      } else if (e.type === 'drop') {
        e.preventDefault();
        e.stopPropagation();
        this._depth = 0;
        this.removeAttribute('data-over');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) this._ingest(f);
      }
    }
    async _ingest(file) {
      this._setError(null);
      if (!file || ACCEPT.indexOf(file.type) < 0) {
        this._setError('Drop a PNG, JPEG, WebP, or AVIF image.');
        return;
      }
      // toDataUrl can take hundreds of ms on a large photo. A Clear or a
      // newer drop during that window would be clobbered when this await
      // resumes, bump + capture a generation so stale encodes bail.
      const gen = ++this._gen;
      try {
        const w = this.clientWidth || this.offsetWidth || MAX_DIM;
        const url = await toDataUrl(file, w);
        if (gen !== this._gen) return;
        // Only exit reframe once the new image is in hand, a rejected type
        // or decode failure leaves the in-progress crop untouched.
        this._exitReframe(false);
        const val = {
          u: url,
          s: 1,
          x: 0,
          y: 0
        };
        setSlot(this.id || '', val);
        // Keep a session-local copy for id-less slots so the drop still
        // shows, even though it cannot persist.
        if (!this.id) {
          this._local = val;
          this._render();
        }
      } catch (err) {
        if (gen !== this._gen) return;
        this._setError('Could not read that image.');
        console.warn('<image-slot> ingest failed:', err);
      }
    }
    _setError(msg) {
      if (this._err) {
        this._err.remove();
        this._err = null;
      }
      if (!msg) return;
      const d = document.createElement('div');
      d.className = 'err';
      d.textContent = msg;
      this.shadowRoot.appendChild(d);
      this._err = d;
      setTimeout(() => {
        if (this._err === d) {
          d.remove();
          this._err = null;
        }
      }, 3000);
    }

    // Reframing (pan/resize) is only meaningful for fit=cover, contain/fill
    // keep the old object-fit path and double-click is a no-op.
    _reframes() {
      return this.hasAttribute('data-filled') && (this.getAttribute('fit') || 'cover') === 'cover';
    }

    // Cover-baseline geometry, shared by clamp/apply/resize. Null until the
    // img has loaded (naturalWidth is 0 before that) or when the slot has no
    // layout box, ResizeObserver fires with a 0×0 rect under display:none,
    // and clamping against a degenerate 1×1 frame would silently pull the
    // stored pan toward zero.
    _geom() {
      const iw = this._img.naturalWidth,
        ih = this._img.naturalHeight;
      const fw = this.clientWidth,
        fh = this.clientHeight;
      if (!iw || !ih || !fw || !fh) return null;
      return {
        iw,
        ih,
        fw,
        fh,
        base: Math.max(fw / iw, fh / ih)
      };
    }
    _clampView() {
      // Pan range on each axis is half the overflow past the frame edge.
      const g = this._geom();
      if (!g) return;
      const mx = Math.max(0, (g.iw * g.base * this._view.s / g.fw - 1) * 50);
      const my = Math.max(0, (g.ih * g.base * this._view.s / g.fh - 1) * 50);
      this._view.x = Math.max(-mx, Math.min(mx, this._view.x));
      this._view.y = Math.max(-my, Math.min(my, this._view.y));
    }
    _applyView() {
      const g = this._geom();
      const fit = this.getAttribute('fit') || 'cover';
      if (fit !== 'cover' || !g) {
        // Non-cover, or dimensions not known yet (before img load).
        this._img.style.width = '100%';
        this._img.style.height = '100%';
        this._img.style.left = '50%';
        this._img.style.top = '50%';
        this._img.style.objectFit = fit;
        this._img.style.objectPosition = this.getAttribute('position') || '50% 50%';
        return;
      }
      // Cover baseline: img fills the frame on its tighter axis at s=1, so
      // pan works immediately on the overflowing axis without zooming first.
      // Width/height and left/top are all frame-%, depends only on the
      // frame aspect ratio, so a responsive resize keeps the same crop. The
      // spill layer mirrors the same box so its corners = image corners.
      const k = g.base * this._view.s;
      const w = g.iw * k / g.fw * 100 + '%';
      const h = g.ih * k / g.fh * 100 + '%';
      const l = 50 + this._view.x + '%';
      const t = 50 + this._view.y + '%';
      this._img.style.width = w;
      this._img.style.height = h;
      this._img.style.left = l;
      this._img.style.top = t;
      this._img.style.objectFit = '';
      this._spill.style.width = w;
      this._spill.style.height = h;
      this._spill.style.left = l;
      this._spill.style.top = t;
    }
    _commitView() {
      const v = {
        s: this._view.s,
        x: this._view.x,
        y: this._view.y
      };
      if (this._userUrl) v.u = this._userUrl;
      // Framing-only (no u) persists too so an author-src slot remembers its
      // crop; clearing the sidecar still falls through to src=.
      if (this.id) setSlot(this.id, v);else {
        this._local = v;
      }
    }
    _render() {
      // Shape / mask. Presets use border-radius so the dashed ring can
      // follow the rounded outline; clip-path is only applied for an
      // explicit `mask` (the ring is hidden there since a rectangle
      // dashed border chopped by an arbitrary polygon looks broken).
      const mask = this.getAttribute('mask');
      const shape = (this.getAttribute('shape') || 'rounded').toLowerCase();
      let radius = '';
      if (shape === 'circle') radius = '50%';else if (shape === 'pill') radius = '9999px';else if (shape === 'rounded') {
        const n = parseFloat(this.getAttribute('radius'));
        radius = (Number.isFinite(n) ? n : 12) + 'px';
      }
      this._frame.style.borderRadius = mask ? '' : radius;
      this._frame.style.clipPath = mask || '';
      this._ring.style.borderRadius = mask ? '' : radius;
      this._ring.style.display = mask ? 'none' : '';

      // Controls and reframe entry gate on this so share links stay read-only.
      const editable = !!(window.omelette && window.omelette.writeFile);
      this.toggleAttribute('data-editable', editable);
      this._sub.style.display = editable ? '' : 'none';

      // Content. The sidecar is also writable by the agent's write_file
      // tool, so its value isn't guaranteed canvas-originated, only accept
      // data:image/ URLs from it. The `src` attribute is author-controlled
      // (Claude wrote it into the HTML) so it passes through unchanged.
      let stored = this.id ? getSlot(this.id) : this._local;
      if (stored && stored.u && !/^data:image\//i.test(stored.u)) stored = null;
      const srcAttr = this.getAttribute('src') || '';
      this._userUrl = stored && stored.u || null;
      const url = this._userUrl || srcAttr;
      // Don't clobber an in-flight reframe with a store-triggered re-render.
      if (!this.hasAttribute('data-reframe')) {
        this._view = {
          s: stored && Number.isFinite(stored.s) ? clampS(stored.s) : 1,
          x: stored && Number.isFinite(stored.x) ? stored.x : 0,
          y: stored && Number.isFinite(stored.y) ? stored.y : 0
        };
      }
      this._cap.textContent = this.getAttribute('placeholder') || 'Drop an image';
      // Toggle via style.display, the [hidden] attribute alone loses to
      // the display:flex / display:block rules in the stylesheet above.
      if (url) {
        if (this._img.getAttribute('src') !== url) {
          this._img.src = url;
          this._ghost.src = url;
        }
        this._img.style.display = 'block';
        this._empty.style.display = 'none';
        this.setAttribute('data-filled', '');
        this._clampView();
        this._applyView();
      } else {
        this._img.style.display = 'none';
        this._img.removeAttribute('src');
        this._ghost.removeAttribute('src');
        this._empty.style.display = 'flex';
        this.removeAttribute('data-filled');
      }
    }
  }
  if (!customElements.get('image-slot')) {
    customElements.define('image-slot', ImageSlot);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/landing/image-slot.js", error: String((e && e.message) || e) }); }

// ui_kits/mobile-app/MobileApp.jsx
try { (() => {
// HOMA mobile app, screens rendered inside a phone frame.
const {
  Icon: MIcon,
  Avatar: MAvatar,
  ProgressBar: MProgress,
  Badge: MBadge,
  Chip: MChip,
  Callout: MCallout,
  Logo: MLogo
} = window.HOMADesignSystem_113bd2;
function StatusBar() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      fontSize: '0.8rem',
      fontWeight: 700,
      color: 'var(--text-strong)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "signal",
    size: 15
  }), /*#__PURE__*/React.createElement(MIcon, {
    name: "wifi",
    size: 15
  }), /*#__PURE__*/React.createElement(MIcon, {
    name: "battery-full",
    size: 17
  })));
}
function TabBar({
  active,
  onNav
}) {
  const tabs = [['home', 'Home'], ['sparkles', 'Ask'], ['compass', 'Discover'], ['clipboard-check', 'Kids']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 76,
      flexShrink: 0,
      display: 'flex',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--surface-card)',
      paddingBottom: 14
    }
  }, tabs.map(([ic, lbl]) => {
    const on = active === lbl;
    return /*#__PURE__*/React.createElement("button", {
      key: lbl,
      onClick: () => onNav(lbl),
      style: {
        flex: 1,
        border: 'none',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        cursor: 'pointer',
        paddingTop: 10
      }
    }, /*#__PURE__*/React.createElement(MIcon, {
      name: ic,
      size: 22,
      color: on ? 'var(--brand)' : 'var(--text-subtle)'
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.68rem',
        fontWeight: 600,
        color: on ? 'var(--brand)' : 'var(--text-subtle)',
        fontFamily: 'var(--font-sans)'
      }
    }, lbl));
  }));
}
function Eyebrow({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)',
      ...style
    }
  }, children);
}
function HomeScreen() {
  const [done, setDone] = React.useState([false, false, false]);
  React.useEffect(() => {
    if (!document.getElementById('homa-check-kf')) {
      const s = document.createElement('style');
      s.id = 'homa-check-kf';
      s.textContent = '@keyframes homaPop{0%{transform:scale(.5)}55%{transform:scale(1.2)}100%{transform:scale(1)}}@keyframes homaStar{0%{opacity:0;transform:translateY(3px) scale(.4) rotate(-20deg)}30%{opacity:1}100%{opacity:0;transform:translateY(-18px) scale(1.15) rotate(10deg)}}';
      document.head.appendChild(s);
    }
  }, []);
  const tint = {
    Math: ['var(--clay-50)', 'var(--clay-600)'],
    Reading: ['var(--sage-50)', 'var(--sage-600)'],
    Science: ['var(--gold-100)', '#9a7118']
  };
  const tasks = [['Fractions review', 'Math', '30m', 'divide'], ['Chapter 4, Charlotte\u2019s Web', 'Reading', '30m', 'book-open'], ['Nature journal', 'Science', '45m', 'leaf']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '10px 22px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      margin: '6px 0 26px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Tuesday, May 13"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2rem',
      fontWeight: 500,
      color: 'var(--text-strong)',
      letterSpacing: '-0.02em',
      marginTop: 6
    }
  }, "Morning, Sarah")), /*#__PURE__*/React.createElement(MAvatar, {
    name: "Sarah Rivera",
    size: 42,
    tone: "var(--sage-500)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-xl)',
      padding: '20px 22px',
      boxShadow: 'var(--shadow-md)',
      marginBottom: 30
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "sparkles",
    size: 16,
    color: "var(--brand)"
  }), /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      color: 'var(--brand)'
    }
  }, "Today\u2019s focus")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.4rem',
      fontWeight: 500,
      color: 'var(--text-strong)',
      lineHeight: 1.25,
      letterSpacing: '-0.01em'
    }
  }, "Three subjects for Maya, ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: 'italic',
      color: 'var(--clay-600)'
    }
  }, "about 1h 45m"), ".")), /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginBottom: 14
    }
  }, "Up next"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginBottom: 30
    }
  }, tasks.map(([t, s, d, ic], i) => {
    const [bg, fg] = tint[s];
    const isDone = done[i];
    return /*#__PURE__*/React.createElement("div", {
      key: t,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '15px 16px',
        boxShadow: 'var(--shadow-sm)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 42,
        height: 42,
        borderRadius: 'var(--radius-md)',
        background: bg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        opacity: isDone ? 0.55 : 1,
        transition: 'opacity var(--dur-base) var(--ease-out)'
      }
    }, /*#__PURE__*/React.createElement(MIcon, {
      name: ic,
      size: 19,
      color: fg
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        color: isDone ? 'var(--text-subtle)' : 'var(--text-strong)',
        fontSize: '0.98rem',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textDecoration: isDone ? 'line-through' : 'none',
        textDecorationColor: 'var(--stone-300)',
        transition: 'color var(--dur-base) var(--ease-out)'
      }
    }, t), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.78rem',
        color: 'var(--text-subtle)',
        marginTop: 2
      }
    }, s, " \xB7 ", d)), /*#__PURE__*/React.createElement("button", {
      "aria-label": isDone ? 'Mark not done' : 'Mark done',
      onClick: () => setDone(a => a.map((v, j) => j === i ? !v : v)),
      style: {
        position: 'relative',
        width: 26,
        height: 26,
        borderRadius: '50%',
        flexShrink: 0,
        cursor: 'pointer',
        padding: 0,
        border: isDone ? 'none' : '1.5px solid var(--border-strong)',
        background: isDone ? 'var(--sage-500)' : 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: isDone ? 'homaPop .35s var(--ease-out)' : 'none'
      }
    }, isDone && /*#__PURE__*/React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "3.5",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("polyline", {
      points: "20 6 9 17 4 12"
    })), isDone && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: -8,
        right: -9,
        fontSize: 13,
        color: 'var(--gold-500)',
        animation: 'homaStar .8s var(--ease-out) forwards',
        pointerEvents: 'none'
      }
    }, "\u2726")));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Maya this week"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.72rem',
      color: 'var(--text-subtle)',
      letterSpacing: '0.04em'
    }
  }, "4 subjects")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-xl)',
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      boxShadow: 'var(--shadow-sm)'
    }
  }, /*#__PURE__*/React.createElement(MProgress, {
    label: "Math",
    value: 68,
    showValue: true,
    tone: "brand",
    size: "sm"
  }), /*#__PURE__*/React.createElement(MProgress, {
    label: "Reading",
    value: 82,
    showValue: true,
    tone: "sage",
    size: "sm"
  }), /*#__PURE__*/React.createElement(MProgress, {
    label: "Science",
    value: 44,
    showValue: true,
    tone: "gold",
    size: "sm"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      background: 'var(--sage-50)',
      borderLeft: '3px solid var(--sage-400)',
      borderRadius: 'var(--radius-md)',
      padding: '18px 20px',
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "sparkles",
    size: 18,
    color: "var(--sage-600)",
    style: {
      flexShrink: 0,
      marginTop: 3
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      color: 'var(--sage-700)',
      marginBottom: 6
    }
  }, "A note from HOMA"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.12rem',
      lineHeight: 1.4,
      color: 'var(--text-strong)'
    }
  }, "Maya\u2019s right on pace, and her reading is really taking off. Nothing to worry about this week."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-hand)',
      fontSize: '1.55rem',
      color: 'var(--sage-600)',
      marginTop: 6,
      lineHeight: 1
    }
  }, "you\u2019re doing great \u2726"))));
}
function AskScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '10px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      margin: '10px 0 20px'
    }
  }, /*#__PURE__*/React.createElement(MLogo, {
    variant: "mark",
    size: 34,
    style: {
      justifyContent: 'center'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.3rem',
      fontWeight: 600,
      color: 'var(--text-strong)',
      marginTop: 8
    }
  }, "Ask HOMA")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '82%',
      background: 'var(--brand)',
      color: '#fff',
      padding: '11px 15px',
      borderRadius: 'var(--radius-lg)',
      borderBottomRightRadius: 6,
      fontSize: '0.92rem'
    }
  }, "Give me a rainy-day science idea for a 6-year-old.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '82%',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      padding: '11px 15px',
      borderRadius: 'var(--radius-lg)',
      borderBottomLeftRadius: 6,
      fontSize: '0.92rem',
      color: 'var(--text-body)',
      lineHeight: 1.5
    }
  }, "Try a kitchen \u201Crain cloud in a jar\u201D, shaving foam, water, and a few drops of food coloring. Eli will love watching the color \u201Crain\u201D fall. Want a printable to go with it?"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 16px 16px',
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 10,
      overflowX: 'auto'
    }
  }, /*#__PURE__*/React.createElement(MChip, null, "Make a printable"), /*#__PURE__*/React.createElement(MChip, null, "Another idea")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'var(--surface-card)',
      border: '1.5px solid var(--border-default)',
      borderRadius: 'var(--radius-pill)',
      padding: '7px 7px 7px 16px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "Message HOMA\u2026",
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.95rem'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: 'var(--brand)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "arrow-up",
    size: 18,
    color: "#fff"
  })))));
}
function DiscoverScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '10px 22px 24px'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Discover \xB7 Austin, TX"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.6rem',
      fontWeight: 500,
      color: 'var(--text-strong)',
      letterSpacing: '-0.02em',
      margin: '6px 0 18px'
    }
  }, "Out in the world"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-xl)',
      padding: '18px 20px',
      boxShadow: 'var(--shadow-md)',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.62rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--clay-600)',
      marginBottom: 8
    }
  }, "Maya \xB7 Space unit"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.2rem',
      fontWeight: 500,
      color: 'var(--text-strong)',
      lineHeight: 1.3
    }
  }, "Family space day at the Bullock, ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: 'italic',
      color: 'var(--clay-600)'
    }
  }, "Saturday"), "."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--text-muted)',
      marginTop: 6,
      lineHeight: 1.5
    }
  }, "Planetarium shows at 10 & 2, lines up with her astronomy week."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--brand)',
      color: '#fff',
      padding: '9px 18px',
      borderRadius: 'var(--radius-pill)',
      fontWeight: 700,
      fontSize: '0.85rem'
    }
  }, "Get tickets"), /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--stone-100)',
      color: 'var(--text-muted)',
      padding: '9px 18px',
      borderRadius: 'var(--radius-pill)',
      fontWeight: 600,
      fontSize: '0.85rem'
    }
  }, "Not this week"))), /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      marginBottom: 12
    }
  }, "Nearby this week"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginBottom: 22
    }
  }, [['book-open', 'Story hour', 'Central Library · Thu 10:00'], ['users', 'Cedar Park co-op', 'Tuesdays · 12 families'], ['cloud-rain', 'Rainy-day pick', 'Hopscotch Play Lab · open play']].map(([ic, t, d]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-md)',
      padding: '13px 14px',
      boxShadow: 'var(--shadow-xs)'
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: ic,
    size: 19,
    color: "var(--brand)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: 'var(--text-strong)',
      fontSize: '0.92rem'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.76rem',
      color: 'var(--text-subtle)',
      marginTop: 1
    }
  }, d)), /*#__PURE__*/React.createElement(MIcon, {
    name: "chevron-right",
    size: 16,
    color: "var(--stone-300)"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'var(--sage-50)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, ['Ana M', 'Dana K', 'Priya S'].map((n, i) => /*#__PURE__*/React.createElement("span", {
    key: n,
    style: {
      marginLeft: i ? -8 : 0
    }
  }, /*#__PURE__*/React.createElement(MAvatar, {
    name: n,
    size: 30
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.82rem',
      color: 'var(--text-body)',
      lineHeight: 1.4
    }
  }, /*#__PURE__*/React.createElement("b", null, "4 HOMA families"), " homeschool within 5 miles.")));
}
function KidsScreen() {
  const standings = [['Reading', 'Ahead', 'gold'], ['Math', 'On track', 'sage'], ['Writing', 'On track', 'sage'], ['Science', 'Ready for review', 'warning']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '10px 22px 24px'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Benchmarks \xB7 Texas (TEKS)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      margin: '6px 0 18px'
    }
  }, /*#__PURE__*/React.createElement(MAvatar, {
    name: "Maya Rivera",
    size: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.6rem',
      fontWeight: 500,
      color: 'var(--text-strong)',
      letterSpacing: '-0.02em'
    }
  }, "Where Maya stands")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-xl)',
      padding: '6px 20px',
      boxShadow: 'var(--shadow-sm)',
      marginBottom: 22
    }
  }, standings.map(([s, b, tone]) => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '13px 0',
      borderBottom: s !== 'Science' ? '1px solid var(--stone-100)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      color: 'var(--text-body)',
      fontSize: '0.95rem'
    }
  }, s), /*#__PURE__*/React.createElement(MBadge, {
    tone: tone
  }, b)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--sage-50)',
      borderRadius: 'var(--radius-xl)',
      padding: '18px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.62rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--sage-700)',
      marginBottom: 8
    }
  }, "It's working"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.2rem',
      fontWeight: 500,
      color: 'var(--text-strong)',
      lineHeight: 1.3
    }
  }, "Math is up ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: 'italic',
      color: 'var(--sage-700)'
    }
  }, "12 points"), " since the fractions set."), /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: "44",
    viewBox: "0 0 260 44",
    preserveAspectRatio: "none",
    style: {
      margin: '10px 0 2px'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 36 C30 34 60 31 90 27 C130 22 170 15 210 9 C230 6 245 5 260 4",
    fill: "none",
    stroke: "var(--sage-500)",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "260",
    cy: "4",
    r: "3.5",
    fill: "var(--sage-500)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-hand)',
      fontSize: '1.4rem',
      color: 'var(--sage-600)',
      marginTop: 8,
      lineHeight: 1
    }
  }, "your work is paying off \u2726")));
}
function MobileApp() {
  const [tab, setTab] = React.useState('Home');
  React.useEffect(() => {
    setTimeout(() => window.lucide && window.lucide.createIcons(), 60);
  });
  const screens = {
    Home: /*#__PURE__*/React.createElement(HomeScreen, null),
    Ask: /*#__PURE__*/React.createElement(AskScreen, null),
    Discover: /*#__PURE__*/React.createElement(DiscoverScreen, null),
    Kids: /*#__PURE__*/React.createElement(KidsScreen, null)
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 390,
      height: 812,
      background: 'var(--bg-page)',
      borderRadius: 44,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: 'var(--shadow-xl)',
      border: '10px solid #221E1A'
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), screens[tab], /*#__PURE__*/React.createElement(TabBar, {
    active: tab,
    onNav: setTab
  }));
}
Object.assign(window, {
  MobileApp
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile-app/MobileApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/App.jsx
try { (() => {
// HOMA web app, shell: login gate + authenticated app frame.
const {
  Button: AButton,
  Input: AInput,
  Icon: AIcon,
  Logo: ALogo
} = window.HOMADesignSystem_113bd2;
function Login({
  onEnter
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-page)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 340,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(ALogo, {
    size: 34
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.5rem',
      color: 'var(--text-strong)',
      marginBottom: 6
    }
  }, "Welcome back"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-muted)',
      marginBottom: 24
    }
  }, "Your homeschool co-pilot is ready."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement(AInput, {
    label: "Email",
    placeholder: "sarah@family.com",
    iconLeft: /*#__PURE__*/React.createElement(AIcon, {
      name: "mail",
      size: 18
    })
  }), /*#__PURE__*/React.createElement(AInput, {
    label: "Password",
    type: "password",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    iconLeft: /*#__PURE__*/React.createElement(AIcon, {
      name: "lock",
      size: 18
    })
  }), /*#__PURE__*/React.createElement(AButton, {
    variant: "primary",
    fullWidth: true,
    onClick: onEnter,
    style: {
      marginTop: 6
    }
  }, "Sign in")), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-subtle)',
      fontSize: '0.85rem',
      marginTop: 18
    }
  }, "New here? ", /*#__PURE__*/React.createElement("a", {
    href: "onboarding.html",
    style: {
      color: 'var(--brand)',
      fontWeight: 600,
      textDecoration: 'none'
    }
  }, "Start free")))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: 'linear-gradient(160deg, var(--clay-400), var(--clay-600))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 380,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement(AIcon, {
    name: "sparkles",
    size: 30,
    color: "#fff"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.9rem',
      fontWeight: 500,
      lineHeight: 1.25,
      marginTop: 16
    }
  }, "\u201CHOMA plans our week in five minutes. I finally have my evenings back.\u201D"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      opacity: 0.9,
      fontWeight: 600
    }
  }, "Dana, mom of three"))));
}
function App() {
  const [authed, setAuthed] = React.useState(false);
  const [view, setView] = React.useState('chat');
  const kids = [{
    name: 'Maya Rivera',
    grade: 'Grade 3'
  }, {
    name: 'Eli Rivera',
    grade: 'Grade 1'
  }, {
    name: 'Nora Rivera',
    grade: 'Pre-K'
  }];
  React.useEffect(() => {
    setTimeout(() => window.lucide && window.lucide.createIcons(), 60);
  });
  if (!authed) return /*#__PURE__*/React.createElement(Login, {
    onEnter: () => setAuthed(true)
  });
  const views = {
    chat: /*#__PURE__*/React.createElement(ChatView, null),
    dashboard: /*#__PURE__*/React.createElement(DashboardView, null),
    benchmarks: /*#__PURE__*/React.createElement(BenchmarksView, null),
    planner: /*#__PURE__*/React.createElement(PlannerView, null),
    discover: /*#__PURE__*/React.createElement(DiscoverView, null),
    curriculum: /*#__PURE__*/React.createElement(CurriculumView, null),
    worksheets: /*#__PURE__*/React.createElement(Placeholder, {
      title: "Worksheets",
      icon: "file-pen"
    }),
    library: /*#__PURE__*/React.createElement(Placeholder, {
      title: "Library",
      icon: "book-open"
    })
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100%',
      background: 'var(--bg-page)'
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    active: view,
    onNavigate: setView,
    kids: kids
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }
  }, views[view]));
}
function Placeholder({
  title,
  icon
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-subtle)'
    }
  }, /*#__PURE__*/React.createElement(AIcon, {
    name: icon,
    size: 40,
    color: "var(--stone-400)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontFamily: 'var(--font-display)',
      fontSize: '1.4rem',
      color: 'var(--text-muted)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.9rem'
    }
  }, "Coming together soon."));
}
Object.assign(window, {
  App
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/BenchmarksView.jsx
try { (() => {
// HOMA web app, Benchmarks: where the child stands, gently. The proof loop.
const {
  Card: BCard,
  Badge: BBadge,
  Icon: BIcon,
  Button: BButton,
  Checkbox: BCheckbox,
  Select: BSelect
} = window.HOMADesignSystem_113bd2;
function BStanding({
  subject,
  note,
  badge,
  tone
}) {
  return /*#__PURE__*/React.createElement(BCard, {
    padding: "md",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, subject), /*#__PURE__*/React.createElement(BBadge, {
    tone: tone
  }, badge)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--text-muted)',
      lineHeight: 1.45
    }
  }, note));
}
function BenchmarksView() {
  const [standard, setStandard] = React.useState('Texas (TEKS)');
  const [skills, setSkills] = React.useState({
    'Counts to 120 and beyond': true,
    'Skip-counts by 2s, 5s, 10s': true,
    'Adds and subtracts within 100': true,
    'Tells time to the minute': true,
    'Two-step word problems': false,
    'Single-digit multiplication': false
  });
  const doneCount = Object.values(skills).filter(Boolean).length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '30px 36px',
      maxWidth: 1000,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 20,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)'
    }
  }, "Benchmarks \xB7 Maya \xB7 Grade 3"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2rem',
      fontWeight: 500,
      letterSpacing: '-0.02em',
      color: 'var(--text-strong)',
      margin: '6px 0 0'
    }
  }, "Where Maya stands")), /*#__PURE__*/React.createElement(BSelect, {
    options: ['Texas (TEKS)', 'National (CCSS)'],
    value: standard,
    onChange: e => setStandard(e.target.value),
    style: {
      width: 190
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(BStanding, {
    subject: "Reading",
    badge: "Ahead",
    tone: "gold",
    note: "Reading at a Grade 4 level, comprehension is a real strength."
  }), /*#__PURE__*/React.createElement(BStanding, {
    subject: "Math",
    badge: "On track",
    tone: "sage",
    note: "Solid on number sense; multiplication is the next step."
  }), /*#__PURE__*/React.createElement(BStanding, {
    subject: "Writing",
    badge: "On track",
    tone: "sage",
    note: "Sentences are strong; paragraphs are coming along."
  }), /*#__PURE__*/React.createElement(BStanding, {
    subject: "Science",
    badge: "Ready for review",
    tone: "warning",
    note: "A quick check-in this week would help me map it."
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.15fr 1fr',
      gap: 18,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(BCard, {
    padding: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '1.05rem',
      color: 'var(--text-strong)'
    }
  }, "Math \xB7 number sense checklist"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.75rem',
      color: 'var(--text-subtle)'
    }
  }, doneCount, "/6")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--text-muted)',
      marginBottom: 16,
      lineHeight: 1.5
    }
  }, "A checklist for ", /*#__PURE__*/React.createElement("em", null, "you"), ", never a test for Maya. Check what you've seen her do."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13
    }
  }, Object.entries(skills).map(([skill, on]) => /*#__PURE__*/React.createElement(BCheckbox, {
    key: skill,
    label: skill,
    checked: on,
    onChange: v => setSkills({
      ...skills,
      [skill]: v
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-hand)',
      fontSize: '1.4rem',
      color: 'var(--sage-600)',
      marginTop: 18,
      lineHeight: 1
    }
  }, "blanks are fine, they're just what's next \u2726")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(BCard, {
    padding: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '1.05rem',
      color: 'var(--text-strong)',
      marginBottom: 12
    }
  }, "Growing right now"), [['file-pen', 'Two-step word problems', '3 practice pages, tuned to where she is'], ['hand', 'Regrouping', 'A hands-on activity with beans & cups, 15 min']].map(([ic, t, d]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      padding: '10px 0',
      borderBottom: '1px solid var(--stone-100)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--radius-md)',
      background: 'var(--clay-50)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(BIcon, {
    name: ic,
    size: 17,
    color: "var(--clay-600)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: 'var(--text-body)',
      fontSize: '0.92rem'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--text-subtle)',
      marginTop: 2
    }
  }, d)))), /*#__PURE__*/React.createElement(BButton, {
    size: "sm",
    fullWidth: true,
    style: {
      marginTop: 14
    },
    iconLeft: /*#__PURE__*/React.createElement(BIcon, {
      name: "sparkles",
      size: 15,
      color: "#fff"
    })
  }, "Add both to this week")), /*#__PURE__*/React.createElement(BCard, {
    padding: "lg",
    style: {
      background: 'var(--sage-50)',
      border: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--sage-700)',
      marginBottom: 8
    }
  }, "It's working"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.35rem',
      fontWeight: 500,
      color: 'var(--text-strong)',
      lineHeight: 1.3,
      letterSpacing: '-0.01em'
    }
  }, "Math mastery is up ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: 'italic',
      color: 'var(--sage-700)'
    }
  }, "12 points"), " since the fractions set."), /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: "54",
    viewBox: "0 0 260 54",
    preserveAspectRatio: "none",
    style: {
      margin: '12px 0 4px'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 44 C30 42 50 40 80 36 C120 31 150 26 190 16 C220 9 240 7 260 5",
    fill: "none",
    stroke: "var(--sage-500)",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "260",
    cy: "5",
    r: "4",
    fill: "var(--sage-500)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.66rem',
      color: 'var(--text-subtle)',
      letterSpacing: '0.06em'
    }
  }, /*#__PURE__*/React.createElement("span", null, "APR"), /*#__PURE__*/React.createElement("span", null, "6 WEEKS"), /*#__PURE__*/React.createElement("span", null, "NOW \xB7 82%")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-hand)',
      fontSize: '1.45rem',
      color: 'var(--sage-600)',
      marginTop: 12,
      lineHeight: 1
    }
  }, "your work is paying off \u2726")))));
}
Object.assign(window, {
  BenchmarksView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/BenchmarksView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/ChatView.jsx
try { (() => {
// HOMA web app, Ask HOMA chat view (assistant interface).
const {
  Icon: CIcon,
  IconButton: CIconButton,
  Button: CButton,
  Callout: CCallout,
  Chip: CChip
} = window.HOMADesignSystem_113bd2;
function ChatBubble({
  from,
  children
}) {
  const isHoma = from === 'homa';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: isHoma ? 'flex-start' : 'flex-end',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '76%',
      padding: '14px 18px',
      borderRadius: 'var(--radius-lg)',
      fontSize: '0.95rem',
      lineHeight: 'var(--leading-normal)',
      background: isHoma ? 'var(--surface-card)' : 'var(--brand)',
      color: isHoma ? 'var(--text-body)' : '#fff',
      borderBottomLeftRadius: isHoma ? 6 : 'var(--radius-lg)',
      borderBottomRightRadius: isHoma ? 'var(--radius-lg)' : 6,
      boxShadow: 'var(--shadow-sm)'
    }
  }, children));
}
function ChatView() {
  const [input, setInput] = React.useState('');
  const suggestions = ['Plan Maya\'s week', 'Make a fractions worksheet', 'Ideas for a rainy day', 'How is Eli doing?'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '32px 32px 24px',
      maxWidth: 780,
      width: '100%',
      margin: '0 auto',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 34
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)',
      marginBottom: 8
    }
  }, "Tuesday, May 13"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2rem',
      fontWeight: 500,
      letterSpacing: '-0.02em',
      color: 'var(--text-strong)'
    }
  }, "Good morning, Sarah"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic',
      color: 'var(--text-muted)',
      marginTop: 6,
      fontSize: '1.05rem'
    }
  }, "What are we tackling today?")), /*#__PURE__*/React.createElement(ChatBubble, {
    from: "user"
  }, "Can you plan a lighter week for Maya? She's been a bit burned out."), /*#__PURE__*/React.createElement(ChatBubble, {
    from: "homa"
  }, "Absolutely, let's ease off. I'll keep the core (30 min math, 30 min reading) and swap the heavier projects for hands-on activities. Here's Maya's lighter week:", /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(CIcon, {
    name: "check",
    size: 16,
    color: "var(--sage-600)"
  }), /*#__PURE__*/React.createElement("span", null, "Mon\u2013Fri: Fractions review (short sets)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(CIcon, {
    name: "check",
    size: 16,
    color: "var(--sage-600)"
  }), /*#__PURE__*/React.createElement("span", null, "A nature journal instead of the science quiz")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(CIcon, {
    name: "check",
    size: 16,
    color: "var(--sage-600)"
  }), /*#__PURE__*/React.createElement("span", null, "Read-aloud time, no comprehension worksheet")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginLeft: 4,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(CButton, {
    size: "sm",
    variant: "primary",
    iconLeft: /*#__PURE__*/React.createElement(CIcon, {
      name: "calendar-plus",
      size: 16,
      color: "#fff"
    })
  }, "Add to planner"), /*#__PURE__*/React.createElement(CButton, {
    size: "sm",
    variant: "secondary"
  }, "Tweak it")), /*#__PURE__*/React.createElement(CCallout, {
    tone: "sage",
    title: "A gentle reminder",
    icon: /*#__PURE__*/React.createElement(CIcon, {
      name: "heart",
      size: 18
    })
  }, "Lighter weeks are part of the plan, not a setback. Maya's still on track for her term goals.", /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-hand)',
      fontSize: '1.45rem',
      color: 'var(--sage-600)',
      marginTop: 6,
      lineHeight: 1
    }
  }, "you\u2019re doing great \u2726"))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-subtle)',
      padding: '16px 32px 24px',
      background: 'var(--bg-page)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 780,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 12,
      flexWrap: 'wrap'
    }
  }, suggestions.map(s => /*#__PURE__*/React.createElement(CChip, {
    key: s,
    onClick: () => setInput(s)
  }, s))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-pill)',
      padding: '8px 8px 8px 20px',
      boxShadow: 'var(--shadow-md)'
    }
  }, /*#__PURE__*/React.createElement(CIcon, {
    name: "sparkles",
    size: 20,
    color: "var(--brand)"
  }), /*#__PURE__*/React.createElement("input", {
    value: input,
    onChange: e => setInput(e.target.value),
    placeholder: "Ask HOMA anything\u2026",
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-sans)',
      fontSize: '1rem',
      color: 'var(--text-strong)'
    }
  }), /*#__PURE__*/React.createElement(CIconButton, {
    variant: "primary",
    ariaLabel: "Send"
  }, /*#__PURE__*/React.createElement(CIcon, {
    name: "arrow-up",
    color: "#fff"
  }))))));
}
Object.assign(window, {
  ChatView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/ChatView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/CurriculumView.jsx
try { (() => {
// HOMA web app, Compare curriculums: side-by-side, in plain language, against how the child learns.
const {
  Card: CCCard,
  Badge: CCBadge,
  Button: CCButton,
  Icon: CCIcon,
  Callout: CCCallout,
  Chip: CCChip
} = window.HOMADesignSystem_113bd2;
function CCRow({
  icon,
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      padding: '9px 0',
      borderBottom: '1px solid var(--stone-100)'
    }
  }, /*#__PURE__*/React.createElement(CCIcon, {
    name: icon,
    size: 16,
    color: "var(--text-subtle)",
    style: {
      marginTop: 2,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      lineHeight: 1.45
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-subtle)'
    }
  }, label, " \xB7 "), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)',
      fontWeight: 500
    }
  }, value)));
}
function CurriculumView() {
  const [subject, setSubject] = React.useState('Math');
  const options = [{
    name: 'Math-U-See',
    fit: ['Great fit', 'sage'],
    approach: 'Blocks-first, mastery-based, one concept at a time',
    time: '25–30 min/day',
    cost: '$112/yr',
    take: 'Maya learns by doing. The blocks match how she already thinks about fractions.'
  }, {
    name: 'Beast Academy',
    fit: ['Good stretch', 'gold'],
    approach: 'Puzzle-driven comics, deep problem solving',
    time: '30–40 min/day',
    cost: '$96/yr',
    take: 'A wonderful Friday challenge. As the main spine it may frustrate her on tired days.'
  }, {
    name: 'Saxon Math',
    fit: ['Different style', 'neutral'],
    approach: 'Spiral drill & review, steady and thorough',
    time: '45–60 min/day',
    cost: '$140/yr',
    take: 'Very solid, but heavy on repetition, the part of math Maya already pushes against.'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '30px 36px',
      maxWidth: 1000,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)'
    }
  }, "Curriculum \xB7 Maya \xB7 Grade 3"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2rem',
      fontWeight: 500,
      letterSpacing: '-0.02em',
      color: 'var(--text-strong)',
      margin: '6px 0 0'
    }
  }, "Compare before you commit"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-muted)',
      marginTop: 6
    }
  }, "Plain language, priced out, matched to how Maya actually learns.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 22
    }
  }, ['Math', 'Reading', 'Science'].map(s => /*#__PURE__*/React.createElement(CCChip, {
    key: s,
    selected: subject === s,
    onClick: () => setSubject(s)
  }, s))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16,
      alignItems: 'start',
      marginBottom: 22
    }
  }, options.map(o => /*#__PURE__*/React.createElement(CCCard, {
    key: o.name,
    padding: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.25rem',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, o.name), /*#__PURE__*/React.createElement(CCBadge, {
    tone: o.fit[1]
  }, o.fit[0])), /*#__PURE__*/React.createElement(CCRow, {
    icon: "shapes",
    label: "Approach",
    value: o.approach
  }), /*#__PURE__*/React.createElement(CCRow, {
    icon: "clock",
    label: "Time",
    value: o.time
  }), /*#__PURE__*/React.createElement(CCRow, {
    icon: "wallet",
    label: "Cost",
    value: o.cost
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic',
      color: 'var(--text-muted)',
      fontSize: '0.95rem',
      lineHeight: 1.5,
      margin: '12px 0 14px'
    }
  }, "\u201C", o.take, "\u201D"), /*#__PURE__*/React.createElement(CCButton, {
    size: "sm",
    variant: o.fit[1] === 'sage' ? 'primary' : 'secondary',
    fullWidth: true
  }, "Try a sample week")))), /*#__PURE__*/React.createElement(CCCallout, {
    tone: "sage",
    title: "A note from HOMA",
    icon: /*#__PURE__*/React.createElement(CCIcon, {
      name: "sparkles",
      size: 18
    })
  }, "There's no one right answer, there's the right fit for ", /*#__PURE__*/React.createElement("em", null, "this"), " kid, ", /*#__PURE__*/React.createElement("em", null, "this"), " year. Sample weeks are free to run; I'll fold whichever you pick straight into the planner."));
}
Object.assign(window, {
  CurriculumView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/CurriculumView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/DashboardView.jsx
try { (() => {
// HOMA web app, kid progress dashboard.
const {
  Card: DCard,
  Badge: DBadge,
  ProgressBar: DProgress,
  Avatar: DAvatar,
  Icon: DIcon,
  Tabs: DTabs,
  Callout: DCallout
} = window.HOMADesignSystem_113bd2;
function StatTile({
  icon,
  label,
  value,
  sub,
  tone
}) {
  return /*#__PURE__*/React.createElement(DCard, {
    padding: "md",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--radius-md)',
      background: tone,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(DIcon, {
    name: icon,
    size: 19,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--text-muted)',
      fontWeight: 600
    }
  }, label)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2rem',
      fontWeight: 600,
      color: 'var(--text-strong)',
      lineHeight: 1
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--text-subtle)',
      marginTop: 4
    }
  }, sub));
}
function DashboardView() {
  const [tab, setTab] = React.useState('Overview');
  const subjects = [{
    name: 'Math',
    grade: 'Grade 3',
    pct: 68,
    tone: 'brand',
    badge: ['On track', 'sage']
  }, {
    name: 'Reading',
    grade: 'Grade 4',
    pct: 82,
    tone: 'sage',
    badge: ['Ahead', 'gold']
  }, {
    name: 'Science',
    grade: 'Grade 3',
    pct: 44,
    tone: 'gold',
    badge: ['Review', 'warning']
  }, {
    name: 'Writing',
    grade: 'Grade 3',
    pct: 57,
    tone: 'brand',
    badge: ['On track', 'sage']
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '28px 36px',
      maxWidth: 1000,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(DAvatar, {
    name: "Maya Rivera",
    size: 52
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.8rem',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, "Maya's progress"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-muted)'
    }
  }, "Grade 3 \xB7 4 subjects \xB7 term ends May 30")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(DBadge, {
    tone: "sage",
    variant: "solid"
  }, "On track"))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '18px 0 22px'
    }
  }, /*#__PURE__*/React.createElement(DTabs, {
    tabs: ['Overview', 'Subjects', 'Reports', 'Standards'],
    value: tab,
    onChange: setTab
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    icon: "flame",
    label: "Streak",
    value: "12 days",
    sub: "Longest this term",
    tone: "var(--clay-500)"
  }), /*#__PURE__*/React.createElement(StatTile, {
    icon: "clock",
    label: "This week",
    value: "9.5 hrs",
    sub: "Goal: 10 hrs",
    tone: "var(--sage-500)"
  }), /*#__PURE__*/React.createElement(StatTile, {
    icon: "star",
    label: "Milestones",
    value: "7",
    sub: "+2 this month",
    tone: "var(--gold-500)"
  })), /*#__PURE__*/React.createElement(DCard, {
    padding: "lg",
    style: {
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '1.05rem',
      color: 'var(--text-strong)',
      marginBottom: 18
    }
  }, "Subject mastery"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, subjects.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 130,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, s.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.75rem',
      color: 'var(--text-subtle)'
    }
  }, s.grade)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(DProgress, {
    value: s.pct,
    tone: s.tone
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 700,
      color: 'var(--text-body)'
    }
  }, s.pct, "%"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 84,
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement(DBadge, {
    tone: s.badge[1]
  }, s.badge[0])))))), /*#__PURE__*/React.createElement(DCallout, {
    tone: "sage",
    title: "A note from HOMA",
    icon: /*#__PURE__*/React.createElement(DIcon, {
      name: "sparkles",
      size: 19
    })
  }, "Maya\u2019s right on pace for the term, and she\u2019s mastered every fractions objective, reading is really flying. Nothing to worry about this week.", /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-hand)',
      fontSize: '1.5rem',
      color: 'var(--sage-600)',
      marginTop: 8,
      lineHeight: 1
    }
  }, "you\u2019re doing great \u2726")));
}
Object.assign(window, {
  DashboardView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/DashboardView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/DiscoverView.jsx
try { (() => {
// HOMA web app, Discover: lessons connected to the real world, and to other families.
const {
  Card: VCard,
  Badge: VBadge,
  Icon: VIcon,
  Button: VButton,
  Avatar: VAvatar
} = window.HOMADesignSystem_113bd2;
function VSuggestion({
  eyebrow,
  title,
  body,
  icon,
  tint,
  fg,
  primary,
  secondary
}) {
  return /*#__PURE__*/React.createElement(VCard, {
    padding: "lg",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 'var(--radius-lg)',
      background: tint,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(VIcon, {
    name: icon,
    size: 24,
    color: fg
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.66rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: fg
    }
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.3rem',
      fontWeight: 500,
      color: 'var(--text-strong)',
      lineHeight: 1.25,
      letterSpacing: '-0.01em',
      margin: '6px 0'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.9rem',
      color: 'var(--text-muted)',
      lineHeight: 1.5
    }
  }, body), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(VButton, {
    size: "sm"
  }, primary), /*#__PURE__*/React.createElement(VButton, {
    size: "sm",
    variant: "ghost"
  }, secondary)))));
}
function DiscoverView() {
  const nearby = [['book-open', 'Story hour', 'Central Library · Thu 10:00', 'Free'], ['users', 'Cedar Park co-op', 'Tuesdays · 12 families', 'Meets weekly'], ['cloud-rain', 'Rainy-day pick', 'Hopscotch Play Lab · open play', 'Today'], ['landmark', 'Blanton Museum', 'Free family Sunday', 'This weekend']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '30px 36px',
      maxWidth: 1000,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)'
    }
  }, "Discover \xB7 Austin, TX"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2rem',
      fontWeight: 500,
      letterSpacing: '-0.02em',
      color: 'var(--text-strong)',
      margin: '6px 0 0'
    }
  }, "This week, out in the world"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-muted)',
      marginTop: 6
    }
  }, "Matched to what you're teaching, not just what's nearby.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement(VSuggestion, {
    eyebrow: "Maya \xB7 Space unit",
    title: /*#__PURE__*/React.createElement("span", null, "The Bullock has a family space day ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontStyle: 'italic',
        color: 'var(--clay-600)'
      }
    }, "this Saturday"), "."),
    body: "Planetarium shows at 10 and 2, and it lines up with her astronomy week. Want me to hold tickets?",
    icon: "telescope",
    tint: "var(--clay-50)",
    fg: "var(--clay-600)",
    primary: "Get tickets",
    secondary: "Not this week"
  }), /*#__PURE__*/React.createElement(VSuggestion, {
    eyebrow: "Eli \xB7 Animal unit",
    title: "Red pandas at the Austin Zoo, Eli's exact animal.",
    body: "A morning visit covers his habitat lesson. I'll pack the observation sheet.",
    icon: "paw-print",
    tint: "var(--sage-50)",
    fg: "var(--sage-600)",
    primary: "Plan a zoo morning",
    secondary: "Maybe later"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)',
      marginBottom: 12
    }
  }, "Nearby this week"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14,
      marginBottom: 28
    }
  }, nearby.map(([ic, t, d, tag]) => /*#__PURE__*/React.createElement(VCard, {
    key: t,
    padding: "md",
    interactive: true
  }, /*#__PURE__*/React.createElement(VIcon, {
    name: ic,
    size: 22,
    color: "var(--brand)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: 'var(--text-strong)',
      margin: '10px 0 3px',
      fontSize: '0.95rem'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--text-muted)',
      lineHeight: 1.45
    }
  }, d), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(VBadge, {
    tone: "neutral"
  }, tag))))), /*#__PURE__*/React.createElement(VCard, {
    padding: "lg",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, ['Ana M', 'Dana K', 'Priya S', 'Lena R'].map((n, i) => /*#__PURE__*/React.createElement("span", {
    key: n,
    style: {
      marginLeft: i ? -10 : 0
    }
  }, /*#__PURE__*/React.createElement(VAvatar, {
    name: n,
    size: 40
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.15rem',
      fontWeight: 500,
      color: 'var(--text-strong)'
    }
  }, "4 HOMA families homeschool within 5 miles."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.88rem',
      color: 'var(--text-muted)',
      marginTop: 3
    }
  }, "Two are planning park days this month. You don't have to do this alone.")), /*#__PURE__*/React.createElement(VButton, {
    variant: "secondary",
    iconLeft: /*#__PURE__*/React.createElement(VIcon, {
      name: "hand",
      size: 16
    })
  }, "Say hi")));
}
Object.assign(window, {
  DiscoverView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/DiscoverView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/Onboarding.jsx
try { (() => {
// HOMA web app, first-run onboarding: add kids → pick subjects → HOMA drafts the week.
const {
  Logo: OLogo,
  Button: OButton,
  Input: OInput,
  Select: OSelect,
  Chip: OChip,
  Switch: OSwitch,
  Skeleton: OSkeleton,
  Callout: OCallout,
  Icon: OIcon,
  Avatar: OAvatar
} = window.HOMADesignSystem_113bd2;
function ODots({
  step
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'center'
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: i === step ? 22 : 8,
      height: 8,
      borderRadius: 'var(--radius-pill)',
      background: i <= step ? 'var(--brand)' : 'var(--stone-200)',
      transition: 'all var(--dur-base) var(--ease-out)'
    }
  })));
}
function OStepKids({
  kids,
  setKids
}) {
  const [name, setName] = React.useState('');
  const [grade, setGrade] = React.useState('Grade 3');
  const add = () => {
    if (!name.trim()) return;
    setKids([...kids, {
      name: name.trim(),
      grade
    }]);
    setName('');
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2.1rem',
      fontWeight: 500,
      letterSpacing: '-0.02em',
      color: 'var(--text-strong)',
      margin: 0
    }
  }, "Who are we teaching?"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-muted)',
      margin: '10px 0 0',
      lineHeight: 1.5
    }
  }, "Add each of your kids, I'll keep their plans and progress separate.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(OInput, {
    label: "Name",
    placeholder: "e.g. Maya",
    value: name,
    onChange: e => setName(e.target.value),
    style: {
      flex: 1.3
    }
  }), /*#__PURE__*/React.createElement(OSelect, {
    label: "Grade",
    options: ['Pre-K', 'K', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
    value: grade,
    onChange: e => setGrade(e.target.value),
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(OButton, {
    variant: "soft",
    onClick: add,
    style: {
      marginBottom: 1
    }
  }, "Add")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 18,
      minHeight: 64
    }
  }, kids.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-subtle)',
      fontSize: '0.9rem',
      textAlign: 'center',
      padding: '16px 0',
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic'
    }
  }, "No pressure, you can always add more later."), kids.map((k, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      boxShadow: 'var(--shadow-xs)'
    }
  }, /*#__PURE__*/React.createElement(OAvatar, {
    name: k.name,
    size: 32
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, k.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--text-subtle)'
    }
  }, k.grade), /*#__PURE__*/React.createElement("button", {
    onClick: () => setKids(kids.filter((_, j) => j !== i)),
    "aria-label": "Remove",
    style: {
      marginLeft: 'auto',
      border: 'none',
      background: 'transparent',
      color: 'var(--text-subtle)',
      cursor: 'pointer',
      fontSize: '1rem',
      padding: 4
    }
  }, "\xD7")))));
}
function OStepSubjects({
  subjects,
  setSubjects,
  standards,
  setStandards
}) {
  const all = ['Math', 'Reading', 'Writing', 'Science', 'History', 'Art', 'Music', 'Nature study', 'Bible', 'Spanish'];
  const toggle = s => setSubjects(subjects.includes(s) ? subjects.filter(x => x !== s) : [...subjects, s]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2.1rem',
      fontWeight: 500,
      letterSpacing: '-0.02em',
      color: 'var(--text-strong)',
      margin: 0
    }
  }, "What matters this year?"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-muted)',
      margin: '10px 0 0',
      lineHeight: 1.5
    }
  }, "Pick your subjects. I'll balance them across the week.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'center'
    }
  }, all.map(s => /*#__PURE__*/React.createElement(OChip, {
    key: s,
    selected: subjects.includes(s),
    onClick: () => toggle(s)
  }, s))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 26
    }
  }, /*#__PURE__*/React.createElement(OSwitch, {
    label: "Map progress to my state's standards",
    checked: standards,
    onChange: setStandards
  })));
}
function OStepDraft({
  kids,
  subjects,
  onDone
}) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setReady(true), 1600);
    return () => clearTimeout(t);
  }, []);
  const first = kids[0] && kids[0].name.split(' ')[0] || 'Maya';
  const rows = [[subjects[0] || 'Math', 'Short daily rhythm, 30m', 'var(--clay-50)', 'var(--clay-600)', 'divide'], [subjects[1] || 'Reading', 'A chapter + read-aloud', 'var(--sage-50)', 'var(--sage-600)', 'book-open'], [subjects[2] || 'Science', 'One hands-on afternoon', 'var(--gold-100)', '#9a7118', 'leaf']];
  if (!ready) {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'center',
        marginBottom: 28
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: 'var(--font-display)',
        fontSize: '2.1rem',
        fontWeight: 500,
        letterSpacing: '-0.02em',
        color: 'var(--text-strong)',
        margin: 0
      }
    }, "Pulling ", first, "'s week together\u2026")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-md)',
        padding: '13px 14px',
        boxShadow: 'var(--shadow-xs)'
      }
    }, /*#__PURE__*/React.createElement(OSkeleton, {
      width: 40,
      height: 40,
      radius: "var(--radius-md)"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 7
      }
    }, /*#__PURE__*/React.createElement(OSkeleton, {
      width: "55%",
      height: 14
    }), /*#__PURE__*/React.createElement(OSkeleton, {
      width: "35%",
      height: 10
    }))))));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '2.1rem',
      fontWeight: 500,
      letterSpacing: '-0.02em',
      color: 'var(--text-strong)',
      margin: 0
    }
  }, "Here's ", first, "'s week"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-muted)',
      margin: '10px 0 0'
    }
  }, "A first draft, we'll shape it together as we go.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginBottom: 18
    }
  }, rows.map(([s, d, bg, fg, ic]) => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-md)',
      padding: '13px 14px',
      boxShadow: 'var(--shadow-xs)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--radius-md)',
      background: bg,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(OIcon, {
    name: ic,
    size: 18,
    color: fg
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: 'var(--text-strong)',
      fontSize: '0.95rem'
    }
  }, s), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--text-subtle)'
    }
  }, d))))), /*#__PURE__*/React.createElement(OCallout, {
    tone: "sage",
    title: "A note from HOMA",
    icon: /*#__PURE__*/React.createElement(OIcon, {
      name: "sparkles",
      size: 18
    })
  }, "I kept it light on purpose, it's easier to add than to take away.", /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-hand)',
      fontSize: '1.45rem',
      color: 'var(--sage-600)',
      marginTop: 6,
      lineHeight: 1
    }
  }, "we'll adjust as we go \u2726")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(OButton, {
    size: "lg",
    onClick: onDone,
    iconRight: /*#__PURE__*/React.createElement(OIcon, {
      name: "arrow-right",
      size: 17,
      color: "#fff"
    })
  }, "Looks good, take me home")));
}
function Onboarding() {
  const [step, setStep] = React.useState(0);
  const [kids, setKids] = React.useState([{
    name: 'Maya',
    grade: 'Grade 3'
  }]);
  const [subjects, setSubjects] = React.useState(['Math', 'Reading', 'Science']);
  const [standards, setStandards] = React.useState(true);
  React.useEffect(() => {
    setTimeout(() => window.lucide && window.lucide.createIcons(), 80);
  });
  const canNext = step === 0 ? kids.length > 0 : step === 1 ? subjects.length > 0 : false;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: 'var(--bg-page-warm)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 560,
      maxWidth: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(OLogo, {
    size: 30
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-2xl)',
      boxShadow: 'var(--shadow-lg)',
      padding: '40px 44px 34px'
    }
  }, step === 0 && /*#__PURE__*/React.createElement(OStepKids, {
    kids: kids,
    setKids: setKids
  }), step === 1 && /*#__PURE__*/React.createElement(OStepSubjects, {
    subjects: subjects,
    setSubjects: setSubjects,
    standards: standards,
    setStandards: setStandards
  }), step === 2 && /*#__PURE__*/React.createElement(OStepDraft, {
    kids: kids,
    subjects: subjects,
    onDone: () => {
      window.location.href = 'index.html';
    }
  }), step < 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 30
    }
  }, /*#__PURE__*/React.createElement(OButton, {
    variant: "ghost",
    onClick: () => setStep(Math.max(0, step - 1)),
    style: {
      visibility: step === 0 ? 'hidden' : 'visible'
    }
  }, "Back"), /*#__PURE__*/React.createElement(OButton, {
    disabled: !canNext,
    onClick: () => setStep(step + 1),
    iconRight: /*#__PURE__*/React.createElement(OIcon, {
      name: "arrow-right",
      size: 16,
      color: "#fff"
    })
  }, "Continue"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(ODots, {
    step: step
  }))));
}
Object.assign(window, {
  Onboarding
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/Onboarding.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/PlannerView.jsx
try { (() => {
// HOMA web app, weekly planner view.
const {
  Card: PCard,
  Badge: PBadge,
  Icon: PIcon,
  IconButton: PIconButton,
  Button: PButton
} = window.HOMADesignSystem_113bd2;
function PlannerView() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const subjectTone = {
    Math: ['var(--clay-50)', 'var(--clay-700)', 'var(--clay-300)'],
    Reading: ['var(--sage-50)', 'var(--sage-700)', 'var(--sage-300)'],
    Science: ['var(--gold-100)', '#8a6410', 'var(--gold-300)'],
    Writing: ['var(--info-soft)', 'var(--sky-600)', 'var(--sky-300)'],
    Art: ['var(--clay-100)', 'var(--clay-700)', 'var(--clay-300)']
  };
  const plan = {
    Mon: [['Math', 'Fractions review', '30m'], ['Reading', 'Chapter 4', '30m'], ['Science', 'Plant journal', '45m']],
    Tue: [['Math', 'Word problems', '30m'], ['Writing', 'Story draft', '40m']],
    Wed: [['Reading', 'Read-aloud', '30m'], ['Art', 'Watercolor', '60m']],
    Thu: [['Math', 'Times tables', '25m'], ['Science', 'Nature walk', '60m'], ['Reading', 'Chapter 5', '30m']],
    Fri: [['Writing', 'Finish story', '40m'], ['Math', 'Quiz', '30m']]
  };
  function block([subj, title, dur], key) {
    const [bg, fg, bar] = subjectTone[subj];
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      style: {
        background: bg,
        borderLeft: `3px solid ${bar}`,
        borderRadius: 'var(--radius-sm)',
        padding: '9px 11px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.7rem',
        fontWeight: 700,
        color: fg,
        textTransform: 'uppercase',
        letterSpacing: '0.03em'
      }
    }, subj), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.85rem',
        color: 'var(--text-body)',
        fontWeight: 500,
        marginTop: 2
      }
    }, title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.72rem',
        color: 'var(--text-subtle)',
        marginTop: 3
      }
    }, dur));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '28px 36px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.8rem',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, "This week"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-muted)'
    }
  }, "May 12\u201316 \xB7 Maya \xB7 Grade 3")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginLeft: 'auto',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(PIconButton, {
    variant: "outline",
    ariaLabel: "Previous week"
  }, /*#__PURE__*/React.createElement(PIcon, {
    name: "chevron-left",
    size: 18
  })), /*#__PURE__*/React.createElement(PIconButton, {
    variant: "outline",
    ariaLabel: "Next week"
  }, /*#__PURE__*/React.createElement(PIcon, {
    name: "chevron-right",
    size: 18
  })), /*#__PURE__*/React.createElement(PButton, {
    variant: "primary",
    iconLeft: /*#__PURE__*/React.createElement(PIcon, {
      name: "sparkles",
      size: 17,
      color: "#fff"
    })
  }, "Auto-plan with HOMA"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 14
    }
  }, days.map(d => /*#__PURE__*/React.createElement("div", {
    key: d
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 10,
      padding: '0 2px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: 'var(--text-body)'
    }
  }, d), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.72rem',
      color: 'var(--text-subtle)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, plan[d].reduce((a, [,, t]) => a + parseInt(t), 0), "m")), /*#__PURE__*/React.createElement(PCard, {
    padding: "sm",
    style: {
      minHeight: 260
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, plan[d].map((b, i) => block(b, i)), /*#__PURE__*/React.createElement("button", {
    style: {
      border: '1.5px dashed var(--border-default)',
      background: 'transparent',
      borderRadius: 'var(--radius-sm)',
      padding: '8px',
      color: 'var(--text-subtle)',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.8rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(PIcon, {
    name: "plus",
    size: 14
  }), " Add")))))));
}
Object.assign(window, {
  PlannerView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/PlannerView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/Sidebar.jsx
try { (() => {
// HOMA web app, left navigation sidebar.
const {
  Avatar: HAvatar,
  Icon: HIcon,
  Badge: HBadge,
  Logo: HLogo
} = window.HOMADesignSystem_113bd2;
function Sidebar({
  active,
  onNavigate,
  kids
}) {
  const nav = [{
    id: 'chat',
    icon: 'sparkles',
    label: 'Ask HOMA'
  }, {
    id: 'dashboard',
    icon: 'chart-line',
    label: 'Progress'
  }, {
    id: 'benchmarks',
    icon: 'clipboard-check',
    label: 'Benchmarks'
  }, {
    id: 'planner',
    icon: 'calendar',
    label: 'Week planner'
  }, {
    id: 'discover',
    icon: 'compass',
    label: 'Discover'
  }, {
    id: 'curriculum',
    icon: 'scale',
    label: 'Curriculum'
  }, {
    id: 'worksheets',
    icon: 'file-pen',
    label: 'Worksheets'
  }, {
    id: 'library',
    icon: 'book-open',
    label: 'Library'
  }];
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 248,
      flexShrink: 0,
      background: 'var(--surface-card)',
      borderRight: '1px solid var(--border-subtle)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 10px 20px'
    }
  }, /*#__PURE__*/React.createElement(HLogo, {
    size: 28
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, nav.map(n => {
    const on = active === n.id;
    return /*#__PURE__*/React.createElement("button", {
      key: n.id,
      onClick: () => onNavigate(n.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 12px',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        background: on ? 'var(--brand-soft)' : 'transparent',
        color: on ? 'var(--clay-700)' : 'var(--text-muted)',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.95rem',
        fontWeight: on ? 700 : 500,
        textAlign: 'left',
        transition: 'background var(--dur-fast) var(--ease-out)'
      }
    }, /*#__PURE__*/React.createElement(HIcon, {
      name: n.icon,
      size: 20,
      color: on ? 'var(--brand)' : 'var(--text-subtle)'
    }), n.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      padding: '0 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)',
      marginBottom: 10
    }
  }, "My kids"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, kids.map(k => /*#__PURE__*/React.createElement("div", {
    key: k.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 4px'
    }
  }, /*#__PURE__*/React.createElement(HAvatar, {
    name: k.name,
    size: 30
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.875rem',
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, k.name.split(' ')[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.72rem',
      color: 'var(--text-subtle)'
    }
  }, k.grade)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement(HAvatar, {
    name: "Sarah Rivera",
    size: 34,
    tone: "var(--sage-500)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, "Sarah"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.72rem',
      color: 'var(--text-subtle)'
    }
  }, "Family plan")), /*#__PURE__*/React.createElement(HIcon, {
    name: "settings",
    size: 18,
    color: "var(--text-subtle)"
  })));
}
Object.assign(window, {
  Sidebar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/Sidebar.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Callout = __ds_scope.Callout;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Skeleton = __ds_scope.Skeleton;

})();
