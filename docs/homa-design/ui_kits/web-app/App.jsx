// HOMA web app, shell: login gate + authenticated app frame.
const { Button: AButton, Input: AInput, Icon: AIcon, Logo: ALogo } = window.HOMADesignSystem_113bd2;

function Login({ onEnter }) {
  return (
    <div style={{ height: '100%', display: 'flex' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
        <div style={{ width: 340, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', marginBottom: 22 }}>
            <ALogo size={34} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text-strong)', marginBottom: 6 }}>Welcome back</div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Your homeschool co-pilot is ready.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
            <AInput label="Email" placeholder="sarah@family.com" iconLeft={<AIcon name="mail" size={18} />} />
            <AInput label="Password" type="password" placeholder="••••••••" iconLeft={<AIcon name="lock" size={18} />} />
            <AButton variant="primary" fullWidth onClick={onEnter} style={{ marginTop: 6 }}>Sign in</AButton>
          </div>
          <div style={{ color: 'var(--text-subtle)', fontSize: '0.85rem', marginTop: 18 }}>New here? <a href="onboarding.html" style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>Start free</a></div>
        </div>
      </div>
      <div style={{ flex: 1, background: 'linear-gradient(160deg, var(--clay-400), var(--clay-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ maxWidth: 380, color: '#fff' }}>
          <AIcon name="sparkles" size={30} color="#fff" />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 500, lineHeight: 1.25, marginTop: 16 }}>
            “HOMA plans our week in five minutes. I finally have my evenings back.”
          </div>
          <div style={{ marginTop: 16, opacity: 0.9, fontWeight: 600 }}>Dana, mom of three</div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [authed, setAuthed] = React.useState(false);
  const [view, setView] = React.useState('chat');
  const kids = [
    { name: 'Maya Rivera', grade: 'Grade 3' },
    { name: 'Eli Rivera', grade: 'Grade 1' },
    { name: 'Nora Rivera', grade: 'Pre-K' },
  ];

  React.useEffect(() => { setTimeout(() => window.lucide && window.lucide.createIcons(), 60); });

  if (!authed) return <Login onEnter={() => setAuthed(true)} />;

  const views = {
    chat: <ChatView />,
    dashboard: <DashboardView />,
    benchmarks: <BenchmarksView />,
    planner: <PlannerView />,
    discover: <DiscoverView />,
    curriculum: <CurriculumView />,
    worksheets: <Placeholder title="Worksheets" icon="file-pen" />,
    library: <Placeholder title="Library" icon="book-open" />,
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-page)' }}>
      <Sidebar active={view} onNavigate={setView} kids={kids} />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {views[view]}
      </main>
    </div>
  );
}

function Placeholder({ title, icon }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)' }}>
      <AIcon name={icon} size={40} color="var(--stone-400)" />
      <div style={{ marginTop: 12, fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text-muted)' }}>{title}</div>
      <div style={{ fontSize: '0.9rem' }}>Coming together soon.</div>
    </div>
  );
}

Object.assign(window, { App });
