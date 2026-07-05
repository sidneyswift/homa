// Homa mobile app, screens rendered inside a phone frame.
const { Icon: MIcon, Avatar: MAvatar, ProgressBar: MProgress, Badge: MBadge, Chip: MChip, Callout: MCallout, Logo: MLogo, Doodle: MDoodleRaw } = window.HomaDesignSystem_5e2305;
// Guard against a stale bundle: decoration degrades to nothing, never a crash.
const MDoodle = MDoodleRaw || (() => null);

function StatusBar() {
  return (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-strong)', flexShrink: 0 }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <MIcon name="signal" size={15} /><MIcon name="wifi" size={15} /><MIcon name="battery-full" size={17} />
      </span>
    </div>
  );
}

function TabBar({ active, onNav }) {
  const tabs = [['home', 'Home'], ['sparkles', 'Ask'], ['calendar', 'Plan'], ['compass', 'Discover'], ['clipboard-check', 'Kids']];
  return (
    <div style={{ height: 76, flexShrink: 0, display: 'flex', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-card)', paddingBottom: 14 }}>
      {tabs.map(([ic, lbl]) => {
        const on = active === lbl;
        return (
          <button key={lbl} onClick={() => onNav(lbl)} style={{ flex: 1, border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer', paddingTop: 10 }}>
            <MIcon name={ic} size={22} color={on ? 'var(--brand)' : 'var(--text-subtle)'} />
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: on ? 'var(--brand)' : 'var(--text-subtle)', fontFamily: 'var(--font-sans)' }}>{lbl}</span>
          </button>
        );
      })}
    </div>
  );
}

function Eyebrow({ children, style }) {
  return <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-subtle)', ...style }}>{children}</div>;
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
    Science: ['var(--gold-100)', 'var(--gold-ink)'],
  };
  const tasks = [
    ['Fractions review', 'Math', '30m', 'divide'],
    ['Chapter 4, Charlotte\u2019s Web', 'Reading', '30m', 'book-open'],
    ['Nature journal', 'Science', '45m', 'leaf'],
  ];
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', margin: '6px 0 26px' }}>
        <div>
          <Eyebrow>Tuesday, May 13</Eyebrow>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500, color: 'var(--text-strong)', letterSpacing: '-0.02em', marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>Morning, Sarah <MDoodle name="sun" size={22} color="var(--gold-400)" rotate={10} /></div>
        </div>
        <MAvatar name="Sarah Rivera" size={42} tone="var(--sage-500)" />
      </div>

      <div style={{ background: 'var(--gold-100)', borderRadius: 'var(--radius-xl)', padding: '20px 22px', boxShadow: 'var(--shadow-sm)', marginBottom: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <MIcon name="sparkles" size={16} color="var(--brand)" />
          <Eyebrow style={{ color: 'var(--clay-600)' }}>Today&rsquo;s focus</Eyebrow>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 500, color: 'var(--text-strong)', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
          Three subjects for Maya, <span style={{ color: 'var(--clay-600)' }}>about 1h 45m</span>.
        </div>
      </div>

      <Eyebrow style={{ marginBottom: 14 }}>Up next</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
        {tasks.map(([t, s, d, ic], i) => {
          const [bg, fg] = tint[s];
          const isDone = done[i];
          return (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', padding: '15px 16px', boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: isDone ? 0.55 : 1, transition: 'opacity var(--dur-base) var(--ease-out)' }}>
                <MIcon name={ic} size={19} color={fg} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: isDone ? 'var(--text-subtle)' : 'var(--text-strong)', fontSize: '0.98rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isDone ? 'line-through' : 'none', textDecorationColor: 'var(--stone-300)', transition: 'color var(--dur-base) var(--ease-out)' }}>{t}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: 2 }}>{s} · {d}</div>
              </div>
              <button
                aria-label={isDone ? 'Mark not done' : 'Mark done'}
                onClick={() => setDone(a => a.map((v, j) => j === i ? !v : v))}
                style={{
                  position: 'relative', width: 26, height: 26, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', padding: 0,
                  border: isDone ? 'none' : '1.5px solid var(--border-strong)',
                  background: isDone ? 'var(--sage-500)' : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  animation: isDone ? 'homaPop .35s var(--ease-out)' : 'none',
                }}>
                {isDone && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                {isDone && <span style={{ position: 'absolute', top: -8, right: -9, fontSize: 13, color: 'var(--gold-500)', animation: 'homaStar .8s var(--ease-out) forwards', pointerEvents: 'none' }}>✦</span>}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <Eyebrow>Maya this week</Eyebrow>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-subtle)', letterSpacing: '0.04em' }}>4 subjects</span>
      </div>
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: 'var(--shadow-sm)' }}>
        <MProgress label="Math" value={68} showValue tone="brand" size="sm" />
        <MProgress label="Reading" value={82} showValue tone="sage" size="sm" />
        <MProgress label="Science" value={44} showValue tone="gold" size="sm" />
      </div>

      <div style={{ display: 'flex', gap: 14, background: 'var(--sage-50)', borderLeft: '3px solid var(--sage-400)', borderRadius: 'var(--radius-md)', padding: '18px 20px', marginTop: 22 }}>
        <MIcon name="sparkles" size={18} color="var(--sage-600)" style={{ flexShrink: 0, marginTop: 3 }} />
        <div>
          <Eyebrow style={{ color: 'var(--sage-700)', marginBottom: 6 }}>A note from Homa</Eyebrow>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.12rem', lineHeight: 1.4, color: 'var(--text-strong)' }}>
            Maya&rsquo;s right on pace, and her reading is really taking off. Nothing to worry about this week.
          </div>
          <div style={{ fontFamily: 'var(--font-hand)', fontWeight: 600, fontSize: '1.55rem', color: 'var(--sage-600)', marginTop: 6, lineHeight: 1 }}>
            you&rsquo;re doing great &#10022;
          </div>
        </div>
      </div>
    </div>
  );
}

function AskScreen() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px' }}>
        <div style={{ textAlign: 'center', margin: '10px 0 20px' }}>
          <MLogo variant="mark" size={34} style={{ justifyContent: 'center' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-strong)', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>Ask Homa <MDoodle name="sparkle" size={16} color="var(--pop-cobalt)" rotate={12} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <div style={{ maxWidth: '82%', background: 'var(--brand)', color: '#fff', padding: '11px 15px', borderRadius: 'var(--radius-lg)', borderBottomRightRadius: 6, fontSize: '0.92rem' }}>Give me a rainy-day science idea for a 6-year-old.</div>
        </div>
        <div style={{ display: 'flex', marginBottom: 12 }}>
          <div style={{ maxWidth: '82%', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', padding: '11px 15px', borderRadius: 'var(--radius-lg)', borderBottomLeftRadius: 6, fontSize: '0.92rem', color: 'var(--text-body)', lineHeight: 1.5 }}>
            Try a kitchen “rain cloud in a jar”, shaving foam, water, and a few drops of food coloring. Eli will love watching the color “rain” fall. Want a printable to go with it?
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
          <MChip>Make a printable</MChip><MChip>Another idea</MChip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-card)', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-pill)', padding: '7px 7px 7px 16px' }}>
          <input placeholder="Message Homa…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '0.95rem' }} />
          <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><MIcon name="arrow-up" size={18} color="#fff" /></span>
        </div>
      </div>
    </div>
  );
}

