import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "../../components/brand/Logo";
import { HomaCharacter } from "../world-v3/homa-character";
import { V4Scrub } from "./v4-scrub";

/**
 * /world-v4: "A day with Homa", the mixed-language landing prototype
 * (2026-07-22). Three layers, one character:
 *
 *   world   scrubbed video that alternates two realities, photoreal for her
 *           life and clay for Homa's world. The alternation is the narrative
 *           device, not decoration.
 *   product coded UI (report card, worksheet, planner) layered ON the world,
 *           so the software sits on top of the life it is helping.
 *   character the logo mark, present in both realities, the through-line.
 *
 * The amplification over the original scroll-world skill: instead of one
 * continuous chain that owns the page with copy pinned in one corner, each
 * scene is a self-contained sticky-scrub block, which lets static sections
 * interleave between them. That buys rhythm (scene, interstitial, scene,
 * pinned UI moment, scene, artifact) and lets copy move: centered, right
 * rail, lower-left, inside the card, full-width.
 *
 * This prototype reuses the clips already rendered for /world (clay) and
 * /world-real (photoreal), so the architecture can be judged before any
 * bespoke v4 footage is generated. noindex, experiment only.
 */

export const metadata: Metadata = {
  title: "A day with Homa",
  description: "A day with Homa: the plan, the worksheets, the record, and the proof it's working.",
  robots: { index: false, follow: false },
};

const CLAY = "https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/world2";
const REAL = "https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/worldreal";

