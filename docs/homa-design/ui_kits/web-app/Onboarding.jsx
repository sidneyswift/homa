// Homa web app, first-run onboarding: add kids → pick subjects → Homa drafts the week.
const { Logo: OLogo, Button: OButton, Input: OInput, Select: OSelect, Chip: OChip, Switch: OSwitch, Skeleton: OSkeleton, Callout: OCallout, Icon: OIcon, Avatar: OAvatar } = window.HomaDesignSystem_5e2305;

function ODots({ step }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: i === step ? 22 : 8, height: 8, borderRadius: 'var(--radius-pill)',
          background: i <= step ? 'var(--brand)' : 'var(--stone-200)',
          transition: 'all var(--dur-base) var(--ease-out)',
        }} />
      ))}
    </div>
  );
}

function OStepKids({ kids, setKids }) {
  const [name, setName] = React.useState('');
  const [grade, setGrade] = React.useState('Grade 3');
  const add = () => {
    if (!name.trim()) return;
    setKids([...kids, { name: name.trim(), grade }]);
    setName('');
  };
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-strong)', margin: 0 }}>Who are we teaching?</h1>
        <p style={{ color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>Add each of your kids, I'll keep their plans and progress separate.</p>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <OInput label="Name" placeholder="e.g. Maya" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1.3 }} />
        <OSelect label="Grade" options={['Pre-K', 'K', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']} value={grade} onChange={e => setGrade(e.target.value)} style={{ flex: 1 }} />
        <OButton variant="soft" onClick={add} style={{ marginBottom: 1 }}>Add</OButton>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18, minHeight: 64 }}>
        {kids.length === 0 && (
          <div style={{ color: 'var(--text-subtle)', fontSize: '0.9rem', textAlign: 'center', padding: '16px 0', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400 }}>No pressure, you can always add more later.</div>
        )}
        {kids.map((k, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: '10px 14px', boxShadow: 'var(--shadow-xs)' }}>
            <OAvatar name={k.name} size={32} />
            <span style={{ fontWeight: 600, color: 'var(--text-body)' }}>{k.name}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>{k.grade}</span>
            <button onClick={() => setKids(kids.filter((_, j) => j !== i))} aria-label="Remove" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '1rem', padding: 4 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OStepSubjects({ subjects, setSubjects, standards, setStandards }) {
  const all = ['Math', 'Reading', 'Writing', 'Science', 'History', 'Art', 'Music', 'Nature study', 'Bible', 'Spanish'];
  const toggle = s => setSubjects(subjects.includes(s) ? subjects.filter(x => x !== s) : [...subjects, s]);
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-strong)', margin: 0 }}>What matters this year?</h1>
        <p style={{ color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>Pick your subjects. I'll balance them across the week.</p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
        {all.map(s => <OChip key={s} selected={subjects.includes(s)} onClick={() => toggle(s)}>{s}</OChip>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 26 }}>
        <OSwitch label="Map progress to my state's standards" checked={standards} onChange={setStandards} />
      </div>
    </div>
  );
}

function OStepDraft({ kids, subjects, onDone }) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setReady(true), 1600);
    return () => clearTimeout(t);
  }, []);
  const first = (kids[0] && kids[0].name.split(' ')[0]) || 'Maya';
  const rows = [
    [subjects[0] || 'Math', 'Short daily rhythm, 30m', 'var(--clay-50)', 'var(--clay-600)', 'divide'],
    [subjects[1] || 'Reading', 'A chapter + read-aloud', 'var(--sage-50)', 'var(--sage-600)', 'book-open'],
    [subjects[2] || 'Science', 'One hands-on afternoon', 'var(--gold-100)', 'var(--gold-ink)', 'leaf'],
  ];
  if (!ready) {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-strong)', margin: 0 }}>Pulling {first}'s week together…</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: '13px 14px', boxShadow: 'var(--shadow-xs)' }}>
              <OSkeleton width={40} height={40} radius="var(--radius-md)" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <OSkeleton width="55%" height={14} />
                <OSkeleton width="35%" height={10} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-strong)', margin: 0 }}>Here's {first}'s week</h1>
        <p style={{ color: 'var(--text-muted)', margin: '10px 0 0' }}>A first draft, we'll shape it together as we go.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {rows.map(([s, d, bg, fg, ic]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: '13px 14px', boxShadow: 'var(--shadow-xs)' }}>
            <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <OIcon name={ic} size={18} color={fg} />
            </span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.95rem' }}>{s}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>{d}</div>
            </div>
          </div>
        ))}
      </div>
      <OCallout tone="sage" title="A note from Homa" icon={<OIcon name="sparkles" size={18} />}>
        I kept it light on purpose, it's easier to add than to take away.
        <div style={{ fontFamily: 'var(--font-hand)', fontWeight: 600, fontSize: '1.45rem', color: 'var(--sage-600)', marginTop: 6, lineHeight: 1 }}>we'll adjust as we go &#10022;</div>
      </OCallout>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
        <OButton size="lg" onClick={onDone} iconRight={<OIcon name="arrow-right" size={17} color="#fff" />}>Looks good, take me home</OButton>
      </div>
    </div>
  );
}

function Onboarding() {
  const [step, setStep] = React.useState(0);
  const [kids, setKids] = React.useState([{ name: 'Maya', grade: 'Grade 3' }]);
  const [subjects, setSubjects] = React.useState(['Math', 'Reading', 'Science']);
  const [standards, setStandards] = React.useState(true);
  React.useEffect(() => { setTimeout(() => window.lucide && window.lucide.createIcons(), 80); });
  const canNext = step === 0 ? kids.length > 0 : step === 1 ? subjects.length > 0 : false;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page-warm)', backgroundImage: 'var(--bg-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: 560, maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}><OLogo size={30} /></div>
        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)', padding: '40px 44px 34px' }}>
          {step === 0 && <OStepKids kids={kids} setKids={setKids} />}
          {step === 1 && <OStepSubjects subjects={subjects} setSubjects={setSubjects} standards={standards} setStandards={setStandards} />}
          {step === 2 && <OStepDraft kids={kids} subjects={subjects} onDone={() => { window.location.href = 'index.html'; }} />}
          {step < 2 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 30 }}>
              <OButton variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>Back</OButton>
              <OButton disabled={!canNext} onClick={() => setStep(step + 1)} iconRight={<OIcon name="arrow-right" size={16} color="#fff" />}>Continue</OButton>
            </div>
          )}
        </div>
        <div style={{ marginTop: 20 }}><ODots step={step} /></div>
      </div>
    </div>
  );
}

Object.assign(window, { Onboarding });
