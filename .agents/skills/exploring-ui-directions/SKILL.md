---
name: exploring-ui-directions
description: Use when a founder or product owner is uncertain about a new UI surface's information architecture, navigation placement, global-versus-profile scope, density, metaphor, or interaction model and asks to explore broadly, compare directions, boil the ocean, or see demos before implementation.
---

# Exploring UI Directions

## Core principle

Turn structural uncertainty into one grounded comparison lab. Hold the content and core task constant while varying the product structure. Treat the first round as learning, not production implementation.

## Use the right-sized exercise

Run the full exercise when two or more build-changing dimensions are unresolved, such as scope, placement, hierarchy, density, metaphor, or interaction.

Do not run it for a quick targeted edit whose structure is already known, such as changing one button label, spacing a known component, or adding a field to an established form. Follow the project's existing pattern for those requests.

## Workflow

### 1. Ground every concept in the project

Before designing:

1. Read the closest project instructions, overview, product rules, and active plans.
2. Inspect the current UI or screenshots, app shell, navigation, relevant routes, data shapes, design and copy system, and reusable components.
3. Identify the core user task the concepts must support.
4. Separate findings into:
   - **Known:** established by code, policy, or direct evidence.
   - **Unresolved:** genuine choices with more than one defensible answer.
   - **Build-changing:** unresolved choices that alter routes, data ownership, permissions, or component architecture.
5. Record actual likely integration paths. Never invent a disconnected surface.

Use realistic synthetic records derived from the product's schema. Label them as fake. Never copy real user, customer, production, support, or analytics data into the artifact.

### 2. Make structure the variable

- Use one shared fake dataset and one shared core task in every direction.
- Default to exactly four strong directions. Use fewer only when another option would be a cosmetic duplicate, and state why. Never exceed four in the first round.
- Make each direction a distinct, defensible product bet. Change information architecture, density, metaphor, navigation, scope, or interaction, not merely color and typography.
- Test unresolved placement or scope with useful variant toggles rather than explaining it only in prose.
- Recommend a foundation only when project evidence supports it.

### 3. Build one disposable comparison lab

Do not modify the real app for first-round exploration. Produce one self-contained `.html` file with inline HTML, CSS, and JavaScript. Do not create companion stylesheets, scripts, data files, readmes, or production routes.

Place the file in the project's established prototype or planning area. If none exists, choose a clearly disposable documentation location outside production code.

**REQUIRED:** Read [references/artifact-contract.md](references/artifact-contract.md) before building. Follow its content order, direction anatomy, interaction, feedback, and wiring requirements.

### 4. Verify behavior and presentation

Open the artifact in a real browser and test it, not just its source.

**REQUIRED:** After the artifact exists, read and complete [references/verification-checklist.md](references/verification-checklist.md). Fix accepted high-impact issues before handoff.

### 5. Handoff, then converge

Report the artifact path, the project evidence that shaped it, verification results, screenshots when available, and any honest limitation. Ask the user to compare the directions and paste the assembled reply.

When feedback arrives:

1. Synthesize the winning direction, stolen details, answers, and notes into one refined direction.
2. Resolve contradictions explicitly instead of stacking every selected idea.
3. Document the resulting decisions in the project's normal decision or planning location.
4. Retire the competing shells. Never carry all options into production.
5. Only then offer production implementation planning.

## Hard defaults

| Decision | Default |
|---|---|
| First-round concepts | Four strong directions |
| Output | One disposable HTML file |
| Comparison control | Same task and fake dataset |
| Direction critique | 2 to 3 steals and at least 1 skip |
| Build-changing questions | Five maximum |
| Feedback | Direct chips, freeform notes, copyable reply |
| Next round | One refined direction |

## Example

User: "We need a place for project assets, but I do not know whether it belongs globally or inside each workspace. It could be folders, a board, a timeline, or something more physical. Think broadly and make demos I can compare."

Apply this skill by inspecting that product's real shell, navigation, asset model, and design rules, then creating one disposable comparison lab. Do not reuse another product's styling, labels, or content.

## Common mistakes

- Starting from visual metaphors before reading the project.
- Producing six shallow options instead of four defensible ones.
- Splitting the lab into multiple files or wiring it into production.
- Changing both content and structure, which makes comparison unreliable.
- Using generic "clean" or "modern" steals instead of concrete transferable details.
- Hiding trade-offs, adding rating scales, or building a burdensome hybrid configurator.
- Asking questions that do not change the build, or asking more than five.
- Treating the exploration artifact as the implementation specification.
