// HOMA marketing landing page.
const { Button: LButton, Icon: LIcon, Card: LCard, Badge: LBadge, Avatar: LAvatar, Logo: LLogo } = window.HOMADesignSystem_113bd2;

function Wordmark({ light }) {
  return <LLogo size={28} tone={light ? 'dark' : 'light'} />;
}

function Nav() {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 32, padding: '18px 40px', background: 'rgba(251,247,240,0.85)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border-subtle)' }}>
      <Wordmark />
      <div style={{ display: 'flex', gap: 28, marginLeft: 20 }}>
        {['How it works', 'Features', 'Pricing', 'Stories'].map(l => (
          <a key={l} href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem' }}>{l}</a>
        ))}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
        <a href="#" style={{ color: 'var(--text-body)', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' }}>Sign in</a>
        <LButton variant="primary">Start free</LButton>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 48, alignItems: 'center', padding: '72px 40px 60px', maxWidth: 1200, margin: '0 auto' }}>
      <div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--clay-50)', color: 'var(--clay-700)', padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: '0.85rem' }}>
          <LIcon name="sparkles" size={15} /> In your corner, every school day
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3.6rem', fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.025em', color: 'var(--text-strong)', margin: '20px 0 0' }}>
          You&rsquo;ve got this.<br />HOMA&rsquo;s got the <span style={{ color: 'var(--clay-600)', fontStyle: 'italic', fontWeight: 400 }}>rest</span>.
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', lineHeight: 1.55, margin: '22px 0 0', maxWidth: 470 }}>
          The planning, the tracking, the what-do-we-do-today, hand it to HOMA. You get back to the part only you can do.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 30 }}>
          <LButton variant="primary" size="lg" iconRight={<LIcon name="arrow-right" size={18} color="#fff" />}>Start free for 14 days</LButton>
          <LButton variant="secondary" size="lg" iconLeft={<LIcon name="play" size={16} />}>Watch demo</LButton>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, color: 'var(--text-subtle)', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex' }}>
            {['Ana M', 'Dana K', 'Priya S', 'Lena R'].map((n, i) => <span key={n} style={{ marginLeft: i ? -10 : 0 }}><LAvatar name={n} size={30} /></span>)}
          </div>
          Loved by 12,000+ homeschooling families
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <image-slot id="homa-hero" style={{ width: '100%', height: 440 }} shape="rounded" radius="24" placeholder="Drop a warm family / learning photo"></image-slot>
        <div style={{ position: 'absolute', top: -22, right: 18, fontFamily: 'var(--font-hand)', fontSize: '2.4rem', color: 'var(--sage-600)', transform: 'rotate(-7deg)', lineHeight: 1 }}>you&rsquo;ve got this &#10022;</div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    ['clipboard-check', 'Know where they stand', 'A gentle skills checklist, for you, never a test for them, mapped to your state\'s standards.'],
    ['chart-line', 'Proof it\'s working', 'Watch HOMA\'s practice sets move the numbers. Math up 12 points since April, that kind of proof.'],
    ['file-pen', 'Practice that targets', 'Workbook pages and sensory activities tuned to exactly what each child is growing through.'],
    ['calendar-heart', 'Plans that flex', 'Tell HOMA how your week looks and she builds a schedule around real life, sick days, field trips, and all.'],
    ['compass', 'Your town, in the plan', 'Space week? There\'s a planetarium day Saturday. Museums, story hours, zoos, and co-ops, matched to your lessons.'],
    ['scale', 'Compare curriculums', 'Side-by-side, in plain language, against how your child actually learns, before you spend a dime.'],
  ];
  return (
    <section style={{ padding: '60px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--brand)' }}>Everything in one place</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 600, color: 'var(--text-strong)', margin: '8px 0 0' }}>Less admin. More teaching.</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {items.map(([ic, t, d]) => (
          <LCard key={t} padding="lg">
            <span style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--clay-50)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <LIcon name={ic} size={24} color="var(--brand)" />
            </span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-strong)', margin: '16px 0 6px' }}>{t}</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.55, margin: 0, fontSize: '0.98rem' }}>{d}</p>
          </LCard>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ['1', 'Add your kids', 'Tell HOMA their ages, grades, and what you want to cover this year.'],
    ['2', 'Get your week', 'HOMA drafts a balanced weekly plan. Tweak anything with a tap or a message.'],
    ['3', 'Teach & track', 'Check off lessons, and watch progress fill in across every subject.'],
  ];
  return (
    <section style={{ background: 'var(--bg-page-warm)', padding: '64px 40px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 600, color: 'var(--text-strong)', textAlign: 'center', margin: '0 0 44px' }}>Up and running in an afternoon</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
          {steps.map(([n, t, d]) => (
            <div key={n} style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{n}</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 8px' }}>{t}</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Quote() {
  return (
    <section style={{ padding: '72px 40px', maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
      <LIcon name="quote" size={36} color="var(--clay-300)" />
      <blockquote style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500, lineHeight: 1.35, color: 'var(--text-strong)', margin: '18px 0 24px' }}>
        “I was drowning in printables and half-made plans. HOMA gave me a calm week, every week, and my kids are further ahead than ever.”
      </blockquote>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        <LAvatar name="Priya Shah" size={48} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>Priya Shah</div>
          <div style={{ color: 'var(--text-subtle)', fontSize: '0.9rem' }}>Homeschooling 3 · Austin, TX</div>
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
    <section style={{ padding: '60px 40px 80px', maxWidth: 1100, margin: '0 auto' }}>
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

function Footer() {
  return (
    <footer style={{ background: 'var(--stone-900)', color: 'var(--stone-300)', padding: '56px 40px 32px' }}>
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
      <div style={{ maxWidth: 1100, margin: '32px auto 0', paddingTop: 20, borderTop: '1px solid var(--stone-700)', fontSize: '0.85rem', color: 'var(--stone-500)' }}>
        © 2026 HOMA. Made for families who teach.
      </div>
    </footer>
  );
}

function LandingPage() {
  React.useEffect(() => { setTimeout(() => window.lucide && window.lucide.createIcons(), 80); });
  return (
    <div style={{ background: 'var(--bg-page)', fontFamily: 'var(--font-sans)' }}>
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Quote />
      <Pricing />
      <Footer />
    </div>
  );
}

Object.assign(window, { LandingPage });
