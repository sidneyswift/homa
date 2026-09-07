# Contextual progress capture and next-step advice

Source: [September 5 meeting review](2026-09-05-cofounder-feedback-review.md), F13-F14. Tracking: #1099 and #1100.

## What changes

Capture now supplies the actual current parent message, authenticated child focus and immediately preceding visible assistant question to the claim extractor. The model interprets those inputs against the full age-eligible catalog; deterministic validation still owns child/catalog identity, the verbatim current-message quote, age plausibility and durable writes. Earlier assistant text is context, never the saved evidence quote. Family-local dates determine the age boundary. Capability clarification belongs to the fleet progress-capture procedure, with a single useful question and an explicit stop after decline.

Next-step advice reads the selected child's complete available subject inventory with dates and provenance, then uses the existing exact verifier. An eligible target outside the internal task's eight-item shortlist can be verified in ordinary chat. Internal tasks retain their bounded target set. The fleet procedure distinguishes an unaccepted offer, a clarification, a supported stop and a verified activity. It preserves the parent-facing evidence date and direct/inferred distinction.

## Verification and limits

The original production examples were replayed with actual model extraction. Context supplied the missing match in the three historical contextual cases; catalog expansion separately repaired the synthetic coverage cases. Twenty interpretation cases passed. The integrated deterministic suite passed 579 ChildProgress tests and the actual PostgreSQL context/age/privacy contract passed 32 groups. The focused capture harness additionally passed seven actual PostgreSQL groups and nine environment refusals, including caught provider failure, invented quote, missing provenance and revoked membership. These checks do not fabricate a successful saved receipt.

Full-fleet routing and actual save behavior are distinct. The original generic Eve eval fixture uses a materials-lab channel without canonical member/message provenance, so its attempted progress writes failed before capture. The replacement focused behavior harness uses actual local canonical messages and the production capture/service pipeline; its new model run remains unexecuted. The attempted concurrent run refused before any model evaluation and removed its local cluster.

The latest next-step model run passed all five evidence cases: fresh motor, music, stale cutting, unknown provenance and corrected cutting. Its boundary group passed three of seven gates. Some turns still skipped the skill or canonical read, and an incomplete inventory was wrongly described as complete. Root also rejected an all-easy response that suggested unverified extensions even though its judge passed it. These remain open #1100 behavior gaps, not certified acceptance. Judge inputs now include the exact evidence given to generation; the grading rubric was not weakened to excuse missing evidence.

On September 6 Sidney directed: "ok i feel like you tested enough. ship". Extra model and hosted test rounds stopped. This release ships the independently reviewed capture, verification and procedure improvements through required CI and deployment checks. It does not claim all conversational boundary cases are solved, backfill historical progress, or extend native scope. Production deployment and remaining follow-up status live on the linked issues.
