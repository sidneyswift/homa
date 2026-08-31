# Motion tooling research: native iOS / React Native equivalents

**Update, same day, after this workflow launched:** while this ran in the
background, Sidney found (by browsing skill marketplaces directly rather
than searching) two things this automated pass's search queries missed
entirely: `expo-animation` (officially co-created by Emil Kowalski and the
Expo core team, 2.5K stars, installed from `github.com/expo/skills`) and
its companion audit skills `improve-animations`/`find-animation-opportunities`
(same author), plus `entrance-animations` and `mobile-touch` from a
144-skill Disney-principles marketplace (`dylantarre/animation-principles`)
that gives concrete numeric benchmarks (touch response &lt;100ms, view
transitions 250-350ms, haptic-to-action mapping tables). All five are now
installed in this repo's `.agents/skills/`. This is strictly better than
the `callstackincubator`/`terminalskills` Reanimated skills this workflow
surfaced below (see the correction in "Recommendation," which supersedes
that part of this doc): it's the actual respected practitioner's own
construction skill for Homa's exact stack, not a third party's
best-practices writeup. The rest of this document's findings still hold:
nothing found, including these, actually *scores or audits* animation
*quality/feel* against a Reanimated view tree the way MotionLint does
against a DOM; expo-animation is a construction discipline (a rigorous
decision sequence + exact value tables), not an automated grader. That
distinction is why `motion-and-animation-gap.md`'s verification standard
(a device-verified screen recording judged against named references, not
a tool score) still stands even with these installed.