function DiscoverScreen() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 22px 24px' }}>
      <Eyebrow>Discover · Austin, TX</Eyebrow>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 500, color: 'var(--text-strong)', letterSpacing: '-0.02em', margin: '6px 0 18px' }}>Out in the world</div>

      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: '18px 20px', boxShadow: 'var(--shadow-md)', marginBottom: 22 }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--clay-600)', marginBottom: 8 }}>Maya · Space unit</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-strong)', lineHeight: 1.3 }}>Family space day at the Bullock, <span style={{ color: 'var(--clay-600)' }}>Saturday</span>.</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>Planetarium shows at 10 & 2, lines up with her astronomy week.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <span style={{ background: 'var(--brand)', color: '#fff', padding: '9px 18px', borderRadius: 'var(--radius-pill)', fontWeight: 700, fontSize: '0.85rem' }}>Get tickets</span>
          <span style={{ background: 'var(--stone-100)', color: 'var(--text-muted)', padding: '9px 18px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: '0.85rem' }}>Not this week</span>
        </div>
      </div>

      <Eyebrow style={{ marginBottom: 12 }}>Nearby this week</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        {[['book-open', 'Story hour', 'Central Library · Thu 10:00'], ['users', 'Cedar Park co-op', 'Tuesdays · 12 families'], ['cloud-rain', 'Rainy-day pick', 'Hopscotch Play Lab · open play']].map(([ic, t, d]) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: '13px 14px', boxShadow: 'var(--shadow-xs)' }}>
            <MIcon name={ic} size={19} color="var(--brand)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.92rem' }}>{t}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: 1 }}>{d}</div>
            </div>
            <MIcon name="chevron-right" size={16} color="var(--stone-300)" />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--sage-50)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
        <div style={{ display: 'flex' }}>
          {['Ana M', 'Dana K', 'Priya S'].map((n, i) => <span key={n} style={{ marginLeft: i ? -8 : 0 }}><MAvatar name={n} size={30} /></span>)}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-body)', lineHeight: 1.4 }}><b>4 Homa families</b> homeschool within 5 miles.</div>
      </div>
    </div>
  );
}

