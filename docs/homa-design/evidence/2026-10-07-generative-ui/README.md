# Generative UI comparison

Owner: #1158, PR #1215. Local development evidence, October 7, 2026.

## Scope

The founder approved two experiments after the generative UI research: a composed daily plan and an original generated interactive learning activity. `/app2-lab` is a separate development-only route, with authenticated generation through the existing model gateway. It uses App 2's explicitly requested white, minimal visual direction. No additional UI framework was installed.

Both page and generation endpoint reject production use. The endpoint checks origin and authenticated user before model invocation. It reads no family records and makes no Planner, Binder, or progress writes. Saved drafts are account-namespaced browser storage, not synced materials.

## Observed comparison

| Journey | Composed plan | Generated code activity |
| --- | --- | --- |
| Real model generation | Counting with household objects | Interactive fraction shading |
| First preview | 7.9 seconds | 25.5 seconds on successful retry |
| Ready to interact | 33.7 seconds | 61.3 seconds on successful retry |
| Local interactions | Adjusted 30 to 20 minutes, swapped activity, checked completion | Shaded two of three pieces, checked correct answer, reset |
| Save and reopen | Duration, swap and checkbox survived full reload | Pieces and correct-answer feedback survived same-version reopen and full reload |
| Failure | Previous result remains available | First attempt hit a gateway connection timeout; retry succeeded |

These are single observations, not a benchmark or representative reliability estimate. The initial plan repeated its fixed duration in generated prose. The generation instructions now reserve timing display for the deterministic host controls; existing saved drafts preserve their original text.

## Boundaries and review

Plan allocations use exact deterministic arithmetic. Generated code runs only after complete schema validation, in an opaque-origin iframe with scripts enabled but no same-origin, popup, form, or top-navigation permission. A host-owned CSP blocks fetch and resource loads. The iframe can still navigate itself; it is not a production isolation design and accepts synthetic examples only. Arbitrary code may be incorrect or expensive to run. No learner ability or mastery is inferred from activity output.

The state bridge accepts messages only from the current frame and channel, validates a bounded flat state record, and ignores initialization writes until restoration. An independent reviewer identified this startup race and stale generation-status messaging; both were fixed and reviewed again. Generated content's accessibility and mathematical correctness still require review per activity.

## Product implication

Use stable composed controls for repeatable family planning, and investigate generated activities as separate focused experiences. Keep App 2 navigation deterministic. A production capability needs fleet-skill ownership of the procedure, durable versioned artifacts, authenticated narrow actions, stronger execution isolation, and behavioral evaluation. These prototypes do not implement that production capability.

## Revision and interruption

A real activity revision changed the challenge from two thirds to one half in 39.9 seconds (first preview 6.3 seconds). Tested incorrect zero-of-two feedback and correct one-of-two feedback. Saved the new version separately. Stopping a subsequent generation preserved the revised activity, selected halves, shading, and feedback.

## Validation

- Six contract tests pass, including exact duration totals, schema rejection, save roundtrip, bridge initialization race, message source check, and script-safe saved state.
- Scoped ESLint and web TypeScript checks pass.
- Independent UX/accessibility/source review confirmed both identified blockers fixed and the development/authentication boundary.
- Browser verification used real model output, synthetic prompts, and a mobile viewport. It is not a review of all possible generated activities.

The composed plan revision used only socks and shorter instructions. It completed in 27.1 seconds (first preview 17.3 seconds), with no fixed timing in its title or prose. The revised 20-minute allocations totaled 20. The lab explicitly overrides inherited serif headings so App 2 keeps its requested sans-serif appearance.

Screenshots: [activity](activity-mobile.png), [plan](plan-mobile.png).

Direct local endpoint probes returned 403 without an Origin header and 401 with the correct Origin but no signed-in session. No model invocation was made by either probe.
