---
name: postiz
description: Read aggregate Postiz analytics or distribute Homa's already-approved social formats through the installed Postiz CLI. Use for read-only analytics, or when marketing-distributor delegates a founder-authorized bundle and channel mutation. Never use to draft, approve, retry, or auto-publish content.
---

# Postiz

This is Homa's safety wrapper around an already-installed CLI. The CLI and
channel settings can change, so discover their current interface at runtime.
Never install or upgrade Postiz from this skill.

## Authority and content laws

1. Read `marketing/AGENTS.md` before any Postiz work. For content or copy
   review, also read `.agents/skills/homa-copy-writer/SKILL.md` and
   `marketing/voice/house-style.md`. Do not patch copy during distribution.
   Return it to the draft gates when a problem appears.
2. Read-only integration discovery and aggregate analytics do not authorize a
   mutation. Uploading media, creating a post, changing status, connecting a
   release, and deleting a post are mutations.
3. Publication requires all three facts in the current request: an explicit
   founder instruction, the named format marked `approved` in the bundle's
   `meta.yml`, and the exact requested channel or schedule. Only
   `marketing-distributor` may delegate that publication.
4. Never publish family data or individual parent or child information. Use
   aggregate engagement data only. Never read from `homa-macmini/`,
   `homa-research/`, or `homa-template/`. Never expose credentials or local
   authentication files.

## Discover the live interface

1. Run `command -v postiz`. If the binary is missing, stop and report the
   missing dependency. Do not run a remote installer or an unpinned global
   install.
2. Run `postiz --help` and the help for every intended subcommand. Use only
   flags and settings shown by the installed CLI.
3. Run `postiz auth:status`. If authentication is absent, stop and ask the
   user to run `postiz auth:login` in their terminal. Do not attempt login or
   accept credentials in chat.
4. Discover live integrations and inspect the selected integration's current
   settings before preparing a request. Keep raw integration IDs and settings
   output out of reports.

## Read-only analytics

Use only analytics commands confirmed by current help. Report aggregate channel
or post metrics, their exact date window, and missing-data limitations. A
missing release link is a blocker, not permission to run a connecting command.
Any connecting mutation needs its own explicit instruction.

## Authorized distribution

1. Recheck the explicit instruction, `meta.yml` approval, channel, content,
   media, destination, and schedule immediately before each mutation.
2. Upload each local media file through the installed CLI when current help
   requires a provider URL. Use only the returned provider path in the
   post-creation request. Upload nothing outside the authorized bundle.
3. Build one channel request from current command help and live integration
   settings. Submit one create command for that approved format and channel.
4. Never retry an upload, create, status, connect, or delete mutation
   automatically. After an error, timeout, or ambiguous response, use
   documented read-only listing to inspect the original operation. If the
   result remains uncertain, stop that channel and report the uncertainty.
   Another mutation requires a fresh explicit instruction.
5. Deleting, changing status, or connecting a release always requires a
   separate explicit instruction. A previous publication instruction does not
   authorize cleanup or repair.

## Handoff

Report the channel, canonical public URL when verified, schedule or status, and
exact stop reason for anything unconfirmed. Do not paste raw JSON, credentials,
internal integration IDs, internal post IDs, or local absolute paths. Do not
describe an ambiguous result as published. The delegating distributor owns the
bundle's `distribution.md` and final lifecycle move.

Completion means every delegated channel has one confirmed outcome or one exact
blocker, with no automatic retry.
