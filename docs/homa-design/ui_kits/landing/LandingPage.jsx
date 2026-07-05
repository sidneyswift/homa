// Homa marketing landing page. Editorial scroll story: the notebook margin-rule
// becomes a thread that runs down the page, checking off each chapter of the
// product loop as you scroll (set the stage → week arrives → teach → proof).
// Color bands at the edges, ribbons as seams, calm air in between.
const { Button: LButton, Icon: LIcon, Card: LCard, Badge: LBadge, Chip: LChip, Avatar: LAvatar, Logo: LLogo, Squiggle: LSquiggleRaw, Doodle: LDoodleRaw } = window.HomaDesignSystem_5e2305;
// Guard against a stale bundle: decoration degrades to nothing, never a crash.
const LSquiggle = LSquiggleRaw || (() => null);
const LDoodle = LDoodleRaw || (() => null);

function Wordmark({ light }) {
  return <LLogo size={28} tone={light ? 'dark' : 'light'} />;
}

function Wave({ color = 'var(--band-sky)', flip = false }) {
  return (
    <svg viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block', width: '100%', height: 44, margin: '-1px 0', transform: flip ? 'scaleY(-1)' : 'none' }}>
      <path fill={color} d="M0 0 H1440 V12 C1220 46 980 4 720 24 C460 44 220 8 0 32 Z" />
    </svg>
  );
}

/* Squiggle ribbon divider: a fat wavy band with a repeating phrase riding the
   curve. The ribbon IS the seam: `top` and `bottom` section colors meet along
   its centerline, hidden under the band, so no other transition (wave, hard
   edge) ever shows behind it. Purely decorative. */
function Ribbon({ text, color = 'var(--pop-cobalt)', ink = '#FFFFFF', phase = 0, top = 'var(--bg-page)', bottom = 'var(--bg-page)' }) {
  const rid = 'ribbon-' + text.replace(/[^a-z]/gi, '').toLowerCase().slice(0, 16) + phase;
  const paths = [
    'M-60 96 C 240 30, 480 152, 750 88 C 1020 26, 1240 142, 1500 62',
    'M-60 72 C 220 146, 470 28, 760 92 C 1050 154, 1260 40, 1500 104',
  ];
  const d = paths[phase % 2];
  const phrase = Array(9).fill(text).join('  ·  ') + '  ·  ';
  return (
    <div aria-hidden="true" style={{ position: 'relative', height: 150, margin: '-1px 0', pointerEvents: 'none' }}>
      <svg viewBox="0 0 1440 176" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
        <path d={d + ' L 1500 -40 L -60 -40 Z'} fill={top} />
        <path d={d + ' L 1500 216 L -60 216 Z'} fill={bottom} />
        <path id={rid} d={d} fill="none" stroke={color} strokeWidth="54" strokeLinecap="round" />
        <text dominantBaseline="middle" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, letterSpacing: '0.2em', fill: ink }}>
          <textPath href={'#' + rid}>{phrase}</textPath>
        </text>
      </svg>
    </div>
  );
}

function Eyebrow({ color = 'var(--brand)', children }) {
  return <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color }}>{children}</div>;
}

function Nav() {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 32, padding: '18px 40px', background: 'rgba(251,247,240,0.85)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border-subtle)' }}>
      <Wordmark />
      <div style={{ display: 'flex', gap: 28, marginLeft: 20 }}>
        {['How it works', 'Features', 'Pricing', 'Stories'].map(l => (
          <a key={l} href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem', whiteSpace: 'nowrap' }}>{l}</a>
        ))}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
        <a href="#" style={{ color: 'var(--text-body)', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap' }}>Sign in</a>
        <LButton variant="primary">Start free</LButton>
      </div>
    </nav>
  );
}