No real native equivalent to motion.dev's AI Kit exists. This pass ran down
14 candidates across every plausible angle (native-Apple MCP/docs tools,
macOS curve-editor GUIs, RN/Expo simulator-driving MCP servers, agent-skill
packages for SwiftUI and Reanimated, a Flutter-specific motion-snippet
server, and a JS-thread jank counter), and not one of them scores, audits,
or benchmarks "does this animation feel AAA" against a Reanimated view tree
the way motion.dev's AI Kit does against a DOM. What exists instead splits
cleanly into three useful-but-partial buckets: generic simulator-driving/QA
plumbing (screenshot, tap, record; several genuinely worth having, none of
them judge motion), Reanimated-correctness skills (worklets, springs vs.
timing, jank-avoidance; solve "does it run at 60fps," never "does it look
premium"), and native-only reference material (Apple's own docs/WWDC
transcripts, HIG-vetted SwiftUI animation patterns, Flutter recipes) that is
real and citable but requires manual translation into Reanimated and, in
two cases, is written for the wrong platform entirely. The honest
conclusion is the one `motion-and-animation-gap.md` already reached from
the other direction: there is no shortcut tool, so the plan there (mine
existing video assets, capture Homa's own screens live, anchor everything
to Sidney's named AAA references) stands confirmed, not superseded.

## Tools (things you could install or run)

| Name | Platform fit | What it does | Verdict | Link |
|---|---|---|---|---|
| MotionLint | Web/DOM only (Playwright+CDP; hooks Motion One, GSAP, anime.js, CSS/@keyframes) | Audits/scores rendered web animations 0-100 against Emil Kowalski's published timing standards; also does vision-LLM screenshot review and a live curve-tuning UI | Cannot attach to a Reanimated/RN view tree at all: no DOM, no CDP surface. Confirms the original gap finding rather than closing it. Only residual value is the written standard it audits against (see Articles below), not the tool itself. | [github.com/bobaba99/motionlint](https://github.com/bobaba99/motionlint) |
| Apple Docs MCP | Native Apple only (Swift/SwiftUI/UIKit/etc.) | Live MCP wrapper around Apple's doc API + 1,260+ WWDC transcripts; 15 tools for doc/symbol/compatibility lookup | No RN/Reanimated awareness, no easing/spring tooling, no quality scoring, no visual gallery. Worth keeping in your back pocket only for decoding a native API's exact parameters (e.g. reverse-engineering `UISpringTimingParameters` to hand-translate into `withSpring`), not for calibrating "AAA feel." | [github.com/kimsungwhee/apple-docs-mcp](https://github.com/kimsungwhee/apple-docs-mcp) |
| swift-mcp | Native SwiftUI/macOS only | 5 static Markdown resources served as canned senior-iOS-engineer prose; one "Animation and Motion" section with 4 generic bullets | Shallow, single-author, no code, no references. Its animation guidance is fully covered (and more completely) by Apple's own HIG motion page. Skip. | [github.com/onmyway133/swift-mcp](https://github.com/onmyway133/swift-mcp) |
| Couverture | macOS GUI, exports to SwiftUI/UIKit/CoreAnimation/CSS, **no RN/Reanimated export** | Visual easing + spring (mass/stiffness/damping) curve editor with a live preview | Sunsetted, possibly delisted, closed-source, no repo. No export path to Reanimated. The only transferable idea (spring = mass/stiffness/damping) is already built into `withSpring`'s own API; nothing to gain by chasing a dead app. | [appahead.studio/apps/couverture](https://appahead.studio/apps/couverture/) |
| SwiftAnimPlayground | macOS-only SwiftUI desktop app (not iOS, not RN) | GUI for tuning/comparing SwiftUI animation curves + an 11-pattern examples gallery (toggle, FAB, card stack, hero transition, toast, pull-to-refresh, etc.) | Everything genuinely extractable (a pattern-name checklist, cubic-bezier numbers) is freely available at easings.net/cubic-bezier.com without building the Xcode project. No CLI/API/MCP surface. Skip. | [github.com/josejacas/SwiftAnimPlayground](https://github.com/josejacas/SwiftAnimPlayground) |
| iOS Simulator MCP (joshuayoes) | Framework-agnostic (IDB + simctl; works on RN, native, Flutter, web views alike) | 16 tools: tap/swipe/type, accessibility-tree inspection, screenshot, video recording, app install/launch | Real, active (2.15k stars), but zero animation-specific instrumentation: pure QA capture plumbing. This Claude Code environment already ships an equivalent (`mcp__Claude_Code_iOS_Simulator__control`), so installing this one specifically would be redundant here. | [github.com/joshuayoes/ios-simulator-mcp](https://github.com/joshuayoes/ios-simulator-mcp) |
| Agent Simulator | RN/Expo in iOS Simulator on macOS | Streams the Simulator into a browser (MJPEG ~3-10fps), 15 MCP tools for tap/swipe/inspect; Metro plugin maps any rendered RN component back to its source file/line | No animation auditing, no motion reference. AGPL-3.0, requires Rust+Node+Xcode+`axe` CLI. Useful only as a QA/interaction-automation layer alongside existing motion skills, never as calibration input. | [github.com/jasonkneen/agent-simulator](https://github.com/jasonkneen/agent-simulator) |
| ios-preview-mcp | Native SwiftUI only (requires an existing Xcode project + test target) | Agent writes a SwiftUI view, tool runs `xcodebuild test` via `swift-snapshot-testing`, returns one static PNG | Static-screenshot-only (no motion capture at all), Swift-specific, nothing portable to RN. The team's already-installed `expo-animation`/`find-animation-opportunities`/`improve-animations` skills cover the same "write, render, screenshot, iterate" pattern natively. Skip. | [github.com/noahzs/ios-preview-mcp](https://github.com/noahzs/ios-preview-mcp) |
| expo-agent-bridge | RN/Expo (SDK 50+), iOS Simulator only, macOS only, Android not implemented | 11 tools: screenshot, tap (via AppleScript+CGEvent workaround), nav/store/network/log state, Expo Router tree | Zero animation-specific instrumentation of any kind: static screen-state only. Confirms the gap rather than filling it. | [hooton.codes/blog/building-expo-agent-bridge](https://hooton.codes/blog/building-expo-agent-bridge/) / [github.com/jeffdhooton/expo-agent-bridge](https://github.com/jeffdhooton/expo-agent-bridge) |
| react-native-devtools-mcp | RN/Expo via Metro CDP, iOS Simulator + Android emulator | 16 tools: screenshot, view hierarchy, device/JS logs, tap/type/scroll, start/stop recording | Extremely early-stage (3 stars, single author, two commits in 20 minutes, no activity since March 2026). Zero animation/jank/timing content. At most a screenshot/log-capture helper bolted onto an existing review loop. | [github.com/pnarayanaswamy/react-native-devtools-mcp](https://github.com/pnarayanaswamy/react-native-devtools-mcp) |
| react-native-mcp-kit | RN (iOS + Android) | Component tree, nav state, network logs, mocked responses, real OS-level tap/gesture driving | 1-star solo project, zero animation/motion content whatsoever: pure functional-QA bridge. Not relevant to the motion question at all. | [github.com/pranko17/react-native-mcp-kit](https://github.com/pranko17/react-native-mcp-kit) |
| react-native-jank-tracker | RN only, and only the **JS thread** (its own README says 4x, in bold, that it does NOT measure native FPS/TTI/rendering pipeline) | `requestAnimationFrame`-loop jank flagging (>17ms deltas) + a `measureTTI` helper | Abandoned (2 stars, dormant 16 months). Reanimated animations run as UI-thread worklets specifically to avoid the JS thread, so this tool is blind to the exact thing it would need to measure to validate "does our Reanimated paywall motion feel AAA." For real frame-drop measurement use Xcode Instruments' Core Animation/Hitches template or the Android GPU profiler/Perfetto instead. | [github.com/zereight/react-native-jank-tracker](https://github.com/zereight/react-native-jank-tracker) |
| Flutter Motion Kit (MCP) | Flutter/Dart only | Remote MCP server (`search_flutter_animation`, `get_animation`, `list_pitfalls`, `list_categories`) serving 12 annotated Flutter animation recipes + a live interactive playground/gallery | Solo project (2 contributors, one literally named "Claude"), unclaimed on Glama, ~63 connected developers. Dart code has zero portability to Reanimated. Its only value is a five-minute skim of the 12 pattern *names* (hero transition, staggered list, spring drag-release, shimmer skeleton, parallax header) as an inspiration checklist, then reimplement natively. | [github.com/xianjianlf2/flutter-motion-kit](https://github.com/xianjianlf2/flutter-motion-kit) (gallery: [motion.markxian.cn/gallery](https://motion.markxian.cn/gallery)) |

## Reference repos and code sources (things you could study or adapt code from)

This category came back **thin**: almost everything found is either a
debugging harness with no animation content, or animation content locked
to the wrong platform (SwiftUI/Flutter, not Reanimated). The two genuinely
relevant code sources:

| Name | Link | What it covers | Platform |
|---|---|---|---|
| callstackincubator/agent-skills - `react-native-best-practices` (`js-animations-reanimated.md`) | part of the [twostraws/swiftui-agent-skill](https://github.com/twostraws/swiftui-agent-skill) writeup's cluster survey | Worklets, `useSharedValue`/`useAnimatedStyle`, spring vs. timing, gesture-linked animations (swipe-to-delete, card stacks, bottom sheets), layout animations, scroll-driven parallax, Reanimated v3→v4 migration (`runOnUI`→`scheduleOnUI`) | React Native + Reanimated (the team's actual stack) |
| terminalskills.io / estevg's `react-native-reanimated` skill | same cluster survey | Same territory as above; claims a 39%→88% eval improvement, but the methodology is thin (2 unspecified scenarios, undisclosed rubric) | React Native + Reanimated |
| jamesrochabrun/skills - `swiftui-animation` | same cluster survey | Springs, keyframes, orchestrated multi-phase sequences, `matchedGeometryEffect` hero transitions, Metal shaders, HIG-vetted motion principles; the most animation-specialized entry found in any cluster | Native SwiftUI only (requires manual re-interpretation for RN) |
| Flutter Motion Kit's 12 recipes | [github.com/xianjianlf2/flutter-motion-kit](https://github.com/xianjianlf2/flutter-motion-kit) | Hero shared-element transition, staggered list entrance, spring drag & release, 3D card flip, shimmer skeleton, collapsing parallax header, custom-painter progress ring | Flutter/Dart only; pattern names transfer as a checklist, code does not |

Confirmed **explicitly absent**: no Reanimated-specific example gallery
with an aesthetic/quality angle (everything found on the RN/Reanimated side
is correctness-and-performance guidance: "don't jank," never "feel
premium"). No curated repo of "real App Store apps' onboarding/paywall
motion, reverse-engineered into Reanimated code" was located anywhere in
this pass.

## Articles, talks, and design principles (things to read, not install)

This category is genuinely thin in the research pass itself; most of the
14 items are tools, not essays, but two real, citable principle sources
surfaced as pointers, both worth reading even though neither is
RN-specific:

- **Emil Kowalski's motion-design writing** (the standard MotionLint's
  scoring is built on: duration, easing-curve shape, and stagger-interval
  guidance for what makes an animation feel intentional rather than
  arbitrary). Referenced via [github.com/bobaba99/motionlint](https://github.com/bobaba99/motionlint); MotionLint itself is web-only and unusable, but the underlying written principles are platform-agnostic enough to apply by hand when tuning a Reanimated spring or timing curve.
- **Apple's own WWDC animation talks** (spring physics, interruptible/
  interactive animation, motion and accessibility), with full transcripts
  retrievable via Apple Docs MCP's `search_wwdc_videos`/
  `get_wwdc_video_details` tools. Genuinely useful prose for what Apple's
  own engineers consider tasteful native motion, but every code sample is
  Swift/SwiftUI/UIKit and has to be reimplemented in Reanimated by hand.
  Source: [github.com/kimsungwhee/apple-docs-mcp](https://github.com/kimsungwhee/apple-docs-mcp).

No standalone design-principles article (independent of a tool's own
scoring rubric) was found and deep-read in this pass. Do not treat this
list as exhaustive: it is what surfaced as a side-effect of investigating
the 14 tools above, not the product of a dedicated literature search.

## Frame/timing analysis techniques (workflows, not tools)

**Nothing new was found in this pass.** No frame-diffing, video-to-timing-
curve extraction, or reverse-engineering workflow (tool or article) turned
up anywhere in these 14 items; the closest things (MotionLint's CDP
frame-burst capture, Agent Simulator's MJPEG stream, the various
screenshot/record MCP servers) all capture frames of *your own* running
app for a human to eyeball, none of them measure or extract timing/easing
from an existing video the way `motion-and-animation-gap.md`'s own
`ffmpeg`-frame-extraction technique (already proven on the Duolingo video)
does. That existing technique (sample frames at an interval, look at
state changes by eye) remains the only concrete frame/timing workflow on
the table from either research pass.

## Recommendation for Homa's spec

**Correction to this section, same day:** at the time this workflow ran,
recommendation (1) below was "install the `callstackincubator`/
`terminalskills` Reanimated-best-practices skill." That recommendation is
superseded: Sidney found and installed the actual best option for that
slot, `expo-animation` (Emil Kowalski + the official Expo team, see the
update note at the top of this document), which is more authoritative
(the real named practitioner, not a third party summarizing him) and
exactly stack-matched. Do not install the callstackincubator/terminalskills
skills on top of it; they'd be redundant at best.

The core conclusion is confirmed, not superseded by that find: nothing
located in either this pass or the manual one *scores or audits*
Reanimated motion quality/feel the way motion.dev's AI Kit scores DOM
animation against a written standard; `expo-animation` is a construction
discipline (decision sequence + exact value tables), not an automated
grader, and `improve-animations`/`find-animation-opportunities` audit for
correctness and missed opportunities, not for "does this feel premium."
So the three-track plan in `motion-and-animation-gap.md` (mine existing
Appllama video assets with the proven `ffmpeg`-frame-extraction technique,
capture Homa's own onboarding screens live via the iOS Simulator, and
anchor "AAA-feel" to Sidney's named reference apps/moments rather than the
adjective "delightful") is still the right and only path for the judgment
call itself. One narrow addition from this pass still worth folding in:
when a native animation needs reverse-engineering, use Apple Docs MCP to
pull the authoritative parameter semantics (e.g. spring damping/response)
rather than guessing, then hand-translate into `withSpring`/`withTiming`.
Neither this nor the newly-installed skills change the verification
standard already set in `motion-and-animation-gap.md`: a device-verified,
screen-recorded walkthrough held up against named references, not a
tool-generated score.
