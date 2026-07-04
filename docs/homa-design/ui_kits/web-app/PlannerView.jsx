// Homa web app, weekly planner view.
const { Card: PCard, Badge: PBadge, Icon: PIcon, IconButton: PIconButton, Button: PButton } = window.HOMADesignSystem_113bd2;

function PlannerView() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const subjectTone = {
    Math: ['var(--clay-50)', 'var(--clay-700)', 'var(--clay-300)'],
    Reading: ['var(--sage-50)', 'var(--sage-700)', 'var(--sage-300)'],
    Science: ['var(--gold-100)', '#8a6410', 'var(--gold-300)'],
    Writing: ['var(--info-soft)', 'var(--sky-600)', 'var(--sky-300)'],
    Art: ['var(--clay-100)', 'var(--clay-700)', 'var(--clay-300)'],
  };
  const plan = {
    Mon: [['Math', 'Fractions review', '30m'], ['Reading', 'Chapter 4', '30m'], ['Science', 'Plant journal', '45m']],
    Tue: [['Math', 'Word problems', '30m'], ['Writing', 'Story draft', '40m']],
    Wed: [['Reading', 'Read-aloud', '30m'], ['Art', 'Watercolor', '60m']],
    Thu: [['Math', 'Times tables', '25m'], ['Science', 'Nature walk', '60m'], ['Reading', 'Chapter 5', '30m']],
    Fri: [['Writing', 'Finish story', '40m'], ['Math', 'Quiz', '30m']],
  };
  function block([subj, title, dur], key) {
    const [bg, fg, bar] = subjectTone[subj];
    return (
      <div key={key} style={{ background: bg, borderLeft: `3px solid ${bar}`, borderRadius: 'var(--radius-sm)', padding: '9px 11px' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: fg, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{subj}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-body)', fontWeight: 500, marginTop: 2 }}>{title}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: 3 }}>{dur}</div>
      </div>
    );
  }
  return (
    <div style={{ padding: '28px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 600, color: 'var(--text-strong)' }}>This week</div>
          <div style={{ color: 'var(--text-muted)' }}>May 12–16 · Maya · Grade 3</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
          <PIconButton variant="outline" ariaLabel="Previous week"><PIcon name="chevron-left" size={18} /></PIconButton>
          <PIconButton variant="outline" ariaLabel="Next week"><PIcon name="chevron-right" size={18} /></PIconButton>
          <PButton variant="primary" iconLeft={<PIcon name="sparkles" size={17} color="#fff" />}>Auto-plan with Homa</PButton>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {days.map(d => (
          <div key={d}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, padding: '0 2px' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-body)' }}>{d}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>{plan[d].reduce((a, [, , t]) => a + parseInt(t), 0)}m</span>
            </div>
            <PCard padding="sm" style={{ minHeight: 260 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plan[d].map((b, i) => block(b, i))}
                <button style={{ border: '1.5px dashed var(--border-default)', background: 'transparent', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--text-subtle)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <PIcon name="plus" size={14} /> Add
                </button>
              </div>
            </PCard>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { PlannerView });
