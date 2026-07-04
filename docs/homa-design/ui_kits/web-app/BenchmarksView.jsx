// Homa web app, Benchmarks: where the child stands, gently. The proof loop.
const { Card: BCard, Badge: BBadge, Icon: BIcon, Button: BButton, Checkbox: BCheckbox, Select: BSelect } = window.HOMADesignSystem_113bd2;

function BStanding({ subject, note, badge, tone }) {
  return (
    <BCard padding="md" style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{subject}</span>
        <BBadge tone={tone}>{badge}</BBadge>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>{note}</div>
    </BCard>
  );
}

function BenchmarksView() {
  const [standard, setStandard] = React.useState('Texas (TEKS)');
  const [skills, setSkills] = React.useState({
    'Counts to 120 and beyond': true,
    'Skip-counts by 2s, 5s, 10s': true,
    'Adds and subtracts within 100': true,
    'Tells time to the minute': true,
    'Two-step word problems': false,
    'Single-digit multiplication': false,
  });
  const doneCount = Object.values(skills).filter(Boolean).length;
  return (
    <div style={{ padding: '30px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Benchmarks · Maya · Grade 3</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-strong)', margin: '6px 0 0' }}>Where Maya stands</h1>
        </div>
        <BSelect options={['Texas (TEKS)', 'National (CCSS)']} value={standard} onChange={e => setStandard(e.target.value)} style={{ width: 190 }} />
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        <BStanding subject="Reading" badge="Ahead" tone="gold" note="Reading at a Grade 4 level, comprehension is a real strength." />
        <BStanding subject="Math" badge="On track" tone="sage" note="Solid on number sense; multiplication is the next step." />
        <BStanding subject="Writing" badge="On track" tone="sage" note="Sentences are strong; paragraphs are coming along." />
        <BStanding subject="Science" badge="Ready for review" tone="warning" note="A quick check-in this week would help me map it." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 18, alignItems: 'start' }}>
        <BCard padding="lg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-strong)' }}>Math · number sense checklist</div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{doneCount}/6</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            A checklist for <em>you</em>, never a test for Maya. Check what you've seen her do.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {Object.entries(skills).map(([skill, on]) => (
              <BCheckbox key={skill} label={skill} checked={on} onChange={v => setSkills({ ...skills, [skill]: v })} />
            ))}
          </div>
          <div style={{ fontFamily: 'var(--font-hand)', fontWeight: 600, fontSize: '1.4rem', color: 'var(--sage-600)', marginTop: 18, lineHeight: 1 }}>
            blanks are fine, they're just what's next &#10022;
          </div>
        </BCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <BCard padding="lg">
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-strong)', marginBottom: 12 }}>Growing right now</div>
            {[['file-pen', 'Two-step word problems', '3 practice pages, tuned to where she is'], ['hand', 'Regrouping', 'A hands-on activity with beans & cups, 15 min']].map(([ic, t, d]) => (
              <div key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--stone-100)' }}>
                <span style={{ width: 38, height: 38, borderRadius: 'var(--blob-3)', background: 'var(--clay-50)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BIcon name={ic} size={17} color="var(--clay-600)" />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-body)', fontSize: '0.92rem' }}>{t}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: 2 }}>{d}</div>
                </div>
              </div>
            ))}
            <BButton size="sm" fullWidth style={{ marginTop: 14 }} iconLeft={<BIcon name="sparkles" size={15} color="#fff" />}>Add both to this week</BButton>
          </BCard>

          <BCard padding="lg" style={{ background: 'var(--sage-50)', border: 'none' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--sage-700)', marginBottom: 8 }}>It's working</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 500, color: 'var(--text-strong)', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              Math mastery is up <span style={{ fontStyle: 'italic', color: 'var(--sage-700)', fontFamily: 'var(--font-serif)' }}>12 points</span> since the fractions set.
            </div>
            <svg width="100%" height="54" viewBox="0 0 260 54" preserveAspectRatio="none" style={{ margin: '12px 0 4px' }}>
              <path d="M0 44 C30 42 50 40 80 36 C120 31 150 26 190 16 C220 9 240 7 260 5" fill="none" stroke="var(--sage-500)" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="260" cy="5" r="4" fill="var(--sage-500)" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--text-subtle)', letterSpacing: '0.06em' }}>
              <span>APR</span><span>6 WEEKS</span><span>NOW · 82%</span>
            </div>
            <div style={{ fontFamily: 'var(--font-hand)', fontWeight: 600, fontSize: '1.45rem', color: 'var(--sage-600)', marginTop: 12, lineHeight: 1 }}>your work is paying off &#10022;</div>
          </BCard>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BenchmarksView });
