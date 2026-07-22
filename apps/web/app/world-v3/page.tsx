import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "../../components/brand/Logo";
import { HomaCharacter } from "./homa-character";
import { W3Reveal } from "./reveal";

/**
 * /world-v3: the composition-system landing experiment (2026-07-22), built
 * from the founder-approved mock saved at
 * docs/homa-design/explorations/2026-07-22-landing-v3-composition-mock.html.
 * The system: contained media on the cream page (never full-bleed photos),
 * real product UI as the literal proof (report card, practice page, planner
 * board, morning note), photos demoted to small tilted chips, text position
 * varying per beat, and one living character (the logo mark itself, one
 * instance per view, with a job in every scene). Copy passed both copy gates
 * on 2026-07-22; the fixture child is Maya, the public demo child.
 *
 * Motion is CSS only: the hero character pops in on load, eyes blink, the
 * report line draws and the planner card slides in when their sections
 * reveal (W3Reveal adds .w3-in). Reduced motion disables all of it and the
 * reveal system is JS-armed, so no-JS reads as a complete page.
 * noindex + absent from sitemap.ts while this is an experiment.
 */

export const metadata: Metadata = {
  title: "A day with Homa",
  description:
    "Homa plans the week, makes the worksheets, and logs your hours. Start with a free progress report.",
  robots: { index: false, follow: false },
};

const CHART_POINTS = "14,104 66,92 118,84 170,66 222,52 274,34";

export default function WorldV3Page() {
  return (
    <div className="w3">
      <style>{CSS}</style>
      <W3Reveal />

      <div className="w3-topbar">
        <Link href="/" aria-label="Homa home" style={{ textDecoration: "none" }}>
          <Logo size={28} />
        </Link>
        <a className="w3-cta" href="/onboarding">
          Get your free report
        </a>
      </div>

      {/* Beat 1: the claim. Text above, contained phone below, one character. */}
      <section className="w3-hero">
        <p className="w3-eyebrow" style={{ color: "var(--brand)" }}>
          For homeschool parents
        </p>
        <h1>The homeschool assistant that does the prep.</h1>
        <p className="w3-body w3-center">
          Homa is an assistant for parents. She plans the week, makes the worksheets, and logs your
          hours. Kids never use a screen.
        </p>
        <span className="w3-chip w3-chip-clay">Screen-free</span>
        <div className="w3-phone-stage">
          <div className="w3-phone">
            <div className="w3-phone-char">
              <HomaCharacter size={50} motion="w3-bob" />
            </div>
            <div className="w3-notch" />
            <div className="w3-screen">
              <div className="w3-statusbar">
                <span>9:41</span>
                <span>&#9679;&#9679;&#9679;</span>
              </div>
              <div className="w3-chathead">
                <div className="w3-avatar-slot">
                  <div className="w3-dust" />
                </div>
                <span className="w3-cname">Homa</span>
              </div>
              <div className="w3-chatbody">
                <div className="w3-bub w3-out">What should we work on this week?</div>
                <div className="w3-bub w3-in-bub">
                  Maya&apos;s ready for two-digit addition. I&apos;ll add it to this week&apos;s
                  plan.
                </div>
                <div className="w3-bub w3-out">Perfect, thank you</div>
              </div>
              <div className="w3-chatinput">
                <div className="w3-field" />
                <div className="w3-send" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Beat 2: the report. Media left, text right, chart draws on reveal. */}
      <section>
        <div className="w3-beat w3-media-left" data-w3-reveal>
          <div className="w3-beat-media">
            <div className="w3-card">
              <div className="w3-card-hd">
                <span className="w3-card-t">Maya&apos;s progress</span>
                <span className="w3-card-d">Sample report</span>
              </div>
              <div className="w3-chartwrap">
                <svg viewBox="0 0 320 130" width="100%" aria-hidden="true">
                  <line x1="8" y1="110" x2="312" y2="110" stroke="var(--w3-line)" strokeWidth="1" />
                  <line x1="8" y1="70" x2="312" y2="70" stroke="var(--w3-line)" strokeWidth="1" />
                  <line x1="8" y1="30" x2="312" y2="30" stroke="var(--w3-line)" strokeWidth="1" />
                  <polyline
                    className="w3-trajectory"
                    points={CHART_POINTS}
                    fill="none"
                    stroke="var(--sage-500, #3D9A50)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle className="w3-traj-dot" cx="274" cy="34" r="5.5" fill="var(--sage-500, #3D9A50)" />
                </svg>
              </div>
              <div className="w3-subj">
                <span className="w3-dot" style={{ background: "var(--sky-500, #4FB4D6)" }} />
                <span className="w3-nm">Literacy</span>
                <span className="w3-grow">growing</span>
              </div>
              <div className="w3-subj">
                <span className="w3-dot" style={{ background: "var(--pop-cobalt, #2E6BE6)" }} />
                <span className="w3-nm">Math</span>
                <span className="w3-grow">growing</span>
              </div>
              <div className="w3-subj">
                <span className="w3-dot" style={{ background: "var(--gold-400, #FFD43B)" }} />
                <span className="w3-nm">Motor skills</span>
                <span className="w3-grow">new this week</span>
              </div>
            </div>
            <div className="w3-photo-chip w3-pc-br">
              {/* Contained photo chips render at chip size, never upscaled. */}
              <img src="/world3/photo-report.webp" alt="A mom reading the progress report at her kitchen table" />
            </div>
            <div className="w3-peek">
              <HomaCharacter size={44} motion="w3-tilt" />
            </div>
          </div>
          <div className="w3-beat-copy">
            <p className="w3-eyebrow" style={{ color: "var(--sage-600, #2F7C40)" }}>
              The free progress report
            </p>
            <h2>See where your child is, subject by subject.</h2>
            <p className="w3-body">
              The questions come to you, not your child. They take about five minutes. Homa turns
              your answers into the progress report: what looks solid, and what comes next.{" "}
              <a href="/onboarding/sample" className="w3-inline-link">
                See a sample report
              </a>
            </p>
            <ul className="w3-chips">
              <li className="w3-chip-sage">About five minutes</li>
              <li className="w3-chip-sage">Free</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Beat 3: the practice page. Media right, text left. */}
      <section style={{ background: "var(--bg-page-warm, #F7EFE2)" }}>
        <div className="w3-beat w3-media-right" data-w3-reveal>
          <div className="w3-beat-media">
            <div className="w3-paper">
              <div className="w3-paper-char">
                <HomaCharacter size={42} motion="w3-tilt" />
              </div>
              <div className="w3-ph">
                <div>
                  <span className="w3-ph-t">Count the dinosaurs</span>
                  <span className="w3-instr">Count each row. Write how many.</span>
                </div>
                <span className="w3-ph-k">Maya &middot; age 4</span>
              </div>
              {WORKSHEET_ROWS.map((row, i) => (
                <div className="w3-wrow" key={row.kind}>
                  <div className="w3-dinos">
                    {Array.from({ length: row.count }, (_, j) => (
                      <Dino kind={row.kind} key={j} />
                    ))}
                  </div>
                  <div className="w3-ansbox">
                    <span className="w3-ansnum">{i === 0 ? "3" : ""}</span>
                  </div>
                </div>
              ))}
              <div className="w3-pfoot">
                <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    d="M24 5.6 C22.5 5.6 21 6.2 19.8 7.3 L7.1 18.9 C5.5 20.4 4.6 22.5 4.6 24.7 L4.6 35.2 C4.6 40.1 8.5 44 13.4 44 L34.6 44 C39.5 44 43.4 40.1 43.4 35.2 L43.4 24.7 C43.4 22.5 42.5 20.4 40.9 18.9 L28.2 7.3 C27 6.2 25.5 5.6 24 5.6 Z"
                    fill="#E7602F"
                  />
                </svg>
                <span>made by Homa for Maya</span>
              </div>
            </div>
            <div className="w3-photo-chip w3-pc-bl">
              <img src="/world3/photo-worksheet.webp" alt="A mom and her child working on the dinosaur counting worksheet" />
            </div>
          </div>
          <div className="w3-beat-copy">
            <p className="w3-eyebrow" style={{ color: "var(--pop-cobalt, #2E6BE6)" }}>
              Worksheets
            </p>
            <h2>Custom worksheets, built for your child.</h2>
            <p className="w3-body">
              Homa builds each one around what your child loves, at the level the report found. Print
              it at home. Ask for a change and it comes back fixed.
            </p>
            <ul className="w3-chips">
              <li className="w3-chip-sky">Worksheets</li>
              <li className="w3-chip-sky">Coloring pages</li>
              <li className="w3-chip-sky">The binder</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Beat 4: the planner. Text above, board below, card slides on reveal. */}
      <section>
        <div className="w3-planner-wrap" data-w3-reveal>
          <p className="w3-eyebrow w3-center" style={{ color: "var(--pop-navy, #23304F)" }}>
            The weekly plan
          </p>
          <h2 className="w3-center">When life happens, the week bends.</h2>
          <p className="w3-body w3-center" style={{ marginLeft: "auto", marginRight: "auto" }}>
            Tell Homa &ldquo;we did letters and skipped math.&rdquo; That one sentence logs your
            hours, updates the progress report, and replans next week.
          </p>
          <div className="w3-board-stage">
            <div className="w3-board">
              <div className="w3-goal w3-goal-clay">
                <span className="w3-goal-lb">Math</span> Counts past 20 without getting stuck
              </div>
              <div className="w3-goal w3-goal-sage">
                <span className="w3-goal-lb">Literacy</span> Reads their own name on sight
              </div>
              <div className="w3-days">
                <div className="w3-day">
                  <div className="w3-dh">MON</div>
                  <div className="w3-task w3-t-sage w3-done">
                    <span className="w3-cb" />
                    Count the grocery cart items
                    <svg className="w3-star" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z"
                        fill="var(--gold-400, #FFD43B)"
                      />
                    </svg>
                  </div>
                  <div className="w3-task w3-t-clay">
                    <span className="w3-cb" />
                    Five minutes of letter tracing
                  </div>
                </div>
                <div className="w3-day w3-today">
                  <div className="w3-dh">
                    TUE <span className="w3-today-tag">TODAY</span>
                  </div>
                  <div className="w3-task w3-t-sky w3-slide">
                    <span className="w3-cb" />
                    Dinosaur counting page
                  </div>
                  <div className="w3-task w3-t-sage">
                    <span className="w3-cb" />
                    Library trip: pick any book
                  </div>
                </div>
                <div className="w3-day">
                  <div className="w3-dh">WED</div>
                  <div className="w3-task w3-t-gold">
                    <span className="w3-cb" />
                    Museum morning, tie to trucks
                  </div>
                </div>
              </div>
            </div>
            <div className="w3-board-char">
              <HomaCharacter size={46} motion="w3-bob" />
            </div>
          </div>
          <ul className="w3-chips w3-chips-center">
            <li className="w3-chip-navy">Weekly plan</li>
            <li className="w3-chip-navy">Hours log</li>
          </ul>
        </div>
      </section>

      {/* Beat 5: the night panel, contained navy on cream. */}
      <section>
        <div className="w3-night" data-w3-reveal>
          <i className="w3-s1" />
          <i className="w3-s2" />
          <i className="w3-s3" />
          <i className="w3-s4" />
          <p className="w3-eyebrow" style={{ color: "var(--gold-400, #FFD43B)" }}>
            While you sleep
          </p>
          <h2>Homa keeps working after bedtime.</h2>
          <p className="w3-body w3-night-body">
            While you sleep, she reads teaching research and leaves a morning note. Whenever you
            need her, text her, call her, or email her. She answers where you are.
          </p>
          <div className="w3-mnote">
            <div className="w3-mh">
              <svg width="13" height="13" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  d="M24 5.6 C22.5 5.6 21 6.2 19.8 7.3 L7.1 18.9 C5.5 20.4 4.6 22.5 4.6 24.7 L4.6 35.2 C4.6 40.1 8.5 44 13.4 44 L34.6 44 C39.5 44 43.4 40.1 43.4 35.2 L43.4 24.7 C43.4 22.5 42.5 20.4 40.9 18.9 L28.2 7.3 C27 6.2 25.5 5.6 24 5.6 Z"
                  fill="var(--gold-ink, #8A6410)"
                />
              </svg>
              Morning note
            </div>
            <p>Maya narrates everything she plays. Tomorrow&apos;s practice page turns that into a story.</p>
          </div>
          <ul className="w3-chips" style={{ marginTop: 18 }}>
            <li className="w3-chip-night">Text</li>
            <li className="w3-chip-night">Call</li>
            <li className="w3-chip-night">Email</li>
          </ul>
          <div className="w3-lampglow" />
          <div className="w3-night-char">
            <HomaCharacter size={54} motion="w3-bob" />
          </div>
        </div>
      </section>

      {/* Beat 6: finale + ask. */}
      <section className="w3-finale" style={{ background: "var(--bg-page-warm, #F7EFE2)" }}>
        <div className="w3-hop-stage">
          <HomaCharacter size={92} motion="w3-hop" />
        </div>
        <p className="w3-eyebrow" style={{ color: "var(--brand)", marginTop: 18 }}>
          Start with the free report
        </p>
        <h2>You&apos;ve got this. Homa&apos;s got the rest.</h2>
        <p className="w3-body w3-center">
          About five minutes of questions per child. No credit card needed. The report keeps growing
          with every day you log.
        </p>
        <div className="w3-bub-pair">
          <div className="w3-bub w3-in-bub">Maya&apos;s worksheet is ready. It&apos;s in the binder for you.</div>
          <div className="w3-bub w3-out">Thanks, Homa</div>
        </div>
        <div className="w3-btn-row">
          <a className="w3-btn w3-btn-primary" href="/onboarding">
            Get your free report
          </a>
          <a className="w3-btn w3-btn-ghost" href="/onboarding/sample">
            See the sample report
          </a>
        </div>
      </section>

      {/* Compact trust section, per the locked beat sheet. */}
      <section className="w3-trust">
        <h2 className="w3-center" style={{ fontSize: "clamp(1.3rem, 3.4vw, 1.8rem)" }}>
          Good to know
        </h2>
        <div className="w3-trust-grid">
          <div className="w3-trust-card">
            <h3>How the report is made</h3>
            <p>
              Homa checks each answer against published national standards and education research.{" "}
              <a href="/onboarding/method" className="w3-inline-link">
                Read the method
              </a>
            </p>
          </div>
          <div className="w3-trust-card">
            <h3>Does my child ever use it?</h3>
            <p>Never. Homa is a tool for you. Your child works on paper, at the table, with you.</p>
          </div>
          <div className="w3-trust-card">
            <h3>Is Homa AI?</h3>
            <p>
              Yes. Homa uses AI to do the prep, and you stay the teacher. She never talks to your
              child, and your family&apos;s information is never sold.
            </p>
          </div>
          <div className="w3-trust-card">
            <h3>By homeschoolers</h3>
            <p>
              Homa is built by a homeschooling family.{" "}
              <Link href="/#stories" className="w3-inline-link">
                Our story
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * The worksheet's rows. A real counting page repeats one creature per row and
 * varies it between rows, which is also what makes the page readable at chip
 * size: the shapes differ enough to count without reading a caption.
 */
