// HOMA web app, left navigation sidebar.
const { Avatar: HAvatar, Icon: HIcon, Badge: HBadge, Logo: HLogo } = window.HOMADesignSystem_113bd2;

function Sidebar({ active, onNavigate, kids }) {
  const nav = [
    { id: 'chat', icon: 'sparkles', label: 'Ask HOMA' },
    { id: 'dashboard', icon: 'chart-line', label: 'Progress' },
    { id: 'benchmarks', icon: 'clipboard-check', label: 'Benchmarks' },
    { id: 'planner', icon: 'calendar', label: 'Week planner' },
    { id: 'discover', icon: 'compass', label: 'Discover' },
    { id: 'curriculum', icon: 'scale', label: 'Curriculum' },
    { id: 'worksheets', icon: 'file-pen', label: 'Worksheets' },
    { id: 'library', icon: 'book-open', label: 'Library' },
  ];
  return (
    <aside style={{
      width: 248, flexShrink: 0, background: 'var(--surface-card)',
      borderRight: '1px solid var(--border-subtle)', height: '100%',
      display: 'flex', flexDirection: 'column', padding: '20px 14px',
    }}>
      <div style={{ padding: '4px 10px 20px' }}>
        <HLogo size={28} />
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(n => {
          const on = active === n.id;
          return (
            <button key={n.id} onClick={() => onNavigate(n.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px',
              border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              background: on ? 'var(--brand-soft)' : 'transparent',
              color: on ? 'var(--clay-700)' : 'var(--text-muted)',
              fontFamily: 'var(--font-sans)', fontSize: '0.95rem', fontWeight: on ? 700 : 500,
              textAlign: 'left', transition: 'background var(--dur-fast) var(--ease-out)',
            }}>
              <HIcon name={n.icon} size={20} color={on ? 'var(--brand)' : 'var(--text-subtle)'} />
              {n.label}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 24, padding: '0 12px' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 10 }}>My kids</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {kids.map(k => (
            <div key={k.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
              <HAvatar name={k.name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-body)' }}>{k.name.split(' ')[0]}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>{k.grade}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: '1px solid var(--border-subtle)' }}>
        <HAvatar name="Sarah Rivera" size={34} tone="var(--sage-500)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-body)' }}>Sarah</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>Family plan</div>
        </div>
        <HIcon name="settings" size={18} color="var(--text-subtle)" />
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
