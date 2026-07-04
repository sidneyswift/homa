// HOMA web app, Discover: lessons connected to the real world, and to other families.
const { Card: VCard, Badge: VBadge, Icon: VIcon, Button: VButton, Avatar: VAvatar } = window.HOMADesignSystem_113bd2;

function VSuggestion({ eyebrow, title, body, icon, tint, fg, primary, secondary }) {
  return (
    <VCard padding="lg" style={{ flex: 1 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <span style={{ width: 52, height: 52, borderRadius: 'var(--radius-lg)', background: tint, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <VIcon name={icon} size={24} color={fg} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: fg }}>{eyebrow}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 500, color: 'var(--text-strong)', lineHeight: 1.25, letterSpacing: '-0.01em', margin: '6px 0' }}>{title}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{body}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <VButton size="sm">{primary}</VButton>
            <VButton size="sm" variant="ghost">{secondary}</VButton>
          </div>
        </div>
      </div>
    </VCard>
  );
}

function DiscoverView() {
  const nearby = [
    ['book-open', 'Story hour', 'Central Library · Thu 10:00', 'Free'],
    ['users', 'Cedar Park co-op', 'Tuesdays · 12 families', 'Meets weekly'],
    ['cloud-rain', 'Rainy-day pick', 'Hopscotch Play Lab · open play', 'Today'],
    ['landmark', 'Blanton Museum', 'Free family Sunday', 'This weekend'],
  ];
  return (
    <div style={{ padding: '30px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Discover · Austin, TX</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-strong)', margin: '6px 0 0' }}>This week, out in the world</h1>
        <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>Matched to what you're teaching, not just what's nearby.</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
        <VSuggestion
          eyebrow="Maya · Space unit"
          title={<span>The Bullock has a family space day <span style={{ fontStyle: 'italic', color: 'var(--clay-600)' }}>this Saturday</span>.</span>}
          body="Planetarium shows at 10 and 2, and it lines up with her astronomy week. Want me to hold tickets?"
          icon="telescope" tint="var(--clay-50)" fg="var(--clay-600)"
          primary="Get tickets" secondary="Not this week"
        />
        <VSuggestion
          eyebrow="Eli · Animal unit"
          title="Red pandas at the Austin Zoo, Eli's exact animal."
          body="A morning visit covers his habitat lesson. I'll pack the observation sheet."
          icon="paw-print" tint="var(--sage-50)" fg="var(--sage-600)"
          primary="Plan a zoo morning" secondary="Maybe later"
        />
      </div>

      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 12 }}>Nearby this week</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {nearby.map(([ic, t, d, tag]) => (
          <VCard key={t} padding="md" interactive>
            <VIcon name={ic} size={22} color="var(--brand)" />
            <div style={{ fontWeight: 700, color: 'var(--text-strong)', margin: '10px 0 3px', fontSize: '0.95rem' }}>{t}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>{d}</div>
            <div style={{ marginTop: 10 }}><VBadge tone="neutral">{tag}</VBadge></div>
          </VCard>
        ))}
      </div>

      <VCard padding="lg" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ display: 'flex' }}>
          {['Ana M', 'Dana K', 'Priya S', 'Lena R'].map((n, i) => <span key={n} style={{ marginLeft: i ? -10 : 0 }}><VAvatar name={n} size={40} /></span>)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 500, color: 'var(--text-strong)' }}>4 HOMA families homeschool within 5 miles.</div>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 3 }}>Two are planning park days this month. You don't have to do this alone.</div>
        </div>
        <VButton variant="secondary" iconLeft={<VIcon name="hand" size={16} />}>Say hi</VButton>
      </VCard>
    </div>
  );
}

Object.assign(window, { DiscoverView });