const WORKSHEET_ROWS = [
  { kind: "longneck" as const, count: 3 },
  { kind: "stego" as const, count: 2 },
  { kind: "trike" as const, count: 4 },
];

/**
 * Line-art dinosaurs for the worksheet fixture. Each species is one closed
 * outline path (white fill, dark stroke) so it reads as printable clip art at
 * the ~54px the page renders it at, the way the real generated worksheets do.
 */
function Dino({ kind }: { kind: "longneck" | "stego" | "trike" }) {
  const s = {
    stroke: "#221E1A",
    strokeWidth: 2.2,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    fill: "#fff",
  };
  return (
    <svg className="w3-dino" viewBox="0 0 60 44" aria-hidden="true">
      {kind === "longneck" && (
        <>
          <path
            d="M3 29 Q11 30.5 16 26 Q19 20 26 19 Q29 11 34 8 Q40 4.5 44.5 8 Q48 11 44.5 14.5
               Q41 17 37 16.5 Q35 22 34.5 27 L34.5 39 L29.5 39 L29.5 30.5 L21 30.5 L21 39
               L16 39 L16 27.5 Q10 30 3 29 Z"
            {...s}
          />
          <circle cx="42.2" cy="9.4" r="1.15" fill="#221E1A" />
        </>
      )}
      {kind === "stego" && (
        <>
          <path
            d="M3 30 Q11 31 16 27 Q19 22 26 21 Q33 20 38 23 Q42 20.5 45.5 22 Q49 24 45.5 27.5
               Q42 29.5 38.5 28.5 Q37 33 36.5 36 L36.5 39 L31.5 39 L31.5 31 L22 31 L22 39
               L17 39 L17 28 Q10 31 3 30 Z"
            {...s}
          />
          <path d="M18 24.5 L20.5 17 L24.5 23" fill="none" stroke="#221E1A" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M25.5 22.5 L28.5 15 L32.5 21" fill="none" stroke="#221E1A" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M33.5 21 L36.5 16 L39 22.5" fill="none" stroke="#221E1A" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="43.4" cy="24.4" r="1.05" fill="#221E1A" />
        </>
      )}
      {kind === "trike" && (
        <>
          <path
            d="M3 30 Q11 31 16 27 Q19 22 26 21 Q32 20 36 23 Q38.5 18 43 17 Q49.5 15.5 52.5 20.5
               Q55 25 50.5 28 Q45.5 30.5 40 28 Q38 33 37 36 L37 39 L32 39 L32 31 L22 31 L22 39
               L17 39 L17 28 Q10 31 3 30 Z"
            {...s}
          />
          <path d="M43.5 18 Q46 23 43.5 28" fill="none" stroke="#221E1A" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M50 19.5 L57.5 15.5" fill="none" stroke="#221E1A" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="47.6" cy="23.4" r="1.05" fill="#221E1A" />
        </>
      )}
    </svg>
  );
}