function Hero() {
  const [film, setFilm] = React.useState(false);
  return (
    <section style={{ background: 'var(--band-sky)', position: 'relative', overflow: 'hidden' }}>
      <LDoodle name="star" size={34} rotate={-12} style={{ position: 'absolute', top: 46, left: '4%' }} />
      <LDoodle name="sun" size={34} color="var(--gold-500)" style={{ position: 'absolute', top: 40, left: '46%' }} />
      <LDoodle name="squiggle" size={44} color="var(--pop-cobalt)" style={{ position: 'absolute', bottom: 52, left: '44%' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 48, alignItems: 'center', padding: '116px 40px 108px', maxWidth: 1200, margin: '0 auto' }}>
        <div data-reveal>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface-card)', color: 'var(--clay-600)', padding: '7px 16px', borderRadius: 'var(--radius-pill)', fontWeight: 700, fontSize: '0.85rem', boxShadow: 'var(--shadow-sm)' }}>
            <LIcon name="sparkles" size={15} /> In your corner, every school day
          </span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3.9rem', fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.015em', color: 'var(--text-strong)', margin: '22px 0 0' }}>
            You&rsquo;ve got this.<br />Homa&rsquo;s got the <span style={{ color: 'var(--clay-600)' }}>rest</span>.
          </h1>
          <p style={{ fontSize: '1.22rem', color: 'var(--stone-700)', lineHeight: 1.55, margin: '24px 0 0', maxWidth: 470 }}>
            The planning, the tracking, the what-do-we-do-today, hand it to Homa. You get back to the part only you can do.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <LButton variant="primary" size="lg" iconRight={<LIcon name="arrow-right" size={18} color="#fff" />}>Start free for 14 days</LButton>
            <LButton variant="ghost" size="lg" iconLeft={<LIcon name="play" size={16} />} style={{ background: 'var(--surface-card)' }} onClick={() => setFilm(true)}>Watch the film</LButton>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, color: 'var(--stone-700)', fontSize: '0.9rem', fontWeight: 500 }}>
            <div style={{ display: 'flex' }}>
              {['Ana M', 'Dana K', 'Priya S', 'Lena R'].map((n, i) => <span key={n} style={{ marginLeft: i ? -10 : 0 }}><LAvatar name={n} size={30} /></span>)}
            </div>
            Loved by 12,000+ homeschooling families
          </div>
        </div>
        <div data-reveal className="rv-d1" style={{ position: 'relative' }}>
          <div style={{ borderRadius: 'var(--blob-1)', overflow: 'hidden' }}>
            <img src="../../assets/photos/hero-family.png" alt="A mom and her son working through a workbook together at the kitchen table" style={{ width: '100%', height: 440, objectFit: 'cover', display: 'block' }} />
          </div>
          <LDoodle name="heart" size={30} color="var(--pop-blush)" rotate={10} style={{ position: 'absolute', bottom: -6, left: -14 }} />
        </div>
      </div>
      {film && (
        <div onClick={() => setFilm(false)} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(51,42,33,0.42)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: 'min(920px, 92vw)' }}>
            <video
              src="../../assets/videos/homa-brand-film.mp4"
              controls autoPlay playsInline
              onLoadedMetadata={e => { const t = parseFloat(localStorage.getItem('homa-film-t') || '0'); if (t > 0.5 && t < e.target.duration - 0.5) e.target.currentTime = t; }}
              onTimeUpdate={e => { try { localStorage.setItem('homa-film-t', String(e.target.currentTime)); } catch (err) {} }}
              style={{ width: '100%', display: 'block', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', background: '#000' }}
            />
            <button onClick={() => setFilm(false)} aria-label="Close film" style={{ position: 'absolute', top: -14, right: -14, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <LIcon name="x" size={18} color="var(--text-body)" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Features() {
  const items = [
    ['clipboard-check', 'Know where they stand', 'A gentle skills checklist, for you, never a test for them, mapped to your state\'s standards.', 'var(--clay-50)', 'var(--clay-600)'],
    ['chart-line', 'Proof it\'s working', 'Watch Homa\'s practice sets move the numbers. Math up 12 points since April, that kind of proof.', 'var(--sage-50)', 'var(--sage-600)'],
    ['file-pen', 'Practice that targets', 'Workbook pages and sensory activities tuned to exactly what each child is growing through.', 'var(--gold-100)', 'var(--gold-ink)'],
    ['calendar-heart', 'Plans that flex', 'Tell Homa how your week looks and she builds a schedule around real life, sick days, field trips, and all.', 'var(--sky-100)', 'var(--sky-600)'],
    ['compass', 'Your town, in the plan', 'Space week? There\'s a planetarium day Saturday. Museums, story hours, zoos, and co-ops, matched to your lessons.', 'var(--clay-50)', 'var(--clay-600)'],
    ['scale', 'Compare curriculums', 'Side-by-side, in plain language, against how your child actually learns, before you spend a dime.', 'var(--sage-50)', 'var(--sage-600)'],
  ];
  return (
    <section style={{ padding: '124px 40px 104px', maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
      <LDoodle name="sparkle" size={26} color="var(--pop-blush)" rotate={12} style={{ position: 'absolute', top: 84, right: '5%' }} />
      <div data-reveal style={{ marginBottom: 64, maxWidth: 620 }}>
        <Eyebrow>Everything in one place</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 700, color: 'var(--text-strong)', margin: '10px 0 14px' }}>Less admin. More teaching.</h2>
        <LSquiggle />
      </div>
      <div data-reveal-kids style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {items.map(([ic, t, d, tint, fg]) => (
          <LCard key={t} padding="lg">
            <span style={{ width: 52, height: 52, borderRadius: 'var(--blob-2)', background: tint, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <LIcon name={ic} size={24} color={fg} />
            </span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-strong)', margin: '16px 0 6px' }}>{t}</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.55, margin: 0, fontSize: '0.98rem' }}>{d}</p>
          </LCard>
        ))}
      </div>
    </section>
  );
}

/* ---------- The story thread ---------- */

function weekChip(label, bg, fg) {
  return <span key={label} style={{ background: bg, color: fg, fontWeight: 600, fontSize: '0.85rem', padding: '5px 12px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' }}>{label}</span>;
}

function KidsVignette() {
  const kids = [['Maya Rivera', 'Grade 3'], ['Eli Rivera', 'Grade 1'], ['Nora Rivera', 'Pre-K']];
  const subjects = [
    ['Math', 'var(--clay-100)', 'var(--clay-700)'],
    ['Reading', 'var(--sage-100)', 'var(--sage-700)'],
    ['Science', 'var(--gold-100)', 'var(--gold-ink)'],
    ['Art', 'var(--sky-100)', 'var(--sky-600)'],
  ];
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', padding: '24px 26px', maxWidth: 480, transform: 'rotate(-0.5deg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
        {kids.map(([name, grade]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LAvatar name={name} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-body)', fontSize: '0.95rem' }}>{name.split(' ')[0]}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>{grade}</div>
            </div>
            <LIcon name="check" size={17} color="var(--sage-600)" />
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 10 }}>This year</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {subjects.map(([s, bg, fg]) => weekChip(s, bg, fg))}
      </div>
    </div>
  );
}

function WeekVignette() {
  const days = [
    ['Mon', [weekChip('Math · Fractions', 'var(--clay-100)', 'var(--clay-700)'), weekChip('Reading', 'var(--sage-100)', 'var(--sage-700)'), weekChip('Art', 'var(--gold-100)', 'var(--gold-ink)')]],
    ['Tue', [weekChip('Math', 'var(--clay-100)', 'var(--clay-700)'), weekChip('Science · Space', 'var(--sky-100)', 'var(--sky-600)'), weekChip('Reading', 'var(--sage-100)', 'var(--sage-700)')]],
    ['Wed', [weekChip('Field trip · Planetarium', 'var(--sky-100)', 'var(--sky-600)'), weekChip('Journal', 'var(--gold-100)', 'var(--gold-ink)')]],
    ['Thu', [weekChip('Math', 'var(--clay-100)', 'var(--clay-700)'), weekChip('Writing', 'var(--sage-100)', 'var(--sage-700)'), weekChip('Music', 'var(--gold-100)', 'var(--gold-ink)')]],
    ['Fri', [weekChip('Review game', 'var(--clay-100)', 'var(--clay-700)')]],
  ];
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', padding: '24px 26px', maxWidth: 560, transform: 'rotate(0.6deg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.15rem', color: 'var(--text-strong)' }}>Maya · Grade 3</span>
        <LBadge tone="sage">Balanced</LBadge>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {days.map(([d, chips]) => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 12, borderBottom: d === 'Fri' ? 'none' : '1px solid var(--stone-100)' }}>
            <span style={{ width: 38, flexShrink: 0, fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-subtle)' }}>{d}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {chips}
              {d === 'Fri' && <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.92rem' }}>light on purpose</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckVignette() {
  const check = (
    <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--sage-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5 L9.5 18 L20 6.5"></path></svg>
    </span>
  );
  const empty = <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--surface-card)', border: '1.5px solid var(--border-default)', flexShrink: 0 }}></span>;
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', padding: '22px 26px', maxWidth: 460, transform: 'rotate(-0.4deg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-strong)' }}>Tuesday</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>1 of 3 · about 1h 10m left</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          {check}
          <span style={{ color: 'var(--text-subtle)', textDecoration: 'line-through', fontWeight: 500 }}>Math · word problems</span>
          <LDoodle name="star" size={16} color="var(--gold-400)" rotate={12} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {empty}
          <span style={{ color: 'var(--text-body)', fontWeight: 500 }}>Writing · story draft</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginLeft: 'auto' }}>40m</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {empty}
          <span style={{ color: 'var(--text-body)', fontWeight: 500 }}>Read-aloud on the porch</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginLeft: 'auto' }}>30m</span>
        </div>
      </div>
    </div>
  );
}

function ProofVignette() {
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', padding: '24px 26px', maxWidth: 460, transform: 'rotate(0.5deg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Math · benchmark</span>
        <LBadge tone="sage">On track</LBadge>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 700, color: 'var(--sage-600)', lineHeight: 1 }}>▲ 12 pts</span>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: 6 }}>since the fractions practice set</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: 18, height: 74 }}>
        {[['Apr', 56, 'var(--clay-300)'], ['May', 68, 'var(--sage-500)']].map(([m, v, c]) => (
          <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
            <div style={{ width: '100%', maxWidth: 90, height: v * 0.8, background: c, borderRadius: '8px 8px 3px 3px' }}></div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>{m} · {v}</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--font-hand)', fontWeight: 600, fontSize: '1.45rem', color: 'var(--sage-600)', marginTop: 16, lineHeight: 1 }}>you did that ✎</div>
    </div>
  );
}

