# Local 3D Homa character study

Tracked with [#1158](https://github.com/sidneyswift/homa/issues/1158). This is an interactive `/app2` design study, not a production character rollout.

## Reference and scope

The founder supplied September 12 screenshots of an orange house character and approved building a live prototype. The 04:26:37 reference establishes the solid, thick, rounded body and separate eyes. Liquid emergence, dripping edges, glow, spins, and larger actions remain unexplored. The requested 3D depth and idle movement are explicit local exceptions to the ordinary static brand-mark treatment.

The body uses the canonical `HOUSE_PATH` exported by the real Logo component. Eye placement, sizes, and pupil offsets also come from that component. A beveled extrusion adds depth; separate flattened spheres form the eyes and pupils. The shared visual coral supplies the material color. Lighting changes its rendered appearance, so this is an approximation for review rather than an exact reconstruction of the reference video.

## Implementation

- `apps/web/app/app2/homa-character.tsx` owns the procedural Three.js model, React Three Fiber canvas, lighting, and motion.
- The canvas loads through a client-only dynamic import. The real static Logo is the loading and failure fallback.
- Gentle bobbing, small turns, pupil movement, and brief blinks run locally. None imply a listening, thinking, or speaking state.
- The existing Dev mode card contains a pause/resume control. Reduced Motion, a hidden document, or an offscreen character stops continuous rendering. Forced Colors uses the static mark.
- Pixel density is capped at 1.5. There are no shadow maps, environment downloads, model downloads, physics engines, or network animation calls. The grounding shadow is CSS.
- The Text/Voice island and independent microphone/sound preview settings retain their existing behavior.

## Verification and limits

Focused ESLint and web TypeScript checks passed. Browser review confirmed a rendered canvas, working pause/resume, and no horizontal overflow at a 320 CSS-pixel viewport in both Text and Voice layouts. The static fallback was observed during development hot reload; a fresh load restored the canvas. Desktop appearance evidence is saved as `homa-3d-desktop.png` in the current Codex visualization folder.

Actual iPhone GPU performance, battery use, operating-system Reduced Motion, Forced Colors, and deliberate WebGL failure injection have not been certified. The lifecycle and accessibility branches are implemented but those device scenarios require later validation. The first visual review should settle body depth, orange material, eye treatment, and the amount of idle movement before adding behavioral states or liquid effects.
