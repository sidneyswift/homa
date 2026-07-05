// Homa web app, Ask Homa chat view (assistant interface).
const { Icon: CIcon, IconButton: CIconButton, Button: CButton, Callout: CCallout, Chip: CChip, Doodle: CDoodleRaw } = window.HomaDesignSystem_5e2305;
const CDoodle = CDoodleRaw || (() => null);

function ChatBubble({ from, children }) {
  const isHoma = from === 'homa';
  return (
    <div style={{ display: 'flex', justifyContent: isHoma ? 'flex-start' : 'flex-end', marginBottom: 16 }}>
      <div style={{
        maxWidth: '76%', padding: '14px 18px', borderRadius: 'var(--radius-lg)',
        fontSize: '0.95rem', lineHeight: 'var(--leading-normal)',
        background: isHoma ? 'var(--surface-card)' : 'var(--brand)',
        color: isHoma ? 'var(--text-body)' : '#fff',
        borderBottomLeftRadius: isHoma ? 6 : 'var(--radius-lg)',
        borderBottomRightRadius: isHoma ? 'var(--radius-lg)' : 6,
        boxShadow: 'var(--shadow-sm)',
      }}>
        {children}
      </div>
    </div>
  );
}

function ChatView() {
  const [input, setInput] = React.useState('');
  const suggestions = ['Plan Maya\'s week', 'Make a fractions worksheet', 'Ideas for a rainy day', 'How is Eli doing?'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 24px', maxWidth: 780, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 8 }}>Tuesday, May 13</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>Good morning, Sarah <CDoodle name="sun" size={24} color="var(--gold-400)" rotate={10} /></div>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--text-muted)', marginTop: 6, fontSize: '1.05rem' }}>What are we tackling today?</div>
        </div>

        <ChatBubble from="user">Can you plan a lighter week for Maya? She's been a bit burned out.</ChatBubble>
        <ChatBubble from="homa">
          Absolutely, let's ease off. I'll keep the core (30 min math, 30 min reading) and swap the heavier projects for hands-on activities. Here's Maya's lighter week:
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CIcon name="check" size={16} color="var(--sage-600)" /><span>Mon–Fri: Fractions review (short sets)</span></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CIcon name="check" size={16} color="var(--sage-600)" /><span>A nature journal instead of the science quiz</span></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CIcon name="check" size={16} color="var(--sage-600)" /><span>Read-aloud time, no comprehension worksheet</span></div>
          </div>
        </ChatBubble>
        <div style={{ display: 'flex', gap: 8, marginLeft: 4, marginBottom: 18 }}>
          <CButton size="sm" variant="primary" iconLeft={<CIcon name="calendar-plus" size={16} color="#fff" />}>Add to planner</CButton>
          <CButton size="sm" variant="secondary">Tweak it</CButton>
        </div>
        <CCallout tone="sage" title="A gentle reminder" icon={<CIcon name="heart" size={18} />}>
          Lighter weeks are part of the plan, not a setback. Maya's still on track for her term goals.
          <div style={{ fontFamily: 'var(--font-hand)', fontWeight: 600, fontSize: '1.45rem', color: 'var(--sage-600)', marginTop: 6, lineHeight: 1 }}>you&rsquo;re doing great &#10022;</div>
        </CCallout>
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 32px 24px', background: 'var(--bg-page)' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {suggestions.map(s => <CChip key={s} onClick={() => setInput(s)}>{s}</CChip>)}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', padding: '8px 8px 8px 20px',
            boxShadow: 'var(--shadow-md)',
          }}>
            <CIcon name="sparkles" size={20} color="var(--brand)" />
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Homa anything…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '1rem', color: 'var(--text-strong)' }} />
            <CIconButton variant="primary" ariaLabel="Send"><CIcon name="arrow-up" color="#fff" /></CIconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ChatView });