/* The thread: Homa's margin-rule gone for a wander. A squiggly clay path down
   a ruled notebook page that inks in as you scroll, a marker riding the curve,
   and a waypoint per chapter that checks off as the story passes it. */
function HowThread() {
  const gridRef = React.useRef(null);
  const stepRefs = React.useRef([]);
  const measRef = React.useRef(null);
  const geomRef = React.useRef(null);
  const wpxRef = React.useRef([]);
  const lastH = React.useRef(0);
  const [st, setSt] = React.useState({ prog: 0, passed: [false, false, false, false], marker: null, geom: null, wpx: [] });

  React.useEffect(() => {
    const ns = 'http://www.w3.org/2000/svg';
    const measSvg = document.createElementNS(ns, 'svg');
    measSvg.setAttribute('width', '0');
    measSvg.setAttribute('height', '0');
    measSvg.style.cssText = 'position:absolute;left:-9999px;top:0;';
    const measPath = document.createElementNS(ns, 'path');
    measSvg.appendChild(measPath);
    document.body.appendChild(measSvg);
    measRef.current = measPath;

    /* A gentle S-curve every ~300px, swinging side to side around x=55. */
    const buildPath = h => {
      const cx = 55, amp = 26, y0 = 12, y1 = Math.max(y0 + 200, h - 110);
      const n = Math.max(2, Math.round((y1 - y0) / 300));
      const seg = (y1 - y0) / n;
      let d = 'M ' + cx + ' ' + y0;
      for (let i = 0; i < n; i++) {
        const a = amp * (i % 2 ? -1 : 1);
        const ys = y0 + seg * i;
        d += ' C ' + (cx + a) + ' ' + (ys + seg * 0.3).toFixed(1) + ', ' + (cx + a) + ' ' + (ys + seg * 0.7).toFixed(1) + ', ' + cx + ' ' + (ys + seg).toFixed(1);
      }
      return d;
    };
    /* Where the squiggle sits at a given height, so waypoints snap onto it. */
    const xAtY = (path, len, y) => {
      let lo = 0, hi = len;
      for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2;
        if (path.getPointAtLength(mid).y < y) lo = mid; else hi = mid;
      }
      return path.getPointAtLength((lo + hi) / 2).x;
    };

    let raf = null;
    const measure = () => {
      raf = null;
      const grid = gridRef.current, mp = measRef.current;
      if (!grid || !mp) return;
      const r = grid.getBoundingClientRect();
      if (!(r.height > 0)) return; /* not laid out yet; retry timers will catch up */
      const anchor = window.innerHeight * 0.55;
      const prog = Math.max(0, Math.min(1, (anchor - r.top) / r.height));
      if (!isFinite(prog)) return;
      const h = Math.round(r.height);
      if (!geomRef.current || h !== lastH.current) {
        lastH.current = h;
        const d = buildPath(h);
        mp.setAttribute('d', d);
        geomRef.current = { d, h, len: mp.getTotalLength() };
        wpxRef.current = stepRefs.current.map(s => {
          if (!s) return 55;
          const y = s.getBoundingClientRect().top - r.top + 17;
          return xAtY(mp, geomRef.current.len, y);
        });
      }
      const g = geomRef.current;
      if (!g || !(g.len > 0) || !isFinite(g.len)) return;
      const pt = mp.getPointAtLength(g.len * prog);
      const passed = stepRefs.current.map(s => !!s && s.getBoundingClientRect().top < anchor);
      setSt(prev => {
        const same = prev.prog === prog && prev.geom === g && passed.every((v, i) => v === prev.passed[i]);
        return same ? prev : { prog, passed, marker: { x: pt.x, y: pt.y }, geom: g, wpx: wpxRef.current };
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();
    const t1 = setTimeout(measure, 400);
    const t2 = setTimeout(measure, 1400);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      document.body.removeChild(measSvg);
    };
  }, []);

  const steps = [
    {
      n: '01', title: 'Tell Homa about your kids',
      body: 'Ages, grades, what you want the year to cover, and how your days actually flow. A few minutes of questions, so the very first week already fits your family.',
      vignette: <KidsVignette />,
    },
    {
      n: '02', title: 'Sunday night, the week is waiting',
      body: 'A balanced draft for every child, shaped around your family\u2019s rhythm. Tweak anything with a tap or a message, Homa keeps the balance for you.',
      vignette: <WeekVignette />,
      action: <LButton variant="secondary" iconRight={<LIcon name="arrow-right" size={16} />}>See a sample week</LButton>,
    },
    {
      n: '03', title: 'Teach, tap, done',
      body: 'Check off lessons as you go, each one lands with a small celebration. When life happens, tell Homa and she reshuffles. A lighter day is still a good day.',
      vignette: <CheckVignette />,
    },
    {
      n: '04', title: 'Watch the needle move',
      body: 'A gentle checklist, answered by you, never a test for them, maps each child against your state\u2019s standards. Then Homa targets practice at what\u2019s growing and shows the work paying off.',
      vignette: <ProofVignette />,
    },
  ];

  const { prog, passed, marker, geom, wpx } = st;

  return (
    <section style={{ background: 'var(--bg-page-warm)', backgroundImage: 'var(--bg-paper)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '104px 68px 0' }}>
        <div data-reveal style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 72px' }}>
          <Eyebrow>How Homa works</Eyebrow>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--text-strong)', margin: '12px 0 0', lineHeight: 1.08 }}>
            From Sunday night<br />to <span style={{ color: 'var(--clay-600)' }}>proof</span>.
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1.6, margin: '18px auto 0', maxWidth: 460 }}>
            One calm loop, week after week. Follow the thread.
          </p>
        </div>

        <div className="ht-grid" ref={gridRef} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '110px 1fr' }}>
          {geom && (
            <svg className="ht-line" width="110" height={geom.h} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
              <path d={geom.d} fill="none" stroke="var(--clay-100)" strokeWidth="6" strokeLinecap="round"></path>
              <path d={geom.d} fill="none" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round" strokeDasharray={geom.len} strokeDashoffset={geom.len * (1 - prog)}></path>
              {marker && <circle cx={marker.x} cy={marker.y} r="10" fill="#fff" stroke="var(--brand)" strokeWidth="3.5"></circle>}
            </svg>
          )}

          {steps.map((s, i) => (
            <React.Fragment key={s.n}>
              <div className="ht-gutter" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                <span
                  ref={el => { stepRefs.current[i] = el; }}
                  style={{
                    position: 'relative', zIndex: 2, width: 34, height: 34, borderRadius: '50%', marginTop: 2,
                    left: (wpx[i] || 55) - 55,
                    background: passed[i] ? 'var(--sage-500)' : 'var(--surface-card)',
                    border: passed[i] ? '2px solid var(--sage-500)' : '2px solid var(--border-default)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: passed[i] ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
                    transform: passed[i] ? 'scale(1)' : 'scale(0.9)',
                    transition: 'background var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
                  }}
                >
                  {passed[i]
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5 L9.5 18 L20 6.5"></path></svg>
                    : <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-subtle)' }}>{s.n}</span>}
                </span>
              </div>
              <div data-reveal className="ht-step" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 64, alignItems: 'start', padding: i === steps.length - 1 ? '0 16px 96px 44px' : '0 16px 15vh 44px', minHeight: i === steps.length - 1 ? 'auto' : '46vh' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand)', fontSize: '0.85rem', letterSpacing: '0.14em' }}>{s.n}</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 600, letterSpacing: '0', color: 'var(--text-strong)', margin: '10px 0 14px', lineHeight: 1.12 }}>{s.title}</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.62, fontSize: '1.05rem', margin: 0, maxWidth: 470 }}>{s.body}</p>
                  {s.action && <div style={{ marginTop: 24 }}>{s.action}</div>}
                </div>
                <div className="ht-vig" style={{ display: 'flex', justifyContent: 'center', marginTop: 34 }}>{s.vignette}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Benchmark demo: proof of smarts, gently ---------- */
/* Progressive disclosure, Marble-style but in Homa's voice: three gentle
   checklist questions redraw a live skill map; the technical mechanics stay
   folded behind one calm toggle. */

/* The live map: two skill constellations (Reading, Math) as a node-link
   graph. Nodes drift off the baseline, edges curve, and faint dashed links
   cross between subjects, a glimpse of the bigger web. */
function DemoMap({ readingNodes, mathNodes, readingStart, mathStart, mathOn = true }) {
  const RX = i => 100 + i * 106;
  const RY = [66, 48, 76, 54, 82, 62];
  const MY = [184, 166, 192, 170, 196, 176];
  const st = (i, start) => (start == null ? 'coming' : i < start ? 'solid' : i === start ? 'start' : 'coming');
  const labelHalo = { paintOrder: 'stroke', stroke: 'var(--surface-card)', strokeWidth: 4, strokeLinejoin: 'round' };
  const trackEls = (nodes, ys, start, keyp) => {
    const els = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const active = start != null && i < start;
      const bend = i % 2 ? -18 : 18;
      els.push(<path key={keyp + 'e' + i} d={'M ' + RX(i) + ' ' + ys[i] + ' Q ' + ((RX(i) + RX(i + 1)) / 2) + ' ' + ((ys[i] + ys[i + 1]) / 2 + bend) + ' ' + RX(i + 1) + ' ' + ys[i + 1]} fill="none" stroke={active ? 'var(--sage-300)' : 'var(--stone-200)'} strokeWidth="1.6" style={{ transition: 'stroke var(--dur-base) var(--ease-out)' }}></path>);
    }
    nodes.forEach((n, i) => {
      const s = st(i, start);
      els.push(
        <g key={keyp + 'n' + i}>
          <circle cx={RX(i)} cy={ys[i]} r={s === 'start' ? 9 : 6.5} fill={s === 'solid' ? 'var(--sage-500)' : s === 'start' ? 'var(--clay-50)' : '#fff'} stroke={s === 'solid' ? 'var(--sage-500)' : s === 'start' ? 'var(--clay-500)' : 'var(--stone-300)'} strokeWidth={s === 'start' ? 3 : 1.6} style={{ transition: 'fill var(--dur-base) var(--ease-out), stroke var(--dur-base) var(--ease-out)' }}></circle>
          <text x={RX(i)} y={ys[i] + (s === 'start' ? 27 : 24)} textAnchor="middle" style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: s === 'coming' ? 500 : 700, fill: s === 'start' ? 'var(--clay-700)' : s === 'solid' ? 'var(--sage-700)' : 'var(--text-subtle)', transition: 'fill var(--dur-base) var(--ease-out)', ...labelHalo }}>{n}</text>
        </g>
      );
    });
    return els;
  };
  const cornerStyle = { fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 2, fill: 'var(--text-subtle)' };
  return (
    <svg viewBox="0 0 700 236" style={{ width: '100%', display: 'block' }} aria-hidden="true">
      <text x="100" y="16" style={cornerStyle}>EARLIER</text>
      <text x="660" y="16" textAnchor="end" style={cornerStyle}>LATER</text>
      {trackEls(readingNodes, RY, readingStart, 'r')}
      <text x="16" y="70" style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, fill: 'var(--text-body)' }}>Reading</text>
      <g style={{ opacity: mathOn ? 1 : 0.22, transition: 'opacity 320ms var(--ease-out)' }}>
        {trackEls(mathNodes, MY, mathStart, 'm')}
        <text x="16" y="188" style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, fill: 'var(--text-body)' }}>Math</text>
      </g>
    </svg>
  );
}