const CSS = `
.w3{
  --w3-line: rgba(34,30,26,.08);
  --w3-shadow: var(--shadow-sm, 0 10px 30px rgba(90,62,40,.10));
  --w3-shadow-lg: var(--shadow-lg, 0 24px 60px rgba(90,62,40,.16));
  background: var(--bg-page, #FBF7F0);
  color: var(--text-strong, #221E1A);
  font-family: var(--font-sans, system-ui, sans-serif);
  overflow-x: clip;
}
.w3 section{padding: clamp(56px,9vw,110px) clamp(18px,5vw,48px); position: relative;}
.w3 h1,.w3 h2{font-family: var(--font-display, system-ui, sans-serif); font-weight:700;
  letter-spacing:-.015em; line-height:1.06; margin:0 0 14px; text-wrap:balance;}
.w3 h1{font-size:clamp(2.1rem,6.5vw,3.4rem);}
.w3 h2{font-size:clamp(1.7rem,5vw,2.6rem);}
.w3-eyebrow{font-weight:700; font-size:.76rem; letter-spacing:.11em; text-transform:uppercase; margin:0 0 10px;}
.w3-body{font-size:clamp(1rem,2.6vw,1.15rem); line-height:1.6; color:var(--text-muted,#6B6157);
  max-width:56ch; margin:0 0 18px;}
.w3-center{text-align:center; margin-left:auto; margin-right:auto;}
.w3-inline-link{color:var(--sage-600,#2F7C40); font-weight:600;}
.w3-chips{display:flex; flex-wrap:wrap; gap:8px; margin:0; padding:0; list-style:none;}
.w3-chips-center{justify-content:center; margin-top:20px;}
.w3-chips li{font-size:.8rem; font-weight:600; padding:7px 14px; border-radius:999px;}
.w3-chip-sage{background:var(--sage-50,#EAF6EC); color:var(--sage-600,#2F7C40);}
.w3-chip-sky{background:var(--sky-100,#DDF3F9); color:var(--pop-cobalt,#2E6BE6);}
.w3-chip-navy{background:var(--bg-page-warm,#F7EFE2); color:var(--pop-navy,#23304F);}
.w3-chip-night{background:rgba(255,255,255,.12); color:#F2EDE4;}

/* character */
.w3char{overflow:visible;}
.w3char .w3pupil{animation:w3blink 4.6s infinite; transform-origin:center; transform-box:fill-box;}
@keyframes w3blink{0%,92%,100%{transform:scaleY(1);}95%,97%{transform:scaleY(.08);}}
.w3-bob{animation:w3bob 2.8s ease-in-out infinite;}
@keyframes w3bob{0%,100%{transform:translateY(0);}50%{transform:translateY(-7px);}}
.w3-tilt{animation:w3tilt 3.4s ease-in-out infinite;}
@keyframes w3tilt{0%,100%{transform:rotate(-6deg);}50%{transform:rotate(5deg);}}
.w3-hop{animation:w3hop 3.2s ease-in-out infinite;}
@keyframes w3hop{0%,55%,100%{transform:translateY(0) scaleY(1);}60%{transform:translateY(0) scaleY(.9);}
  70%{transform:translateY(-14px) scaleY(1.05);}80%{transform:translateY(0) scaleY(.95);}86%{transform:translateY(0) scaleY(1);}}
@media (prefers-reduced-motion:reduce){
  .w3char .w3pupil,.w3-bob,.w3-tilt,.w3-hop{animation:none !important;}
}

/* chrome */
.w3-topbar{position:sticky; top:0; z-index:50; display:flex; align-items:center; justify-content:space-between;
  padding:14px clamp(18px,5vw,48px); background:color-mix(in srgb, var(--bg-page,#FBF7F0) 88%, transparent);
  backdrop-filter:blur(12px);}
.w3-cta{font-weight:600; font-size:.88rem; text-decoration:none; color:#fff; background:var(--brand,#E7602F);
  padding:10px 20px; border-radius:999px; box-shadow:var(--w3-shadow); white-space:nowrap;
  transition:background .2s, transform .2s;}
.w3-cta:hover{background:var(--brand-hover,#C44C22);}
.w3-cta:active{transform:scale(.97);}

/* hero */
.w3-hero{text-align:center; padding-top:clamp(28px,5vw,64px);}
.w3-chip-clay{display:inline-block; font-size:.8rem; font-weight:600; color:var(--brand-hover,#C44C22);
  background:var(--brand-soft,#FFF0E8); border:1px solid var(--clay-100,#FFDDC9);
  padding:7px 14px; border-radius:999px; margin-bottom:26px;}
.w3-phone-stage{position:relative; display:flex; justify-content:center; margin-top:8px;}
.w3-phone{width:min(310px,78vw); background:#1a1a1e; border-radius:44px; padding:11px;
  box-shadow:var(--w3-shadow-lg); position:relative;}
.w3-phone-char{position:absolute; top:-25px; left:50%; transform:translateX(-50%); z-index:3;}
.w3-notch{position:absolute; top:21px; left:50%; transform:translateX(-50%); width:84px; height:24px;
  background:#1a1a1e; border-radius:14px;}
.w3-screen{background:#F6F6F8; border-radius:34px; overflow:hidden; display:flex; flex-direction:column;
  min-height:480px;}
.w3-statusbar{display:flex; justify-content:space-between; align-items:center; padding:12px 22px 4px;
  font-size:.72rem; font-weight:600; color:#111; font-variant-numeric:tabular-nums;}
.w3-chathead{display:flex; flex-direction:column; align-items:center; gap:2px; padding:10px 16px;
  border-bottom:1px solid #e8e8ec;}
.w3-avatar-slot{width:42px; height:42px; border-radius:50%; background:#ececf1; display:grid; place-items:center;}
.w3-dust{width:18px; height:5px; border-radius:50%; background:#d8d8df;}
.w3-cname{font-size:.82rem; font-weight:600; color:#111;}
.w3-chatbody{flex:1; padding:16px 14px; display:flex; flex-direction:column; gap:10px;}
.w3-bub{max-width:84%; padding:10px 14px; border-radius:18px; font-size:.86rem; line-height:1.45;}
.w3-bub.w3-out{align-self:flex-end; background:#E9E9EB; color:#111; border-bottom-right-radius:6px;}
.w3-bub.w3-in-bub{align-self:flex-start; background:#fff; color:#111; border:1px solid #e8e8ec;
  border-bottom-left-radius:6px;}
.w3-chatinput{display:flex; align-items:center; gap:8px; padding:10px 14px 16px;}
.w3-field{flex:1; height:34px; border-radius:999px; background:#fff; border:1px solid #e2e2e8;}
.w3-send{width:30px; height:30px; border-radius:50%; background:var(--brand,#E7602F);}

/* beat layout */
.w3-beat{display:grid; gap:clamp(24px,4vw,48px); align-items:center; max-width:1020px; margin:0 auto;}
@media (min-width:820px){
  .w3-beat.w3-media-left{grid-template-columns:1.1fr .9fr;}
  .w3-beat.w3-media-left .w3-beat-copy{order:2;}
  .w3-beat.w3-media-right{grid-template-columns:.9fr 1.1fr;}
  .w3-beat.w3-media-right .w3-beat-media{order:2;}
}
.w3-beat-media{position:relative;}
/* Stacked layout: the photo chips hang off the media's corner, so the copy
   below needs clearance or the chip lands on the eyebrow. */
@media (max-width:819px){ .w3-beat-media{margin-bottom:38px;} }
.w3-photo-chip{position:absolute; width:clamp(110px,22vw,190px); border-radius:16px;
  box-shadow:var(--w3-shadow-lg); border:4px solid var(--surface,#fff); overflow:hidden; transform:rotate(-4deg);}
.w3-photo-chip img{width:100%; display:block;}
.w3-pc-br{right:-8px; bottom:-26px; transform:rotate(4deg);}
.w3-pc-tr{right:-4px; top:-24px;}
/* Bottom-left on the worksheet beat so the photo overlaps the page corner
   without covering a single answer box. */
.w3-pc-bl{left:-16px; bottom:-30px; transform:rotate(-5deg);}
.w3-peek{position:absolute; left:-12px; top:-22px; z-index:2;}

/* report card */
.w3-card{background:var(--surface,#fff); border:1px solid var(--w3-line); border-radius:20px;
  box-shadow:var(--w3-shadow-lg); overflow:hidden;}
.w3-card-hd{display:flex; align-items:center; justify-content:space-between; padding:16px 18px 8px;}
.w3-card-t{font-family:var(--font-display); font-weight:700; font-size:1.05rem;}
.w3-card-d{font-size:.72rem; color:var(--text-subtle,#9C9186); letter-spacing:.06em; text-transform:uppercase;}
.w3-chartwrap{padding:6px 18px 4px;}
.w3-trajectory{stroke-dasharray:340; stroke-dashoffset:340; transition:stroke-dashoffset 1.6s ease .3s;}
.w3-traj-dot{opacity:0; transition:opacity .4s ease 1.7s;}
.w3-in .w3-trajectory{stroke-dashoffset:0;}
.w3-in .w3-traj-dot{opacity:1;}
html:not(.w3-armed) .w3-trajectory{stroke-dashoffset:0;}
html:not(.w3-armed) .w3-traj-dot{opacity:1;}
.w3-subj{display:flex; align-items:center; gap:10px; padding:9px 18px; border-top:1px solid var(--w3-line);}
.w3-dot{width:9px; height:9px; border-radius:50%;}
.w3-nm{font-size:.88rem; font-weight:600; flex:1;}
.w3-grow{font-size:.72rem; font-weight:700; padding:4px 10px; border-radius:999px;
  background:var(--sage-50,#EAF6EC); color:var(--sage-600,#2F7C40);}

/* worksheet paper */
.w3-paper{background:#fff; border-radius:6px; box-shadow:var(--w3-shadow-lg); padding:28px 26px 22px;
  position:relative; transform:rotate(-1.5deg); border:1px solid #eee;}
.w3-paper-char{position:absolute; right:-17px; top:-21px; z-index:2;}
.w3-ph{display:flex; justify-content:space-between; align-items:flex-start; gap:12px;
  border-bottom:2px solid #f0ede6; padding-bottom:10px; margin-bottom:6px;}
.w3-ph-t{display:block; font-family:var(--font-display); font-weight:700; font-size:1.08rem; color:#221E1A;
  line-height:1.2;}
.w3-instr{display:block; font-size:.72rem; color:#8C8478; margin-top:4px;}
.w3-ph-k{font-size:.68rem; color:#9C9186; white-space:nowrap; padding-top:3px;}
.w3-wrow{display:flex; align-items:center; justify-content:space-between; gap:14px; padding:15px 2px;
  border-bottom:1px dashed #e9e5dc;}
.w3-wrow:last-of-type{border-bottom:none;}
.w3-dinos{display:flex; gap:12px; flex-wrap:wrap; align-items:center;}
.w3-dino{width:54px; height:40px; flex-shrink:0;}
/* The answer box is where a child writes the count, so it reads as a writing
   field: a ruled guide line inside a printable-weight box, not a checkbox. */
.w3-ansbox{width:36px; height:36px; border:2.5px solid #221E1A; border-radius:8px; flex-shrink:0;
  position:relative; background:#fff; display:grid; place-items:center;}
.w3-ansbox::after{content:""; position:absolute; left:7px; right:7px; bottom:8px;
  border-bottom:1.5px dashed #CFC8BA;}
.w3-ansnum{font-family:var(--font-hand, cursive); font-size:1.35rem; line-height:1;
  color:var(--pop-cobalt,#2E6BE6); transform:translateY(-2px) rotate(-4deg);}
.w3-pfoot{display:flex; align-items:center; gap:6px; justify-content:flex-end; margin-top:16px;
  padding-top:10px; border-top:1px solid #f4f1ea;}
.w3-pfoot span{font-size:.66rem; color:#9C9186;}

/* planner */
.w3-planner-wrap{max-width:820px; margin:0 auto; text-align:center;}
.w3-board-stage{position:relative; margin-top:26px; text-align:left;}
.w3-board{background:var(--surface,#fff); border:1px solid var(--w3-line); border-radius:20px;
  box-shadow:var(--w3-shadow-lg); padding:16px;}
.w3-goal{display:flex; align-items:center; gap:8px; font-size:.74rem; font-weight:600; border-radius:10px;
  padding:7px 11px; margin-bottom:7px;}
.w3-goal-lb{font-size:.62rem; letter-spacing:.08em; text-transform:uppercase; font-weight:700; opacity:.75;}
.w3-goal-clay{background:var(--brand-soft,#FFF0E8); color:var(--brand-hover,#C44C22);}
.w3-goal-sage{background:var(--sage-50,#EAF6EC); color:var(--sage-600,#2F7C40);}
.w3-days{display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin-top:12px;}
.w3-day{background:var(--bg-page,#FBF7F0); border:1px solid var(--w3-line); border-radius:13px; padding:9px;}
.w3-day.w3-today{border:1.6px solid var(--brand,#E7602F);}
.w3-dh{font-size:.66rem; font-weight:700; letter-spacing:.06em; color:var(--text-subtle,#9C9186);
  margin-bottom:7px; display:flex; justify-content:space-between; align-items:center;}
.w3-today-tag{background:var(--brand,#E7602F); color:#fff; border-radius:99px; padding:1px 7px; font-size:.58rem;}
.w3-task{border-radius:9px; padding:7px 8px; font-size:.68rem; line-height:1.35; margin-bottom:6px;
  display:flex; gap:6px; align-items:flex-start;}
.w3-t-sage{background:var(--sage-50,#EAF6EC);}
.w3-t-clay{background:var(--brand-soft,#FFF0E8);}
.w3-t-sky{background:var(--sky-100,#DDF3F9);}
.w3-t-gold{background:var(--gold-100,#FFF3C2); color:var(--gold-ink,#8A6410);}
.w3-cb{width:13px; height:13px; border:1.8px solid rgba(34,30,26,.35); border-radius:4px; flex-shrink:0;
  margin-top:1px; background:#fff;}
.w3-done{outline:1.6px solid var(--sage-500,#3D9A50); outline-offset:-1.6px;}
.w3-done .w3-cb{background:var(--sage-500,#3D9A50); border-color:var(--sage-500,#3D9A50); position:relative;}
.w3-done .w3-cb::after{content:""; position:absolute; inset:2px 3px; border-left:2px solid #fff;
  border-bottom:2px solid #fff; transform:rotate(-48deg) translateY(-1px);}
.w3-star{margin-left:auto; flex-shrink:0;}
.w3-slide{transform:translateX(26px); opacity:0; transition:transform .7s ease .4s, opacity .7s ease .4s;}
.w3-in .w3-slide{transform:translateX(0); opacity:1;}
html:not(.w3-armed) .w3-slide{transform:none; opacity:1;}
.w3-board-char{position:absolute; left:-14px; bottom:-20px; z-index:2;}

/* night */
.w3-night{max-width:1020px; margin:0 auto; background:var(--pop-navy,#23304F); border-radius:26px;
  box-shadow:var(--w3-shadow-lg); color:#F2EDE4; overflow:hidden; position:relative;
  padding:clamp(28px,5vw,44px);}
.w3-night h2{color:#fff;}
.w3-night-body{color:rgba(242,237,228,.82);}
.w3-night i{position:absolute; width:3px; height:3px; border-radius:50%; background:var(--gold-300,#FFE175);
  opacity:.7;}
.w3-s1{top:14%; left:8%;} .w3-s2{top:24%; left:88%;} .w3-s3{top:10%; left:55%;} .w3-s4{top:38%; left:72%;}
.w3-mnote{background:#fff; color:#221E1A; border-radius:14px; padding:12px 15px; max-width:330px;
  box-shadow:0 12px 34px rgba(0,0,0,.35);}
.w3-mh{display:flex; align-items:center; gap:7px; font-size:.72rem; font-weight:700;
  color:var(--gold-ink,#8A6410); letter-spacing:.06em; text-transform:uppercase; margin-bottom:6px;}
.w3-mnote p{margin:0; font-size:.84rem; line-height:1.5;}
.w3-lampglow{position:absolute; right:clamp(6px,4vw,34px); bottom:0; width:150px; height:150px;
  border-radius:50%; background:radial-gradient(circle, rgba(255,212,59,.28), transparent 70%);}
.w3-night-char{position:absolute; right:clamp(16px,5vw,44px); bottom:-12px;}

/* finale */
.w3-finale{text-align:center;}
.w3-hop-stage{display:inline-block;}
.w3-bub-pair{display:flex; flex-direction:column; gap:8px; max-width:320px; margin:22px auto;}
.w3-bub-pair .w3-bub{box-shadow:var(--w3-shadow);}
.w3-btn-row{display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:10px;}
.w3-btn{font-weight:600; font-size:.95rem; padding:14px 26px; border-radius:999px; text-decoration:none;}
.w3-btn-primary{background:var(--brand,#E7602F); color:#fff; box-shadow:var(--w3-shadow);}
.w3-btn-primary:hover{background:var(--brand-hover,#C44C22);}
.w3-btn-ghost{color:var(--text-strong,#221E1A);
  border:1.5px solid color-mix(in srgb, var(--text-strong,#221E1A) 25%, transparent);}

/* trust */
.w3-trust{max-width:1020px; margin:0 auto;}
.w3-trust-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; margin-top:22px;}
.w3-trust-card{background:var(--surface,#fff); border:1px solid var(--w3-line); border-radius:16px;
  padding:18px;}
.w3-trust-card h3{font-family:var(--font-display); font-weight:700; font-size:.98rem; margin:0 0 8px;}
.w3-trust-card p{margin:0; font-size:.86rem; line-height:1.55; color:var(--text-muted,#6B6157);}

/* reveal system */
html.w3-armed [data-w3-reveal]{opacity:0; transform:translateY(18px);
  transition:opacity .7s ease, transform .7s ease;}
html.w3-armed [data-w3-reveal].w3-in{opacity:1; transform:none;}
@media (prefers-reduced-motion:reduce){
  html.w3-armed [data-w3-reveal]{opacity:1; transform:none; transition:none;}
  .w3-trajectory{stroke-dashoffset:0 !important; transition:none !important;}
  .w3-traj-dot{opacity:1 !important;}
  .w3-slide{transform:none !important; opacity:1 !important; transition:none !important;}
}
`;