export default function WorldV4Page() {
  return (
    <div className="v4">
      <style>{CSS}</style>
      <V4Scrub />

      <div className="v4-topbar">
        <Link href="/" aria-label="Homa home" style={{ textDecoration: "none" }}>
          <Logo size={28} />
        </Link>
        <a className="v4-cta" href="/onboarding">
          Get your free report
        </a>
      </div>

      {/* ═══ SCENE 1 · her world. Copy centered, the classic position skipped
          on purpose so the page does not open where every other one does. ═══ */}
      <section className="v4-scene" data-v4-scene style={{ height: "300vh" }}>
        <div className="v4-sticky">
          <video className="v4-vid" data-src={`${REAL}/hero-m.mp4`} poster={`${REAL}/hero-m.webp`} muted playsInline preload="none" />
          <div className="v4-scrim v4-scrim-top" />
          <div className="v4-layer v4-top-center" data-v4-w data-from="0" data-to="0.42" data-fade="0.1">
            <p className="v4-eyebrow">For homeschool parents</p>
            <h1>The homeschool assistant that does the prep.</h1>
          </div>
          <div className="v4-layer v4-top-center" data-v4-w data-from="0.46" data-to="1" data-fade="0.1">
            <p className="v4-eyebrow">A day with Homa</p>
            <h2 className="v4-h2-lg">She plans it. You teach it.</h2>
            <p className="v4-body v4-center">Kids never use a screen.</p>
          </div>
          <div className="v4-hint">scroll</div>
        </div>
      </section>

      {/* ═══ INTERSTITIAL · type only. The page breathes; the character is the
          only thing on screen, which is what makes her feel like a host. ═══ */}
      <section className="v4-inter" data-v4-reveal>
        <div className="v4-inter-char">
          <HomaCharacter size={78} motion="w3-bob" />
        </div>
        <h2 className="v4-display">
          Morning to bedtime,
          <br />
          she is already ahead of you.
        </h2>
        <p className="v4-body v4-center">Here is one ordinary Tuesday.</p>
      </section>

      {/* ═══ SCENE 2 · the report. Copy on a right rail; the product UI slides
          onto the world at the midpoint and the chart draws itself. ═══ */}
      <section className="v4-scene" data-v4-scene style={{ height: "340vh" }}>
        <div className="v4-sticky">
          <video className="v4-vid" data-src={`${REAL}/report-m.mp4`} poster={`${REAL}/report-m.webp`} muted playsInline preload="none" />
          <div className="v4-scrim v4-scrim-right" />
          <div className="v4-layer v4-rail" data-v4-w data-from="0" data-to="1" data-fade="0.14">
            <p className="v4-eyebrow v4-sage">First, see clearly</p>
            <h2>Where your child is, subject by subject.</h2>
            <p className="v4-body">
              The questions come to you, not your child. About five minutes, and it is free.
            </p>
          </div>
          <div className="v4-layer v4-card-slot" data-v4-w data-from="0.34" data-to="1" data-fade="0.16">
            <div className="v4-card">
              <div className="v4-card-hd">
                <span className="v4-card-t">Maya&apos;s progress</span>
                <span className="v4-card-d">Sample report</span>
              </div>
              <div className="v4-chartwrap">
                <svg viewBox="0 0 320 120" width="100%" aria-hidden="true">
                  <line x1="8" y1="100" x2="312" y2="100" stroke="rgba(34,30,26,.08)" strokeWidth="1" />
                  <line x1="8" y1="64" x2="312" y2="64" stroke="rgba(34,30,26,.08)" strokeWidth="1" />
                  <line x1="8" y1="28" x2="312" y2="28" stroke="rgba(34,30,26,.08)" strokeWidth="1" />
                  <polyline
                    className="v4-traj"
                    points="14,96 66,86 118,78 170,60 222,46 274,30"
                    fill="none"
                    stroke="var(--sage-500, #3D9A50)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle className="v4-traj-dot" cx="274" cy="30" r="5.5" fill="var(--sage-500, #3D9A50)" />
                </svg>
              </div>
              <div className="v4-subj">
                <span className="v4-dot" style={{ background: "var(--sky-500, #4FB4D6)" }} />
                <span className="v4-nm">Literacy</span>
                <span className="v4-grow">growing</span>
              </div>
              <div className="v4-subj">
                <span className="v4-dot" style={{ background: "var(--pop-cobalt, #2E6BE6)" }} />
                <span className="v4-nm">Math</span>
                <span className="v4-grow">growing</span>
              </div>
            </div>
            <div className="v4-card-char">
              <HomaCharacter size={40} motion="w3-tilt" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SCENE 3 · into Homa's world. The reality flips to clay exactly
          where the story moves from her day to Homa's work. ═══ */}
      <section className="v4-scene" data-v4-scene style={{ height: "320vh" }}>
        <div className="v4-sticky v4-clay">
          <video className="v4-vid" data-src={`${CLAY}/worksheet-m.mp4`} poster={`${CLAY}/worksheet-m.webp`} muted playsInline preload="none" />
          <div className="v4-scrim v4-scrim-bottom" />
          <div className="v4-layer v4-top-center" data-v4-w data-from="0" data-to="0.44" data-fade="0.12">
            <p className="v4-eyebrow v4-cobalt">Worksheets</p>
            <h2>Then she makes the thing your child works on.</h2>
          </div>
          <div className="v4-layer v4-paper-slot" data-v4-w data-from="0.4" data-to="1" data-fade="0.15">
            <div className="v4-paper">
              <div className="v4-ph">
                <span className="v4-ph-t">Count the dinosaurs</span>
                <span className="v4-ph-k">Maya &middot; age 4</span>
              </div>
              <div className="v4-wrow">
                <div className="v4-dinos">
                  <Dino /> <Dino /> <Dino />
                </div>
                <div className="v4-ansbox">3</div>
              </div>
              <div className="v4-wrow">
                <div className="v4-dinos">
                  <Dino /> <Dino />
                </div>
                <div className="v4-ansbox" />
              </div>
              <div className="v4-pfoot">made by Homa for Maya</div>
            </div>
          </div>
          <div className="v4-layer v4-lower-left" data-v4-w data-from="0.58" data-to="1" data-fade="0.12">
            <p className="v4-body v4-on-dark">
              Built around what she loves, at the level the report found. Print it at home.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ ARTIFACT · a static object beat. After two scrub scenes the page
          stops moving and just hands you the thing. ═══ */}
      <section className="v4-artifact" data-v4-reveal>
        <div className="v4-artifact-in">
          <div className="v4-artifact-copy">
            <p className="v4-eyebrow v4-cobalt">The binder</p>
            <h2>Every page, kept in one place.</h2>
            <p className="v4-body">
              Ask for a change and it comes back fixed. Nothing to file, nothing to lose.
            </p>
          </div>
          <div className="v4-artifact-media">
            <div className="v4-stack">
              <span className="v4-sheet v4-s3" />
              <span className="v4-sheet v4-s2" />
              <span className="v4-sheet v4-s1">
                <span className="v4-sheet-t">Count the dinosaurs</span>
                <span className="v4-sheet-row">
                  <Dino /> <Dino /> <Dino />
                </span>
              </span>
            </div>
            <div className="v4-stack-char">
              <HomaCharacter size={44} motion="w3-tilt" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SCENE 4 · the week. The one time copy sits lower-left, the
          skill's default position, used deliberately instead of by habit. ═══ */}
      <section className="v4-scene" data-v4-scene style={{ height: "300vh" }}>
        <div className="v4-sticky v4-clay">
          <video className="v4-vid" data-src={`${CLAY}/planner-m.mp4`} poster={`${CLAY}/planner-m.webp`} muted playsInline preload="none" />
          <div className="v4-scrim v4-scrim-bottom" />
          <div className="v4-layer v4-lower-left" data-v4-w data-from="0" data-to="1" data-fade="0.14">
            <p className="v4-eyebrow v4-gold">The week</p>
            <h2 className="v4-on-dark-h">When life happens, the week bends.</h2>
            <p className="v4-body v4-on-dark">
              Tell her &ldquo;we did letters and skipped math.&rdquo; That one sentence logs your
              hours and replans the rest.
            </p>
          </div>
          <div className="v4-layer v4-chip-row" data-v4-w data-from="0.5" data-to="1" data-fade="0.14">
            <span className="v4-chip">Weekly plan</span>
            <span className="v4-chip">Hours log</span>
          </div>
        </div>
      </section>

      {/* ═══ SCENE 5 · night. Clay again, and the character is the only thing
          awake, which is the whole point of the beat. ═══ */}
      <section className="v4-scene" data-v4-scene style={{ height: "280vh" }}>
        <div className="v4-sticky v4-night">
          <video className="v4-vid" data-src={`${CLAY}/observatory-m.mp4`} poster={`${CLAY}/observatory-m.webp`} muted playsInline preload="none" />
          <div className="v4-scrim v4-scrim-full" />
          <div className="v4-layer v4-mid-center" data-v4-w data-from="0" data-to="1" data-fade="0.14">
            <p className="v4-eyebrow v4-gold">While you sleep</p>
            <h2 className="v4-on-dark-h">She keeps working after bedtime.</h2>
            <div className="v4-note" data-v4-w data-from="0.4" data-to="1" data-fade="0.14">
              <div className="v4-note-h">Morning note</div>
              <p>Maya narrates everything she plays. Tomorrow&apos;s worksheet turns that into a story.</p>
            </div>
          </div>
          <div className="v4-night-char" data-v4-w data-from="0.2" data-to="1" data-fade="0.14">
            <HomaCharacter size={54} motion="w3-bob" />
          </div>
        </div>
      </section>

      {/* ═══ FINALE · back to the phone where it opened. ═══ */}
      <section className="v4-finale" data-v4-reveal>
        <div className="v4-finale-char">
          <HomaCharacter size={92} motion="w3-hop" />
        </div>
        <p className="v4-eyebrow">Start with the free report</p>
        <h2 className="v4-display">You&apos;ve got this. Homa&apos;s got the rest.</h2>
        <div className="v4-bubs">
          <span className="v4-bub v4-in">Maya&apos;s worksheet is ready. It&apos;s in the binder for you.</span>
          <span className="v4-bub v4-out">Thanks, Homa</span>
        </div>
        <p className="v4-body v4-center">
          About five minutes of questions per child. No credit card needed.
        </p>
        <div className="v4-btns">
          <a className="v4-btn v4-primary" href="/onboarding">
            Get your free report
          </a>
          <a className="v4-btn v4-ghost" href="/onboarding/sample">
            See the sample report
          </a>
        </div>
      </section>
    </div>
  );
}