/* The whole-curriculum web for the peek-under-the-hood panel: ~140 linked
   skill dots, foundational → advanced, deterministic layout (seeded), with
   labeled clusters. Sage = secure, clay ring = Homa works next. */
function SkillWeb() {
  const web = React.useMemo(() => {
    let seed = 7;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const W = 1000, H = 340, N = 140, nodes = [];
    for (let i = 0; i < N; i++) {
      const t = (i + rand() * 0.9) / N;
      nodes.push({ x: 30 + (W - 60) * t, y: 30 + (H - 60) * rand(), t });
    }
    nodes.forEach(n => {
      n.state = n.t < 0.42 ? (rand() < 0.88 ? 'secure' : 'coming') : n.t < 0.58 ? (rand() < 0.4 ? 'secure' : 'coming') : 'coming';
    });
    let ring = 0;
    nodes.forEach(n => { if (ring < 9 && n.state === 'coming' && n.t > 0.42 && n.t < 0.64 && rand() < 0.5) { n.state = 'next'; ring++; } });
    const edges = [];
    nodes.forEach((n, i) => {
      const cands = [];
      for (let j = 0; j < N; j++) {
        const m = nodes[j];
        if (m.x <= n.x) continue;
        cands.push([(m.x - n.x) * (m.x - n.x) + (m.y - n.y) * 1.6 * ((m.y - n.y) * 1.6), j]);
      }
      cands.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < Math.min(2, cands.length); k++) edges.push([i, cands[k][1]]);
    });
    return { nodes, edges };
  }, []);
  const labels = [
    ['Handwriting', 0.045, 0.8], ['Phonics', 0.09, 0.48], ['Counting', 0.1, 0.18],
    ['Add & subtract', 0.23, 0.4], ['Language reasoning', 0.25, 0.7], ['Spelling', 0.31, 0.9],
    ['Place value', 0.38, 0.26], ['Reading', 0.45, 0.52], ['Measurement', 0.39, 0.74],
    ['Fractions', 0.52, 0.34], ['Writing', 0.56, 0.68], ['Times tables', 0.6, 0.16],
    ['Geometry', 0.68, 0.56], ['Ratio', 0.76, 0.28], ['Probability', 0.78, 0.74], ['Algebra', 0.88, 0.48],
  ];
  const cornerStyle = { fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1.5, fill: 'var(--text-subtle)' };
  return (
    <svg viewBox="0 0 1000 340" style={{ width: '100%', display: 'block' }} aria-hidden="true">
      {web.edges.map(([a, b], i) => {
        const n = web.nodes[a], m = web.nodes[b];
        return <line key={i} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="rgba(51,42,33,0.09)" strokeWidth="1"></line>;
      })}
      {web.nodes.map((n, i) => n.state === 'secure'
        ? <circle key={i} cx={n.x} cy={n.y} r="3.6" fill="var(--sage-600)"></circle>
        : n.state === 'next'
          ? <g key={i}><circle cx={n.x} cy={n.y} r="6" fill="#fff" stroke="var(--clay-500)" strokeWidth="2.6"></circle><circle cx={n.x} cy={n.y} r="1.8" fill="var(--clay-500)"></circle></g>
          : <circle key={i} cx={n.x} cy={n.y} r="3.2" fill="#fff" stroke="var(--stone-300)" strokeWidth="1.2"></circle>)}
      {labels.map(([l, tx, ty]) => <text key={l} x={tx * 1000} y={ty * 340} style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, fill: 'var(--stone-600)', paintOrder: 'stroke', stroke: 'var(--bg-page)', strokeWidth: 4, strokeLinejoin: 'round' }}>{l}</text>)}
      <text x="30" y="14" style={cornerStyle}>FOUNDATIONAL</text>
      <text x="970" y="14" textAnchor="end" style={cornerStyle}>MORE ADVANCED →</text>
    </svg>
  );
}

