// Homa web app, kid progress dashboard.
const { Card: DCard, Badge: DBadge, ProgressBar: DProgress, Avatar: DAvatar, Icon: DIcon, Tabs: DTabs, Callout: DCallout } = window.HomaDesignSystem_5e2305;

function StatTile({ icon, label, value, sub, tone: [bg, ink] }) {
  return (
    <DCard padding="md" style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 'var(--blob-2)', background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <DIcon name={icon} size={19} color={ink} />
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 600, color: 'var(--text-strong)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: 4 }}>{sub}</div>
    </DCard>
  );
}

function DashboardView() {
  const [tab, setTab] = React.useState('Overview');
  const subjects = [
    { name: 'Math', grade: 'Grade 3', pct: 68, tone: 'brand', badge: ['On track', 'sage'] },
    { name: 'Reading', grade: 'Grade 4', pct: 82, tone: 'sage', badge: ['Ahead', 'gold'] },
    { name: 'Science', grade: 'Grade 3', pct: 44, tone: 'gold', badge: ['Review', 'warning'] },
    { name: 'Writing', grade: 'Grade 3', pct: 57, tone: 'brand', badge: ['On track', 'sage'] },
  ];
  return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <DAvatar name="Maya Rivera" size={52} />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 600, color: 'var(--text-strong)' }}>Maya's progress</div>
          <div style={{ color: 'var(--text-muted)' }}>Grade 3 · 4 subjects · term ends May 30</div>
        </div>
        <div style={{ marginLeft: 'auto' }}><DBadge tone="sage" variant="solid">On track</DBadge></div>
      </div>

      <div style={{ margin: '18px 0 22px' }}>
        <DTabs tabs={['Overview', 'Subjects', 'Reports', 'Standards']} value={tab} onChange={setTab} />
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 22 }}>
        <StatTile icon="flame" label="Streak" value="12 days" sub="Longest this term" tone={['var(--clay-50)', 'var(--clay-600)']} />
        <StatTile icon="clock" label="This week" value="9.5 hrs" sub="Goal: 10 hrs" tone={['var(--sage-50)', 'var(--sage-600)']} />
        <StatTile icon="star" label="Milestones" value="7" sub="+2 this month" tone={['var(--gold-100)', 'var(--gold-ink)']} />
      </div>

      <DCard padding="lg" style={{ marginBottom: 22 }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-strong)', marginBottom: 18 }}>Subject mastery</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {subjects.map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 130, flexShrink: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-body)' }}>{s.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{s.grade}</div>
              </div>
              <div style={{ flex: 1 }}><DProgress value={s.pct} tone={s.tone} /></div>
              <div style={{ width: 46, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text-body)' }}>{s.pct}%</div>
              <div style={{ width: 84, textAlign: 'right' }}><DBadge tone={s.badge[1]}>{s.badge[0]}</DBadge></div>
            </div>
          ))}
        </div>
      </DCard>

      <DCallout tone="sage" title="A note from Homa" icon={<DIcon name="sparkles" size={19} />}>
        Maya&rsquo;s right on pace for the term, and she&rsquo;s mastered every fractions objective, reading is really flying. Nothing to worry about this week.
        <div style={{ fontFamily: 'var(--font-hand)', fontWeight: 600, fontSize: '1.5rem', color: 'var(--sage-600)', marginTop: 8, lineHeight: 1 }}>you&rsquo;re doing great &#10022;</div>
      </DCallout>
    </div>
  );
}

Object.assign(window, { DashboardView });
