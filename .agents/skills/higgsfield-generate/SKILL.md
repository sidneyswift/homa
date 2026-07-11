---
name: higgsfield-generate
description: Generate or edit Homa-authorized image, video, audio, or 3D assets with the installed Higgsfield CLI. Use when the user explicitly authorizes generation or directly invokes a Homa workflow whose current contract includes an authorized generation step. Do not use for websites, games, identity training, product photoshoots, or marketplace cards.
---

# Higgsfield generation

This is Homa's safety wrapper around an already-installed CLI. The CLI and its
model catalog can change, so discover the current interface at runtime. Never
install or upgrade Higgsfield from this skill.

## Authorization and Homa laws

1. Confirm that the current user explicitly asked for this generation, or
   directly invoked a workflow whose current contract names this generation
   step. Drafting, research, or a prior approval does not authorize a new paid
   generation.
2. Before creating visual work, read `docs/homa-design/SKILL.md` and
   `docs/homa-design/readme.md`. Before writing on-image or marketing copy,
   also read `.agents/skills/homa-copy-writer/SKILL.md`,
   `marketing/AGENTS.md`, and `marketing/voice/house-style.md`.
3. Never read or upload anything from `homa-macmini/`, `homa-research/`, or
   `homa-template/`. Never upload family data, identifiable media of minors,
   secrets, school records, addresses, or an unconsented likeness. Use only
   source media that was supplied or approved for this exact task.
4. Do not invoke Higgsfield's website, game, Soul ID, product-photoshoot, or
   marketplace-card command families. Homa has no approved workflow for them.

## Discover the live interface

1. Run `command -v higgsfield`. If the binary is missing, stop and report the
   missing dependency. Do not run a remote installer or an unpinned global
   install.
2. Run `higgsfield --help`, `higgsfield generate --help`, and the help for
   each intended subcommand. Use only flags shown by the installed CLI.
3. Run `higgsfield model list --help`, then list current models. Inspect the
   selected model with the installed CLI before composing the command. Do not
   rely on a remembered model name, parameter, price, or capability.
4. Run `higgsfield account status`. If authentication is missing or expired,
   stop and ask the user to run `higgsfield auth login` in their terminal.
   Never expose account identifiers, workspace identifiers, balances, or
   credentials.

## Submit once

1. State the artifact, source media, destination, and selected live model. If
   the user's explicit instruction did not already authorize that exact
   generation, ask before any upload or create command.
2. Use the installed CLI's cost command when it is available and the estimate
   would affect the authorization. Report only the sanitized estimate.
3. Validate the selected model's live parameter schema, then submit one create
   command. Use a wait option only when current help confirms it.
4. Never retry a generation, upload, or other mutation automatically. On an
   error, timeout, or ambiguous response, use only documented read-only list or
   get commands to inspect the original job. If its outcome is still unclear,
   stop with the known state and request fresh authorization before another
   mutation.

## Handoff

Return the asset or stable asset link, the model's display name, and a short
status. Do not paste raw JSON, internal IDs, account details, balances, or local
absolute paths. Do not commit signed provider URLs. If an expiring URL is the
only delivery path, share it only with the requesting user. Generation never
means approval, publication, or permission to reuse a person's likeness.

Completion means one authorized submission has a verified result or an exact
stop reason, with no duplicate mutation.