function BenchmarkDemo() {
  const [ans, setAns] = React.useState({ read: null, count: null, frac: null });
  const [open, setOpen] = React.useState(false);
  const [revealed, setRevealed] = React.useState(1);
  const readingNodes = ['Letters', 'Blending', 'Words', 'Sentences', 'Stories', 'Comprehension'];
  const mathNodes = ['Count to 20', 'Adding up', 'Two-digit', 'Times tables', 'Halves', 'Fractions'];
  const readingStart = ans.read == null ? null : [1, 2, 3][ans.read];
  const fromCount = ans.count == null ? null : [0, 1, 2][ans.count];
  const fromFrac = ans.frac == null ? null : [0, 4, 5][ans.frac];
  const mathStart = fromCount == null && fromFrac == null ? null : Math.max(fromCount || 0, fromFrac || 0);
  const questions = [
    { id: 'read', subj: 'Reading', q: 'Can they read simple words, like cat and dog?' },
    { id: 'count', subj: 'Math', q: 'Can they count past 20 without a wobble?' },
    { id: 'frac', subj: 'Math', q: 'Do they get that a half is bigger than a quarter?' },
  ];
  const opts = [['Easily', 2], ['Getting there', 1], ['Not yet', 0]];
  const startNames = [
    readingStart != null ? readingNodes[readingStart].toLowerCase() : null,
    mathStart != null ? mathNodes[mathStart].toLowerCase() : null,
  ].filter(Boolean);
  const summary = startNames.length
    ? 'Homa would start with ' + startNames.join(' and ') + ', just past what\u2019s already solid.'
    : 'Tap an answer on the left to see where Homa would begin.';
  const legendDot = (style) => <span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0, ...style }}></span>;
  return (
    <section style={{ padding: '120px 40px 120px', maxWidth: 1140, margin: '0 auto' }}>
      <div data-reveal style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 72px' }}>
        <Eyebrow>Try it</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 700, color: 'var(--text-strong)', margin: '10px 0 12px' }}>Where would Homa start?</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.08rem', lineHeight: 1.6, margin: 0 }}>
          Three quick questions about how school is going. You answer, your kids
          never do, and the map redraws with every tap.
        </p>
      </div>

      <div data-reveal style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 44, alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.14em', color: 'var(--text-subtle)', marginBottom: 18 }}>YOU ANSWER</div>
          {questions.slice(0, revealed).map(({ id, subj, q }, qi) => (
            <div key={id} className="bd-sum" style={{ marginBottom: 26 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--clay-600)', marginBottom: 6 }}>{qi + 1} · {subj.toUpperCase()}</div>
              <div style={{ fontWeight: 600, color: 'var(--text-body)', marginBottom: 10, fontSize: '0.98rem' }}>{q}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {opts.map(([label, v]) => (
                  <LChip key={label} selected={ans[id] === v} onClick={() => { setAns(a => ({ ...a, [id]: a[id] === v ? null : v })); setRevealed(r => Math.max(r, Math.min(3, qi + 2))); }}>{label}</LChip>
                ))}
              </div>
            </div>
          ))}
          {revealed < 3 && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-subtle)' }}>just {revealed === 1 ? 'two' : 'one'} more after this</div>
          )}
        </div>
        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', padding: '18px 20px 16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.14em', color: 'var(--text-subtle)', padding: '4px 0 10px 4px' }}>HOMA FINDS THE STARTING LINE</div>
          <DemoMap readingNodes={readingNodes} mathNodes={mathNodes} readingStart={readingStart} mathStart={mathStart} mathOn={revealed >= 2} />
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 20, fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{legendDot({ background: 'var(--sage-500)' })} already solid</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{legendDot({ background: 'var(--clay-50)', border: '2.5px solid var(--clay-500)' })} Homa starts here</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{legendDot({ background: 'var(--surface-card)', border: '1.5px solid var(--border-default)' })} coming later</span>
          </div>
          <div key={summary} className="bd-sum" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, background: startNames.length ? 'var(--brand-soft)' : 'var(--stone-100)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontWeight: 600, color: startNames.length ? 'var(--clay-700)' : 'var(--text-muted)', fontSize: '0.95rem', transition: 'background var(--dur-base) var(--ease-out)' }}>
            <LDoodle name="sparkle" size={16} color={startNames.length ? 'var(--brand)' : 'var(--stone-400)'} /> {summary}
          </div>
        </div>
      </div>

      <div data-reveal style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', padding: '22px 28px', maxWidth: 860, margin: '104px auto 0' }}>
        <div role="button" tabIndex={0} onClick={() => setOpen(o => !o)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }} style={{ display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer', outline: 'none' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 600, color: 'var(--text-strong)' }}>Curious how Homa works?</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: 3 }}>Homa asks, plans, and improves. A one-minute peek, no homework required.</div>
          </div>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-base) var(--ease-out)' }}>
            <LIcon name="chevron-down" size={20} color="#fff" />
          </span>
        </div>
        <div style={{ maxHeight: open ? 1300 : 0, opacity: open ? 1 : 0, overflow: 'hidden', transition: 'max-height 420ms var(--ease-out), opacity 300ms var(--ease-out)' }}>
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 18, paddingTop: 22 }}>
            <div style={{ maxWidth: 700 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 10 }}>Every skill, connected.</div>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.62, fontSize: '0.98rem', margin: 0 }}>
                Homa holds each child’s curriculum as one connected map: hundreds of skills, linked by what they build on and mapped to your state’s standards. After each week, practice aims at the growing edge, the next skill whose foundations are already solid. Learning scientists call it the zone of proximal development. You’ll just see a week that fits.
              </p>
            </div>
            <div style={{ background: 'var(--bg-page)', borderRadius: 'var(--radius-lg)', padding: '14px 16px 8px', marginTop: 20 }}>
              <SkillWeb />
            </div>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 14, fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--surface-card)', border: '1.5px solid var(--border-default)' }}></span> coming up</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--sage-600)' }}></span> secure</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#fff', border: '2.5px solid var(--clay-500)' }}></span> Homa works next</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-subtle)', marginLeft: 'auto' }}>Mapped to all 50 states · redrawn after every week</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Community() {
  return (
    <section style={{ padding: '120px 40px 104px', maxWidth: 1140, margin: '0 auto', position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 56, alignItems: 'center' }}>
        <div data-reveal>
          <Eyebrow color="var(--sage-700)">Find your people</Eyebrow>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 700, color: 'var(--text-strong)', margin: '8px 0 14px' }}>You don&rsquo;t have to do this alone.</h2>
          <LSquiggle style={{ maxWidth: 300 }} color="var(--sage-600)" />
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: '18px 0 24px', maxWidth: 440 }}>
            Homa introduces you to nearby families, co-ops, and park days, matched to your kids&rsquo; ages and what you&rsquo;re teaching.
          </p>
          <LButton variant="secondary" iconRight={<LIcon name="arrow-right" size={16} />}>Find families near you</LButton>
        </div>
        <div data-reveal className="rv-d1" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', padding: '26px 28px', transform: 'rotate(-0.6deg)' }}>
          <div style={{ display: 'flex', marginBottom: 14 }}>
            {['Ana M', 'Dana K', 'June P', 'Sara T'].map((n, i) => <span key={n} style={{ marginLeft: i ? -10 : 0 }}><LAvatar name={n} size={40} /></span>)}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-strong)', lineHeight: 1.3 }}>4 Homa families homeschool within 5 miles.</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: 6, lineHeight: 1.5 }}>Two are planning park days this month.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <LBadge tone="sage">Park day · Sat 10 am</LBadge>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-subtle)', fontSize: '0.85rem' }}><LIcon name="map-pin" size={14} /> Austin, TX</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stories() {
  const quotes = [
    ['I was drowning in printables and half-made plans. Homa gave me a calm week, every week.', 'Priya Shah', 'Homeschooling 3 · Austin, TX'],
    ['The benchmarks finally quieted the am-I-doing-enough voice in my head.', 'Dana Kim', 'Homeschooling 2 · Boise, ID'],
    ['My son asked if we could do school on a Saturday. That never used to happen.', 'Lena Ruiz', 'Homeschooling 1 · Asheville, NC'],
  ];
  return (
    <section style={{ background: 'var(--band-blush)', padding: '96px 40px 104px', position: 'relative', overflow: 'hidden' }}>
      <LDoodle name="heart" size={30} color="var(--clay-600)" rotate={-10} style={{ position: 'absolute', top: 42, left: '6%' }} />
      <LDoodle name="sparkle" size={26} color="#fff" rotate={18} style={{ position: 'absolute', bottom: 52, right: '5%' }} />
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div data-reveal style={{ textAlign: 'center', marginBottom: 40 }}>
          <Eyebrow color="var(--clay-700)">Stories</Eyebrow>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 700, color: 'var(--text-strong)', margin: '8px 0 10px' }}>What moms tell us</h2>
          <div style={{ display: 'flex', justifyContent: 'center' }}><LSquiggle segments={4} line={false} color="var(--clay-700)" style={{ width: 'auto' }} /></div>
        </div>
        <div data-reveal-kids style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'stretch' }}>
          {quotes.map(([q, name, meta]) => (
            <div key={name} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)', padding: '26px 26px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <blockquote style={{ fontFamily: 'var(--font-serif)', fontSize: '1.18rem', lineHeight: 1.45, color: 'var(--text-strong)', margin: 0, flex: 1 }}>&ldquo;{q}&rdquo;</blockquote>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LAvatar name={name} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-strong)' }}>{name}</div>
                  <div style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>{meta}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    ['Solo', '$9', '/mo', 'For one learner', ['1 child', 'Weekly planning', 'Progress tracking', 'Worksheet generator'], false],
    ['Family', '$19', '/mo', 'Most popular', ['Up to 5 children', 'Everything in Solo', 'Standards benchmarking', 'Priority support'], true],
    ['Co-op', '$39', '/mo', 'For groups', ['Unlimited children', 'Shared plans', 'Group reporting', 'Admin tools'], false],
  ];
  return (
    <section style={{ padding: '112px 40px 88px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 data-reveal style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 700, color: 'var(--text-strong)', textAlign: 'center', margin: '0 0 56px' }}>Simple, family-friendly pricing</h2>
      <div data-reveal-kids style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }}>
        {tiers.map(([name, price, per, tag, feats, hot]) => (
          <div key={name} style={{
            background: hot ? 'var(--brand)' : 'var(--surface-card)',
            border: hot ? 'none' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)', padding: 28,
            boxShadow: hot ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
            transform: hot ? 'scale(1.03)' : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: hot ? '#fff' : 'var(--text-strong)' }}>{name}</span>
              {hot && <LBadge tone="gold" variant="solid">{tag}</LBadge>}
              {!hot && <span style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>{tag}</span>}
            </div>
            <div style={{ margin: '18px 0', display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 600, color: hot ? '#fff' : 'var(--text-strong)' }}>{price}</span>
              <span style={{ color: hot ? 'rgba(255,255,255,0.85)' : 'var(--text-subtle)' }}>{per}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
              {feats.map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', color: hot ? 'rgba(255,255,255,0.95)' : 'var(--text-body)', fontSize: '0.95rem' }}>
                  <LIcon name="check" size={17} color={hot ? '#fff' : 'var(--sage-600)'} /> {f}
                </div>
              ))}
            </div>
            <LButton variant={hot ? 'soft' : 'secondary'} fullWidth>Choose {name}</LButton>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    ['Does Homa follow my state\'s standards?', 'Yes. Pick your state and every subject maps to it, you can see coverage at a glance.'],
    ['Can I use my own curriculum?', 'Bring it. Homa plans around any mix of bought, borrowed, and homemade.'],
    ['What ages does it cover?', 'Pre-K through 8th grade today. High school is on the roadmap.'],
    ['What if a week falls apart?', 'Tell Homa. She reshuffles, nothing is lost, and nobody is behind.'],
  ];
  return (
    <section style={{ padding: '48px 40px 116px', maxWidth: 1000, margin: '0 auto' }}>
      <div data-reveal style={{ marginBottom: 48, maxWidth: 560 }}>
        <Eyebrow color="var(--pop-cobalt)">Good to know</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 600, color: 'var(--text-strong)', margin: '8px 0 14px' }}>Questions, answered</h2>
        <LSquiggle color="var(--pop-cobalt)" />
      </div>
      <div data-reveal-kids style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px 40px' }}>
        {items.map(([q, a]) => (
          <div key={q}>
            <div style={{ fontWeight: 700, color: 'var(--text-strong)', marginBottom: 6, fontSize: '1.02rem' }}>{q}</div>
            <div style={{ color: 'var(--text-muted)', lineHeight: 1.55, fontSize: '0.95rem' }}>{a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section style={{ background: 'var(--band-sunshine)', padding: '112px 40px 120px', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
      <LDoodle name="star" size={38} color="var(--pop-cobalt)" rotate={-14} style={{ position: 'absolute', top: 52, left: '9%' }} />
      <LDoodle name="heart" size={30} color="var(--clay-600)" rotate={12} style={{ position: 'absolute', bottom: 64, right: '9%' }} />
      <LDoodle name="sparkle" size={24} color="#fff" rotate={20} style={{ position: 'absolute', top: 66, right: '22%' }} />
      <h2 data-reveal style={{ fontFamily: 'var(--font-display)', fontSize: '3.1rem', fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--text-strong)', margin: '18px 0 12px' }}>Ready for a calm Monday?</h2>
      <p data-reveal className="rv-d1" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: '1.3rem', color: 'var(--stone-700)', margin: '0 0 32px' }}>Set-up takes an afternoon. The calm shows up the same week.</p>
      <div data-reveal className="rv-d2" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <LButton variant="primary" size="lg" iconRight={<LIcon name="arrow-right" size={18} color="#fff" />}>Start free for 14 days</LButton>
        <LButton variant="ghost" size="lg" style={{ background: 'var(--surface-card)' }}>Talk to Homa</LButton>
      </div>
      <div data-reveal className="rv-d2" style={{ marginTop: 16, fontSize: '0.88rem', fontWeight: 600, color: 'var(--stone-700)' }}>No card needed · cancel anytime</div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: 'var(--pop-navy)', color: 'var(--stone-300)', padding: '72px 40px 36px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 32 }}>
        <div>
          <Wordmark light />
          <p style={{ marginTop: 14, maxWidth: 260, lineHeight: 1.55, fontSize: '0.92rem', color: 'var(--stone-400)' }}>The calm, capable co-pilot for homeschooling families.</p>
        </div>
        {[['Product', ['Features', 'Pricing', 'Worksheets', 'Mobile app']], ['Company', ['About', 'Blog', 'Careers', 'Contact']], ['Support', ['Help center', 'Community', 'Privacy', 'Terms']]].map(([h, links]) => (
          <div key={h}>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: 12, fontSize: '0.95rem' }}>{h}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {links.map(l => <a key={l} href="#" style={{ color: 'var(--stone-400)', textDecoration: 'none', fontSize: '0.9rem' }}>{l}</a>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 1100, margin: '32px auto 0', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.18)', fontSize: '0.85rem', color: 'var(--stone-400)' }}>
        © 2026 Homa. Made for families who teach.
      </div>
    </footer>
  );
}

function LandingPage() {
  React.useEffect(() => { setTimeout(() => window.lucide && window.lucide.createIcons(), 80); });
  React.useEffect(() => {
    document.documentElement.classList.add('rv-armed');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('[data-reveal], [data-reveal-kids]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div style={{ background: 'var(--bg-page)', fontFamily: 'var(--font-sans)', overflowX: 'hidden' }}>
      <Nav />
      <Hero />
      <Ribbon text="LESS ADMIN · MORE TEACHING" color="var(--pop-cobalt)" phase={0} top="var(--band-sky)" bottom="var(--bg-page)" />
      <Features />
      <Wave color="var(--bg-page-warm)" flip />
      <HowThread />
      <Wave color="var(--bg-page-warm)" />
      <BenchmarkDemo />
      <Ribbon text="YOU DON'T HAVE TO DO THIS ALONE" color="var(--brand)" phase={1} />
      <Community />
      <Wave color="var(--band-blush)" flip />
      <Stories />
      <Wave color="var(--band-blush)" />
      <Pricing />
      <Faq />
      <Ribbon text="PLAN LESS · BREATHE MORE" color="var(--pop-navy)" ink="var(--gold-400)" phase={0} top="var(--bg-page)" bottom="var(--band-sunshine)" />
      <CtaBand />
      <div style={{ background: 'var(--band-sunshine)' }}><Wave color="var(--pop-navy)" flip /></div>
      <Footer />
    </div>
  );
}

Object.assign(window, { LandingPage });