function KidsScreen() {
  const standings = [
    ['Reading', 'Ahead', 'gold'],
    ['Math', 'On track', 'sage'],
    ['Writing', 'On track', 'sage'],
    ['Science', 'Ready for review', 'warning'],
  ];
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 22px 24px' }}>
      <Eyebrow>Benchmarks · Texas (TEKS)</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 18px' }}>
        <MAvatar name="Maya Rivera" size={40} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 500, color: 'var(--text-strong)', letterSpacing: '-0.02em' }}>Where Maya stands</div>
      </div>

      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: '6px 20px', boxShadow: 'var(--shadow-sm)', marginBottom: 22 }}>
        {standings.map(([s, b, tone]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: s !== 'Science' ? '1px solid var(--stone-100)' : 'none' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-body)', fontSize: '0.95rem' }}>{s}</span>
            <MBadge tone={tone}>{b}</MBadge>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--sage-50)', borderRadius: 'var(--radius-xl)', padding: '18px 20px' }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--sage-700)', marginBottom: 8 }}>It's working</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-strong)', lineHeight: 1.3 }}>Math is up <span style={{ color: 'var(--sage-700)' }}>12 points</span> since the fractions set.</div>
        <svg width="100%" height="44" viewBox="0 0 260 44" preserveAspectRatio="none" style={{ margin: '10px 0 2px' }}>
          <path d="M0 36 C30 34 60 31 90 27 C130 22 170 15 210 9 C230 6 245 5 260 4" fill="none" stroke="var(--sage-500)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="260" cy="4" r="3.5" fill="var(--sage-500)" />
        </svg>
        <div style={{ fontFamily: 'var(--font-hand)', fontWeight: 600, fontSize: '1.4rem', color: 'var(--sage-600)', marginTop: 8, lineHeight: 1 }}>your work is paying off ✦</div>
      </div>
    </div>
  );
}

function PlanScreen() {
  const tint = {
    Math: ['var(--clay-50)', 'var(--clay-600)'],
    Reading: ['var(--sage-50)', 'var(--sage-600)'],
    Science: ['var(--gold-100)', 'var(--gold-ink)'],
    Writing: ['var(--sky-100)', 'var(--sky-600)'],
    Art: ['var(--clay-100)', 'var(--clay-700)'],
  };
  const week = [
    ['Mon', [['Math', '30m'], ['Reading', '30m'], ['Science', '45m']]],
    ['Tue', [['Math', '30m'], ['Writing', '40m']]],
    ['Wed', [['Reading', '30m'], ['Art', '60m']]],
    ['Thu', [['Math', '25m'], ['Science', '60m'], ['Reading', '30m']]],
    ['Fri', [['Writing', '40m'], ['Math', '30m']]],
  ];
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 22px 24px' }}>
      <Eyebrow>This week · Maya</Eyebrow>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-strong)', letterSpacing: '-0.02em', margin: '6px 0 18px' }}>May 12&ndash;16</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {week.map(([day, items]) => (
          <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', padding: '13px 16px', boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ width: 40, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-display)', flexShrink: 0 }}>{day}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              {items.map(([s, d]) => {
                const [bg, fg] = tint[s];
                return <span key={s + d} style={{ background: bg, color: fg, fontSize: '0.72rem', fontWeight: 700, padding: '5px 10px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' }}>{s} · {d}</span>;
              })}
            </div>
          </div>
        ))}
      </div>
      <button style={{ width: '100%', border: 'none', background: 'var(--brand)', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.95rem', padding: '15px 0', borderRadius: 'var(--radius-pill)', cursor: 'pointer' }}>Auto-plan with Homa</button>
    </div>
  );
}

function MobileApp() {
  const [tab, setTab] = React.useState('Home');
  React.useEffect(() => { setTimeout(() => window.lucide && window.lucide.createIcons(), 60); });
  const screens = { Home: <HomeScreen />, Ask: <AskScreen />, Plan: <PlanScreen />, Discover: <DiscoverScreen />, Kids: <KidsScreen /> };
  return (
    <div style={{ width: 390, height: 812, background: 'var(--bg-page)', borderRadius: 44, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)', border: '10px solid #221E1A', fontFamily: 'var(--font-sans)' }}>
      <StatusBar />
      {screens[tab]}
      <TabBar active={tab} onNav={setTab} />
    </div>
  );
}

Object.assign(window, { MobileApp });
