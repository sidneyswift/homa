# Production baseline

Observed at: `2026-07-11T09:07:00-04:00`

This is a sanitized, read-only production snapshot. It records deployment metadata, public HTTP responses, public-content hashes, and migration-name history. It contains no credentials, connection strings, environment values, private user data, or Supabase project reference.

## Method

The audit used read-only deployment inspection, Node.js `fetch` for public HTTP probes, Node.js `crypto` for SHA-256 hashing, Supabase CLI migration history, and a read-only Postgres migration-name query. Representative sanitized commands were:

```sh
vercel inspect <production-alias>
node <public-probe-and-sha256-script>
supabase migration list --db-url <redacted-db-url>
node <sanitized-read-only-migration-name-query>
```

The public script used Node.js `fetch(url, { redirect: "manual" })` and recorded only status plus a same-origin-safe `location` header. It hashed the exact response bytes and matching local public files with `createHash("sha256")`. The migration-name query was `select version::text, name::text from supabase_migrations.schema_migrations order by version`; local names came from sorted `supabase/migrations/*.sql` filenames after removing their timestamp prefix and `.sql` suffix.

`supabase migration list --linked` was attempted first and failed because this checkout has no Supabase link metadata. That failure established no migration state. The successful CLI command used `--db-url` with a redacted URL assembled only in process memory. A separate read-only Postgres query selected only migration versions and names for the name-first comparison. Connection values, secrets, and the project reference were redacted from observations and were not persisted in audit artifacts.

## Deployment

- Deployment: `dpl_6k8Jv6vUPTnu9HNTVyNXgPDrdmst`.
- Target: production.
- State: READY.
- Source commit: `6116cb4770258b6de122c7b6b2dde5f76aa0c5ce`.
- Created: `2026-07-11T06:30:32.968Z`.
- Custom-domain aliases observed: `thankshoma.com` and `www.thankshoma.com`. A targeted recheck at `2026-07-11T11:14:21-04:00` listed five total aliases for the same deployment; three Vercel-managed aliases are intentionally omitted from this public-domain inventory.

The production commit is the audit-start base, not the current branch HEAD. READY proves deployment completion for that commit. It does not prove every feature path or scheduled job succeeded.

## Public HTTP probes

HTTP 200 was observed for:

- `/`
- `/onboarding`
- `/onboarding/sample`
- `/onboarding/method`
- `/blog`
- `/privacy`
- `/terms`
- `/ai.txt`
- `/llms.txt`
- `/llms-full.txt`
- `/sitemap.xml`
- `/robots.txt`

HTTP 308 was observed from `www` to the apex domain. HTTP 308 was also observed from `/conference`, `/waitlist`, and `/map` to `/onboarding`. Anonymous `/app` routes returned HTTP 307 to sign-in.

These probes establish status and redirect behavior only. They do not establish authenticated behavior, data writes, or content correctness beyond the separately recorded public-content observations.

## Public content comparison

- `ai.txt` production SHA-256 is `f36c9b49a36fd30c2570531ceea4524037f0adf13a128b383cb79eeb1806b409`; after reconciliation edits, the working-tree SHA-256 is `d381412ac0d3ae525f8cbb8e6faa8e5eb5f5c272dc8b9e7e60e09fc6b58c856a`.
- `llms.txt` production SHA-256 is `b62f21063464354b36d0075cd357512e632eb1ee0ef21f9244f7f8ea3a870d33`; after reconciliation edits, the working-tree SHA-256 is `dac872d7b41cee74fa420c4d1fedaba739b128a4746f5581f3e1f829f3f53e97`.
- `llms-full.txt` production SHA-256 is `51ac25f90e7bdc9db7ec65a441c60d42186dbe50d95df62e252dbb8cf66138d0`; after reconciliation edits, the working-tree SHA-256 is `ff739ccce27374017a10ac3a98df48855283a8d020fa426bdb45b163adc1344e`.

The production landing and public summaries still include invite-only framing and the disputed state-mapping, child-interaction, and planner-reshuffle claims. The working-tree public summaries differ. A working-tree copy edit is not shipped until a later deployment is READY and the live files are reprobed.

## Cron registration

The deployment configuration registers `/api/map/cron` hourly. Registration does not prove successful invocation or downstream effects. No cron-success claim is verified by this snapshot.

## Migration-name history

Remote comparison observed at: `2026-07-11T10:26:38-04:00`

The name-first comparison observed:

- 58 local migration filenames.
- 53 remote migration history entries.
- 51 shared names.
- 7 local-only names: `create_my_family_rpc`, `family_billing`, `family_sms_invites`, `lead_auth_user`, `open_signup`, `revoke_deny_all_tables`, and `signup_invite_gate`.
- 2 remote-only names: `child_reports_grant_hygiene` and `hours_source_labels`.
- Newest remote entry: `children_full_birthday` at `20260711054159`.

This is a migration-history divergence. It is not proof that a schema behavior is absent or present. Applied-history repair and schema verification are separate tasks, and applied migration history must not be rewritten casually.

### Repository drift after the remote snapshot

The local migration directory was last re-counted at `2026-07-11T12:55:00-04:00` and contained 70 files. Twelve files appeared after the comparison above, carrying ten distinct names: `conversation_continuity`, `conversation_continuity_hardening`, `conversation_continuity_indexes`, `conversation_delivery_uncertain`, `conversation_episode_backfill`, `conversation_inbound_receipts`, `conversation_task_uncertain`, `conversation_task_partial_uncertain`, `family_sms_invite_dual_confirmation`, and `family_sms_invite_submission_hardening`. `conversation_inbound_receipts` appears under three timestamped filenames.

The remote history was not re-queried during this targeted drift check. Therefore the 58-local, 53-remote, 51-shared, 7-local-only, and 2-remote-only values above are a time-bounded historical observation, not a current parity claim. A fresh remote query is required before any current migration comparison is terminal.

## Public marketing content probes

Observed on 2026-07-11 with redirect-following public HTTP requests:

- `https://thankshoma.com/blog` returned HTTP 200. No published article entry was found in the returned page.
- `https://thankshoma.com/blog/how-to-track-homeschool-hours` returned HTTP 404. The July 5 hours bundle is not a live article.
- `https://thankshoma.com/blog/rss.xml` returned HTTP 200 with no feed entry. Route presence does not establish an approved or published article.

These public probes do not inspect draft files, waitlist rows, consent, social accounts, email delivery, or authenticated product behavior.

## Limitations

- No authenticated user flow was exercised.
- No private family row, billing row, waitlist row, or external-service account was inspected.
- No successful cron execution was established.
- The failed `--linked` migration command is a checkout-link limitation, not migration evidence.
- READY state does not prove the paywall, planner, mobile, email, SMS, Stripe, Resend, Telnyx, or vendor claims in human-operational documentation.
- The state-academic mapping, child-interaction absolute, and planner-reshuffle claims require dedicated implementation and production evidence.
