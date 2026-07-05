// Homa web app, Compare curriculums: side-by-side, in plain language, against how the child learns.
const { Card: CCCard, Badge: CCBadge, Button: CCButton, Icon: CCIcon, Callout: CCCallout, Chip: CCChip } = window.HomaDesignSystem_5e2305;

function CCRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid var(--stone-100)' }}>
      <CCIcon name={icon} size={16} color="var(--text-subtle)" style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ fontSize: '0.85rem', lineHeight: 1.45 }}>
        <span style={{ color: 'var(--text-subtle)' }}>{label} · </span>
        <span style={{ color: 'var(--text-body)', fontWeight: 500 }}>{value}</span>
      </div>
    </div>
  );
}

function CurriculumView() {
  const [subject, setSubject] = React.useState('Math');
  const options = [
    {
      name: 'Math-U-See', fit: ['Great fit', 'sage'],
      approach: 'Blocks-first, mastery-based, one concept at a time',
      time: '25–30 min/day', cost: '$112/yr',
      take: 'Maya learns by doing. The blocks match how she already thinks about fractions.',
    },
    {
      name: 'Beast Academy', fit: ['Good stretch', 'gold'],
      approach: 'Puzzle-driven comics, deep problem solving',
      time: '30–40 min/day', cost: '$96/yr',
      take: 'A wonderful Friday challenge. As the main spine it may frustrate her on tired days.',
    },
    {
      name: 'Saxon Math', fit: ['Different style', 'neutral'],
      approach: 'Spiral drill & review, steady and thorough',
      time: '45–60 min/day', cost: '$140/yr',
      take: 'Very solid, but heavy on repetition, the part of math Maya already pushes against.',
    },
  ];
  return (
    <div style={{ padding: '30px 36px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Curriculum · Maya · Grade 3</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-strong)', margin: '6px 0 0' }}>Compare before you commit</h1>
        <div style={{ color: 'var(--text-muted)', marginTop: 6 }}>Plain language, priced out, matched to how Maya actually learns.</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {['Math', 'Reading', 'Science'].map(s => <CCChip key={s} selected={subject === s} onClick={() => setSubject(s)}>{s}</CCChip>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start', marginBottom: 22 }}>
        {options.map(o => (
          <CCCard key={o.name} padding="lg">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-strong)' }}>{o.name}</span>
              <CCBadge tone={o.fit[1]}>{o.fit[0]}</CCBadge>
            </div>
            <CCRow icon="shapes" label="Approach" value={o.approach} />
            <CCRow icon="clock" label="Time" value={o.time} />
            <CCRow icon="wallet" label="Cost" value={o.cost} />
            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, margin: '12px 0 14px' }}>
              &ldquo;{o.take}&rdquo;
            </div>
            <CCButton size="sm" variant={o.fit[1] === 'sage' ? 'primary' : 'secondary'} fullWidth>Try a sample week</CCButton>
          </CCCard>
        ))}
      </div>

      <CCCallout tone="sage" title="A note from Homa" icon={<CCIcon name="sparkles" size={18} />}>
        There's no one right answer, there's the right fit for <em>this</em> kid, <em>this</em> year. Sample weeks are free to run; I'll fold whichever you pick straight into the planner.
      </CCCallout>
    </div>
  );
}

Object.assign(window, { CurriculumView });