function Dino() {
  return (
    <svg className="v4-dino" viewBox="0 0 60 44" aria-hidden="true">
      <path
        d="M3 29 Q11 30.5 16 26 Q19 20 26 19 Q29 11 34 8 Q40 4.5 44.5 8 Q48 11 44.5 14.5
           Q41 17 37 16.5 Q35 22 34.5 27 L34.5 39 L29.5 39 L29.5 30.5 L21 30.5 L21 39
           L16 39 L16 27.5 Q10 30 3 29 Z"
        fill="#fff"
        stroke="#221E1A"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="42.2" cy="9.4" r="1.15" fill="#221E1A" />
    </svg>
  );
}

const CSS = `
.v4{background:var(--bg-page,#FBF7F0); color:var(--text-strong,#221E1A);
  font-family:var(--font-sans,system-ui,sans-serif); overflow-x:clip;}
.v4 h1,.v4 h2{font-family:var(--font-display,system-ui,sans-serif); font-weight:700;
  letter-spacing:-.015em; line-height:1.05; margin:0 0 12px; text-wrap:balance;}
.v4 h1{font-size:clamp(2rem,5.6vw,3.5rem);}
.v4 h2{font-size:clamp(1.6rem,4.2vw,2.6rem);}
.v4-h2-lg{font-size:clamp(1.9rem,5.2vw,3.2rem) !important;}
.v4-display{font-size:clamp(1.9rem,5vw,3rem) !important;}
.v4-eyebrow{font-weight:700; font-size:.74rem; letter-spacing:.12em; text-transform:uppercase;
  margin:0 0 9px; color:var(--brand,#E7602F);}
.v4-sage{color:var(--sage-600,#2F7C40);} .v4-cobalt{color:var(--pop-cobalt,#2E6BE6);}
.v4-gold{color:var(--gold-400,#FFD43B);}
.v4-body{font-size:clamp(1rem,2.3vw,1.12rem); line-height:1.6; color:var(--text-muted,#6B6157);
  max-width:46ch; margin:0;}
.v4-center{margin-left:auto; margin-right:auto; text-align:center;}
.v4-on-dark{color:rgba(255,255,255,.9);} .v4-on-dark-h{color:#fff;}

/* chrome */
.v4-topbar{position:fixed; top:0; left:0; right:0; z-index:60; display:flex; align-items:center;
  justify-content:space-between; padding:calc(12px + env(safe-area-inset-top)) clamp(16px,4vw,40px) 12px;
  background:linear-gradient(180deg, color-mix(in srgb,var(--bg-page,#FBF7F0) 80%,transparent), transparent);
  pointer-events:none;}
.v4-topbar > *{pointer-events:auto;}
.v4-cta{font-weight:600; font-size:.86rem; text-decoration:none; color:#fff; background:var(--brand,#E7602F);
  padding:10px 19px; border-radius:999px; box-shadow:0 6px 18px rgba(90,62,40,.18); white-space:nowrap;}
.v4-cta:hover{background:var(--brand-hover,#C44C22);}

/* ── scene: tall section, sticky viewport, scrubbed clip ── */
.v4-scene{position:relative;}
.v4-sticky{position:sticky; top:0; height:100svh; overflow:hidden; background:#0d0b09;}
.v4-vid{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center 45%;}
.v4-sticky::after{content:""; position:absolute; inset:0; background:var(--v4-poster) center/cover no-repeat;
  opacity:0; pointer-events:none;}
.v4-scrim{position:absolute; inset:0; pointer-events:none;}
.v4-scrim-top{background:linear-gradient(180deg, rgba(251,247,240,.94) 0%, rgba(251,247,240,.72) 26%, transparent 58%);}
.v4-scrim-bottom{background:linear-gradient(0deg, rgba(20,16,12,.82) 0%, rgba(20,16,12,.35) 38%, transparent 68%);}
.v4-scrim-full{background:linear-gradient(180deg, rgba(12,14,26,.6), rgba(12,14,26,.86));}
.v4-scrim-right{background:linear-gradient(270deg, rgba(251,247,240,.96) 0%, rgba(251,247,240,.8) 34%, transparent 72%);}
@media (max-width:820px){
  .v4-scrim-right{background:linear-gradient(180deg, rgba(251,247,240,.95) 0%, rgba(251,247,240,.7) 30%, transparent 62%);}
}

/* waypoint layers: one --w drives opacity and lift */
.v4-layer{position:absolute; opacity:var(--w,0); transform:translateY(calc((1 - var(--w,0)) * 16px));
  will-change:opacity,transform;}
.v4-top-center{top:clamp(84px,12vh,140px); left:50%; transform:translateX(-50%) translateY(calc((1 - var(--w,0)) * 16px));
  width:min(90vw,760px); text-align:center;}
.v4-mid-center{top:50%; left:50%; width:min(90vw,620px); text-align:center;
  transform:translate(-50%,-50%) translateY(calc((1 - var(--w,0)) * 16px));}
.v4-rail{right:clamp(18px,5vw,64px); top:50%; width:min(84vw,420px);
  transform:translateY(-50%) translateY(calc((1 - var(--w,0)) * 16px));}
@media (max-width:820px){
  .v4-rail{right:auto; left:clamp(16px,5vw,32px); top:clamp(88px,13vh,150px); transform:translateY(calc((1 - var(--w,0)) * 16px));
    width:min(88vw,460px);}
}
.v4-lower-left{left:clamp(18px,5vw,64px); bottom:clamp(64px,12vh,110px); width:min(86vw,460px);}
.v4-chip-row{left:clamp(18px,5vw,64px); bottom:clamp(24px,6vh,52px); display:flex; gap:8px;}
.v4-chip{font-size:.76rem; font-weight:600; padding:7px 13px; border-radius:999px;
  background:rgba(255,255,255,.16); color:#fff; backdrop-filter:blur(6px);}
.v4-hint{position:absolute; left:50%; bottom:22px; transform:translateX(-50%); font-size:.7rem;
  letter-spacing:.16em; text-transform:uppercase; color:var(--text-muted,#6B6157); opacity:.75;}

/* product UI layered on the world */
.v4-card-slot{left:clamp(18px,5vw,64px); top:50%; width:min(86vw,420px);
  transform:translateY(-50%) translateY(calc((1 - var(--w,0)) * 22px));}
@media (max-width:820px){ .v4-card-slot{left:50%; top:auto; bottom:clamp(40px,9vh,90px);
  transform:translateX(-50%) translateY(calc((1 - var(--w,0)) * 22px)); width:min(88vw,420px);} }
.v4-card{background:#fff; border-radius:18px; box-shadow:0 26px 60px rgba(20,14,8,.28); overflow:hidden; position:relative;}
.v4-card-hd{display:flex; justify-content:space-between; align-items:center; padding:14px 16px 6px;}
.v4-card-t{font-family:var(--font-display); font-weight:700; font-size:1rem; color:#221E1A;}
.v4-card-d{font-size:.66rem; letter-spacing:.07em; text-transform:uppercase; color:#9C9186;}
.v4-chartwrap{padding:4px 16px 2px;}
.v4-traj{stroke-dasharray:340; stroke-dashoffset:calc(340 - 340 * var(--w,0));}
.v4-traj-dot{opacity:calc(var(--w,0) * var(--w,0));}
.v4-subj{display:flex; align-items:center; gap:9px; padding:9px 16px; border-top:1px solid rgba(34,30,26,.07);}
.v4-dot{width:8px; height:8px; border-radius:50%;}
.v4-nm{font-size:.86rem; font-weight:600; flex:1; color:#221E1A;}
.v4-grow{font-size:.7rem; font-weight:700; padding:4px 9px; border-radius:999px;
  background:var(--sage-50,#EAF6EC); color:var(--sage-600,#2F7C40);}
.v4-card-char{position:absolute; right:-14px; top:-20px;}

/* worksheet on the world */
.v4-paper-slot{right:clamp(18px,5vw,64px); top:50%; width:min(86vw,400px);
  transform:translateY(-52%) rotate(-2deg) translateY(calc((1 - var(--w,0)) * 22px));}
@media (max-width:820px){ .v4-paper-slot{right:auto; left:50%; top:44%;
  transform:translateX(-50%) rotate(-2deg) translateY(calc((1 - var(--w,0)) * 22px)); width:min(86vw,380px);} }
.v4-paper{background:#fff; border-radius:6px; box-shadow:0 26px 60px rgba(20,14,8,.34); padding:20px 20px 14px;}
.v4-ph{display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #f0ede6;
  padding-bottom:8px; margin-bottom:6px;}
.v4-ph-t{font-family:var(--font-display); font-weight:700; font-size:.98rem; color:#221E1A;}
.v4-ph-k{font-size:.64rem; color:#9C9186;}
.v4-wrow{display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 0;
  border-bottom:1px dashed #e9e5dc;}
.v4-wrow:last-of-type{border-bottom:none;}
.v4-dinos{display:flex; gap:8px;}
.v4-dino{width:42px; height:31px;}
.v4-ansbox{width:30px; height:30px; border:2.4px solid #221E1A; border-radius:7px; display:grid;
  place-items:center; font-family:var(--font-hand,cursive); font-size:1.1rem;
  color:var(--pop-cobalt,#2E6BE6);}
.v4-pfoot{text-align:right; font-size:.62rem; color:#9C9186; margin-top:8px;}

/* night note */
.v4-note{background:#fff; border-radius:13px; padding:12px 15px; max-width:340px; margin:16px auto 0;
  text-align:left; box-shadow:0 14px 40px rgba(0,0,0,.4); opacity:var(--w,0);}
.v4-note-h{font-size:.68rem; font-weight:700; letter-spacing:.07em; text-transform:uppercase;
  color:var(--gold-ink,#8A6410); margin-bottom:5px;}
.v4-note p{margin:0; font-size:.84rem; line-height:1.5; color:#221E1A;}
.v4-night-char{position:absolute; right:clamp(20px,7vw,90px); bottom:clamp(40px,10vh,90px); opacity:var(--w,0);}

/* ── static sections ── */
.v4-inter{padding:clamp(90px,16vh,190px) clamp(18px,5vw,48px); text-align:center;}
.v4-inter-char{margin-bottom:20px;}
.v4-artifact{padding:clamp(70px,12vh,140px) clamp(18px,5vw,48px); background:var(--bg-page-warm,#F7EFE2);}
.v4-artifact-in{max-width:1000px; margin:0 auto; display:grid; gap:clamp(28px,5vw,60px); align-items:center;}
@media (min-width:860px){ .v4-artifact-in{grid-template-columns:.85fr 1.15fr;} }
.v4-artifact-media{position:relative;}
.v4-stack{position:relative; height:clamp(200px,30vw,260px);}
.v4-sheet{position:absolute; background:#fff; border-radius:8px; box-shadow:0 14px 40px rgba(90,62,40,.18);
  left:0; right:0;}
.v4-s3{top:0; height:88%; transform:rotate(-6deg); opacity:.55;}
.v4-s2{top:4%; height:88%; transform:rotate(3deg); opacity:.8;}
.v4-s1{top:8%; height:88%; transform:rotate(-1deg); padding:18px 20px; display:block;}
.v4-sheet-t{display:block; font-family:var(--font-display); font-weight:700; font-size:.95rem;
  color:#221E1A; border-bottom:2px solid #f0ede6; padding-bottom:8px; margin-bottom:12px;}
.v4-sheet-row{display:flex; gap:9px;}
.v4-stack-char{position:absolute; right:-6px; bottom:-16px;}

.v4-finale{padding:clamp(80px,14vh,160px) clamp(18px,5vw,48px) clamp(90px,16vh,180px); text-align:center;
  background:var(--bg-page-warm,#F7EFE2);}
.v4-finale-char{margin-bottom:14px;}
.v4-bubs{display:flex; flex-direction:column; gap:8px; max-width:330px; margin:20px auto;}
.v4-bub{padding:10px 14px; border-radius:17px; font-size:.86rem; line-height:1.45; text-align:left;}
.v4-bub.v4-in{background:#fff; border:1px solid rgba(34,30,26,.08); border-bottom-left-radius:6px; color:#221E1A;}
.v4-bub.v4-out{background:#E9E9EB; border-bottom-right-radius:6px; align-self:flex-end; color:#111;}
.v4-btns{display:flex; gap:11px; justify-content:center; flex-wrap:wrap; margin-top:18px;}
.v4-btn{font-weight:600; font-size:.94rem; padding:14px 25px; border-radius:999px; text-decoration:none;}
.v4-primary{background:var(--brand,#E7602F); color:#fff; box-shadow:0 8px 22px rgba(90,62,40,.2);}
.v4-primary:hover{background:var(--brand-hover,#C44C22);}
.v4-ghost{color:var(--text-strong,#221E1A); border:1.5px solid rgba(34,30,26,.22);}

/* reveal for static sections */
html.v4-armed [data-v4-reveal]{opacity:0; transform:translateY(20px);
  transition:opacity .8s ease, transform .8s ease;}
html.v4-armed [data-v4-reveal].v4-in{opacity:1; transform:none;}

@media (prefers-reduced-motion:reduce){
  html.v4-armed [data-v4-reveal]{opacity:1; transform:none; transition:none;}
  .v4-layer{opacity:1 !important; transform:none !important;}
  .v4-note,.v4-night-char{opacity:1 !important;}
  .v4-traj{stroke-dashoffset:0 !important;} .v4-traj-dot{opacity:1 !important;}
  .v4-scene{height:auto !important;} .v4-sticky{position:relative; height:auto; min-height:70svh;}
}
`;
