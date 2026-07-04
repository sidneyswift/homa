// Homa marketing landing page. Color bands divided by waves + squiggle ribbons.
const { Button: LButton, Icon: LIcon, Card: LCard, Badge: LBadge, Avatar: LAvatar, Logo: LLogo, Squiggle: LSquiggleRaw, Doodle: LDoodleRaw } = window.HOMADesignSystem_113bd2;
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
   curve. Purely decorative; straddles the seam between two sections. */
function Ribbon({ text, color = 'var(--pop-cobalt)', ink = '#FFFFFF', phase = 0 }) {
  const rid = 'ribbon-' + text.replace(/[^a-z]/gi, '').toLowerCase().slice(0, 16) + phase;
  const paths = [
    'M-60 96 C 240 30, 480 152, 750 88 C 1020 26, 1240 142, 1500 62',
    'M-60 72 C 220 146, 470 28, 760 92 C 1050 154, 1260 40, 1500 104',
  ];
  const phrase = Array(9).fill(text).join('  ·  ') + '  ·  ';
  return (
    <div aria-hidden="true" style={{ position: 'relative', zIndex: 6, height: 150, margin: '-48px 0 -44px', pointerEvents: 'none' }}>
      <svg viewBox="0 0 1440 176" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
        <path id={rid} d={paths[phase % 2]} fill="none" stroke={color} strokeWidth="54" strokeLinecap="round" />
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
  return (
    <section style={{ background: 'var(--band-sky)', position: 'relative', overflow: 'hidden' }}>
      <LDoodle name="star" size={34} rotate={-12} style={{ position: 'absolute', top: 46, left: '4%' }} />
      <LDoodle name="sun" size={34} color="var(--gold-500)" style={{ position: 'absolute', top: 40, left: '46%' }} />
      <LDoodle name="squiggle" size={44} color="var(--pop-cobalt)" style={{ position: 'absolute', bottom: 52, left: '44%' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 48, alignItems: 'center', padding: '72px 40px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface-card)', color: 'var(--clay-600)', padding: '7px 16px', borderRadius: 'var(--radius-pill)', fontWeight: 700, fontSize: '0.85rem', boxShadow: 'var(--shadow-sm)' }}>
            <LIcon name="sparkles" size={15} /> In your corner, every school day
          </span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3.6rem', fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.015em', color: 'var(--text-strong)', margin: '20px 0 0' }}>
            You&rsquo;ve got this.<br />Homa&rsquo;s got the <span style={{ color: 'var(--clay-600)', fontStyle: 'italic', fontWeight: 400, fontFamily: 'var(--font-serif)' }}>rest</span>.
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--stone-700)', lineHeight: 1.55, margin: '22px 0 0', maxWidth: 470 }}>
            The planning, the tracking, the what-do-we-do-today, hand it to Homa. You get back to the part only you can do.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 30 }}>
            <LButton variant="primary" size="lg" iconRight={<LIcon name="arrow-right" size={18} color="#fff" />}>Start free for 14 days</LButton>
            <LButton variant="ghost" size="lg" iconLeft={<LIcon name="play" size={16} />} style={{ background: 'var(--surface-card)' }}>Watch demo</LButton>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, color: 'var(--stone-700)', fontSize: '0.9rem', fontWeight: 500 }}>
            <div style={{ display: 'flex' }}>
              {['Ana M', 'Dana K', 'Priya S', 'Lena R'].map((n, i) => <span key={n} style={{ marginLeft: i ? -10 : 0 }}><LAvatar name={n} size={30} /></span>)}
            </div>
            Loved by 12,000+ homeschooling families
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ borderRadius: 'var(--blob-1)', overflow: 'hidden' }}>
            <image-slot id="homa-hero" style={{ width: '100%', height: 440 }} shape="rect" placeholder="Drop a warm family / learning photo"></image-slot>
          </div>
          <LDoodle name="heart" size={30} color="var(--pop-blush)" rotate={10} style={{ position: 'absolute', bottom: -6, left: -14 }} />
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    ['clipboard-check', 'Know where they stand', 'A gentle skills checklist, for you, never a test for them, mapped to your state\'s standards.', 'var(--clay-50)', 'var(--clay-600)'],
    ['chart-line', 'Proof it\'s working', 'Watch Homa\'s practice sets move the numbers. Math up 12 points since April, that kind of proof.', 'var(--sage-50)', 'var(--sage-600)'],
    ['file-pen', 'Practice that targets', 'Workbook pages and sensory activities tuned to exactly what each child is growing through.', 'var(--gold-100)', '#8a6d00'],
    ['calendar-heart', 'Plans that flex', 'Tell Homa how your week looks and she builds a schedule around real life, sick days, field trips, and all.', 'var(--sky-100)', 'var(--sky-600)'],
    ['compass', 'Your town, in the plan', 'Space week? There\'s a planetarium day Saturday. Museums, story hours, zoos, and co-ops, matched to your lessons.', 'var(--clay-50)', 'var(--clay-600)'],
    ['scale', 'Compare curriculums', 'Side-by-side, in plain language, against how your child actually learns, before you spend a dime.', 'var(--sage-50)', 'var(--sage-600)'],
  ];
  return (
    <section style={{ padding: '76px 40px 60px', maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
      <LDoodle name="sparkle" size={26} color="var(--pop-blush)" rotate={12} style={{ position: 'absolute', top: 70, right: '5%' }} />
      <div style={{ marginBottom: 40, maxWidth: 560 }}>
        <Eyebrow>Everything in one place</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 600, color: 'var(--text-strong)', margin: '8px 0 14px' }}>Less admin. More teaching.</h2>
        <LSquiggle />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
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

function WeekPeek() {
  const chip = (label, bg, fg) => (
    <span key={label} style={{ background: bg, color: fg, fontWeight: 600, fontSize: '0.85rem', padding: '5px 12px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' }}>{label}</span>
  );
  const days = [
    ['Mon', [chip('Math · Fractions', 'var(--clay-100)', 'var(--clay-700)'), chip('Reading', 'var(--sage-100)', 'var(--sage-700)'), chip('Art', 'var(--gold-100)', '#8a6d00')]],
    ['Tue', [chip('Math', 'var(--clay-100)', 'var(--clay-700)'), chip('Science · Space', 'var(--sky-100)', 'var(--sky-600)'), chip('Reading', 'var(--sage-100)', 'var(--sage-700)')]],
    ['Wed', [chip('Field trip · Planetarium', 'var(--sky-100)', 'var(--sky-600)'), chip('Journal', 'var(--gold-100)', '#8a6d00')]],
    ['Thu', [chip('Math', 'var(--clay-100)', 'var(--clay-700)'), chip('Writing', 'var(--sage-100)', 'var(--sage-700)'), chip('Music', 'var(--gold-100)', '#8a6d00')]],
    ['Fri', [chip('Review game', 'var(--clay-100)', 'var(--clay-700)')]],
  ];
  const points = ['Balanced across every subject', 'Shaped around your family\'s rhythm', 'Reshuffles itself when life happens'];
  return (
    <section style={{ background: 'var(--bg-page-warm)', backgroundImage: 'var(--bg-paper)', padding: '72px 40px', position: 'relative', overflow: 'hidden' }}>
      <LDoodle name="star" size={30} color="var(--gold-500)" rotate={14} style={{ position: 'absolute', top: 44, right: '7%' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 56, alignItems: 'center', maxWidth: 1140, margin: '0 auto' }}>
        <div>
          <Eyebrow color="var(--sky-600)">A week with Homa</Eyebrow>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 600, color: 'var(--text-strong)', margin: '8px 0 14px' }}>Your week, already sorted</h2>
          <LSquiggle style={{ maxWidth: 300 }} />
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: '18px 0 20px', maxWidth: 420 }}>
            Every Sunday, a draft of the week is waiting. Tweak anything with a tap or a message, Homa keeps the balance for you.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
            {points.map(p => (
              <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-body)', fontWeight: 500 }}>
                <LIcon name="check" size={18} color="var(--sage-600)" /> {p}
              </div>
            ))}
          </div>
          <LButton variant="secondary" iconRight={<LIcon name="arrow-right" size={16} />}>See a sample week</LButton>
        </div>
        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', padding: '24px 26px', transform: 'rotate(0.6deg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.15rem', color: 'var(--text-strong)' }}>Maya · Grade 3</span>
            <LBadge tone="sage">On track</LBadge>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {days.map(([d, chips]) => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 12, borderBottom: d === 'Fri' ? 'none' : '1px solid var(--stone-100)' }}>
                <span style={{ width: 38, flexShrink: 0, fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-subtle)' }}>{d}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {chips}
                  {d === 'Fri' && <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.92rem' }}>light on purpose</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ['1', 'Add your kids', 'Tell Homa their ages, grades, and what you want to cover this year.'],
    ['2', 'Get your week', 'Homa drafts a balanced weekly plan. Tweak anything with a tap or a message.'],
    ['3', 'Teach & track', 'Check off lessons, and watch progress fill in across every subject.'],
  ];
  return (
    <section style={{ background: 'var(--band-mint)', padding: '64px 40px', position: 'relative', overflow: 'hidden' }}>
      <LDoodle name="sun" size={36} color="var(--gold-500)" style={{ position: 'absolute', top: 40, right: '6%' }} />
      <LDoodle name="heart" size={26} color="var(--pop-blush)" rotate={-14} style={{ position: 'absolute', bottom: 46, left: '5%' }} />
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 600, color: 'var(--text-strong)', textAlign: 'center', margin: '0 0 44px' }}>Up and running in an afternoon</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
          {steps.map(([n, t, d], i) => (
            <div key={n} style={{ textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: ['var(--blob-1)', 'var(--blob-2)', 'var(--blob-3)'][i], background: ['var(--brand)', 'var(--pop-cobalt)', 'var(--sage-500)'][i], color: '#fff', fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{n}</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 8px' }}>{t}</h3>
              <p style={{ color: 'var(--stone-700)', lineHeight: 1.55, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Community() {
  return (
    <section style={{ padding: '84px 40px 64px', maxWidth: 1140, margin: '0 auto', position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 56, alignItems: 'center' }}>
        <div>
          <Eyebrow color="var(--sage-700)">Find your people</Eyebrow>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 600, color: 'var(--text-strong)', margin: '8px 0 14px' }}>You don&rsquo;t have to do this alone.</h2>
          <LSquiggle style={{ maxWidth: 300 }} color="var(--sage-600)" />
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: '18px 0 24px', maxWidth: 440 }}>
            Homa introduces you to nearby families, co-ops, and park days, matched to your kids&rsquo; ages and what you&rsquo;re teaching.
          </p>
          <LButton variant="secondary" iconRight={<LIcon name="arrow-right" size={16} />}>Find families near you</LButton>
        </div>
        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', padding: '26px 28px', transform: 'rotate(-0.6deg)' }}>
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
    <section style={{ background: 'var(--band-blush)', padding: '68px 40px 76px', position: 'relative', overflow: 'hidden' }}>
      <LDoodle name="heart" size={30} color="var(--clay-600)" rotate={-10} style={{ position: 'absolute', top: 42, left: '6%' }} />
      <LDoodle name="sparkle" size={26} color="#fff" rotate={18} style={{ position: 'absolute', bottom: 52, right: '5%' }} />
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Eyebrow color="var(--clay-700)">Stories</Eyebrow>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 600, color: 'var(--text-strong)', margin: '8px 0 10px' }}>From the kitchen table</h2>
          <div style={{ display: 'flex', justifyContent: 'center' }}><LSquiggle segments={4} line={false} color="var(--clay-700)" style={{ width: 'auto' }} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'stretch' }}>
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
    <section style={{ padding: '72px 40px 60px', maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 600, color: 'var(--text-strong)', textAlign: 'center', margin: '0 0 40px' }}>Simple, family-friendly pricing</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }}>
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
    <section style={{ padding: '20px 40px 84px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 34, maxWidth: 560 }}>
        <Eyebrow color="var(--pop-cobalt)">Good to know</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 600, color: 'var(--text-strong)', margin: '8px 0 14px' }}>Questions, answered</h2>
        <LSquiggle color="var(--pop-cobalt)" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px 40px' }}>
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
    <section style={{ background: 'var(--band-sunshine)', padding: '76px 40px 84px', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
      <LDoodle name="star" size={38} color="var(--pop-cobalt)" rotate={-14} style={{ position: 'absolute', top: 52, left: '9%' }} />
      <LDoodle name="heart" size={30} color="var(--clay-600)" rotate={12} style={{ position: 'absolute', bottom: 64, right: '9%' }} />
      <LDoodle name="sparkle" size={24} color="#fff" rotate={20} style={{ position: 'absolute', top: 66, right: '22%' }} />
      <span style={{ position: 'absolute', top: 44, right: '38%', transform: 'rotate(-6deg)', background: 'var(--surface-card)', color: 'var(--text-strong)', fontWeight: 700, fontSize: '0.85rem', padding: '7px 16px', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-sm)' }}>No card needed</span>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-strong)', margin: '18px 0 10px' }}>Ready for a calm Monday?</h2>
      <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.25rem', color: 'var(--stone-700)', margin: '0 0 30px' }}>Set-up takes an afternoon. The calm shows up the same week.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <LButton variant="primary" size="lg" iconRight={<LIcon name="arrow-right" size={18} color="#fff" />}>Start free for 14 days</LButton>
        <LButton variant="ghost" size="lg" style={{ background: 'var(--surface-card)' }}>Talk to Homa</LButton>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: 'var(--pop-navy)', color: 'var(--stone-300)', padding: '56px 40px 32px' }}>
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
  return (
    <div style={{ background: 'var(--bg-page)', fontFamily: 'var(--font-sans)', overflowX: 'hidden' }}>
      <Nav />
      <Hero />
      <Wave />
      <Ribbon text="LESS ADMIN · MORE TEACHING" color="var(--pop-cobalt)" phase={0} />
      <Features />
      <Wave color="var(--bg-page-warm)" flip />
      <WeekPeek />
      <Wave color="var(--bg-page-warm)" />
      <Wave color="var(--band-mint)" flip />
      <HowItWorks />
      <Wave color="var(--band-mint)" />
      <Ribbon text="YOU DON'T HAVE TO DO THIS ALONE" color="var(--brand)" phase={1} />
      <Community />
      <Wave color="var(--band-blush)" flip />
      <Stories />
      <Wave color="var(--band-blush)" />
      <Pricing />
      <Faq />
      <Ribbon text="PLAN LESS · BREATHE MORE" color="var(--pop-navy)" ink="var(--gold-400)" phase={0} />
      <Wave color="var(--band-sunshine)" flip />
      <CtaBand />
      <Wave color="var(--band-sunshine)" />
      <Wave color="var(--pop-navy)" flip />
      <Footer />
    </div>
  );
}

Object.assign(window, { LandingPage });
