---
name: email-triage
description: Hourly email triage for the parent — scan her inbox for important unanswered emails, dedupe against prior pings, post a Slack summary asking if she wants Homa to draft a reply. Use when running the Email Triage Hourly cron, or when the parent asks Homa to check her email for anything she missed.
---

# Email Triage

the parent gets a lot of email. Most of it doesn't need her attention. The ones that do often sit unanswered because she's busy with the child. This skill is Homa watching the inbox so the parent doesn't have to — surfacing only what genuinely needs her, never spamming.

## The loop

```
Every hour (7am–10pm ET):
  1. Read state file
  2. Search Gmail for unread + recent threads
  3. Filter to "important & unanswered" (criteria below)
  4. Subtract already-pinged and already-skipped message IDs
  5. For each remaining: post a Slack triage card to #homa-homeschool
  6. Update state file
```

## State file

`~/.openclaw/workspace/email-triage-state.json`

```json
{
  "pinged_message_ids": ["abc123", "def456"],
  "skipped_message_ids": ["ghi789"],
  "drafted_reply_for": ["abc123"],
  "last_run": "2026-05-03T20:47:00Z"
}
```

- `pinged_message_ids`: the parent has been told about this email; don't re-ping
- `skipped_message_ids`: the parent reacted 👎 or 🤷 — never ping about this one again
- `drafted_reply_for`: Homa drafted a reply already; don't re-draft if the parent re-asks

Keep this file under ~5MB. Prune entries older than 90 days during each run.

## "Important" — the filter

A message is **important** if ANY of these are true:

- **From a real human** (not noreply@, no-reply@, notifications@, automated@, etc.) AND
- **Sent specifically to the parent** (the parent in To: or Cc:, not bcc-blasted to a list) AND
- **One of these signals:**
  - Sender is a known relationship: co-op coordinators, teachers, family members, doctors, dentists (add specific known-sender emails to a list in TOOLS.md)
  - Subject or body has time-sensitive language: "tomorrow," "this week," "deadline," "RSVP," "confirm," "scheduled," "appointment," date references in next 14 days
  - Direct question to the parent ("can you...", "are you...", "do you...", "would you...")
  - Personal note (clearly not a mass message)
  - Reply is implicitly expected (interview, scheduling, request for info)

A message is **NOT important** (skip silently):

- Newsletters, promos, sales emails, deals
- Notifications from apps/services (Slack, Notion, Calendar invites with auto-RSVP, GitHub, Asana, etc.)
- Receipts, order confirmations, shipping updates
- Mass/bulk emails (`unsubscribe` link present + sent to a list)
- Already-replied threads (the parent's address appears in thread.messages from her — she handled it)
- Threads the parent initiated (those are her outbound; not "needs response")
- Anything in Spam, Trash, Promotions, or Updates categories
- Threads older than 14 days (lost cause if not addressed)

When uncertain, default to **NOT important.** Better to under-ping than over-ping. The cost of a miss is low (the parent still has Gmail). The cost of noise is high (she'll mute the channel).

## "Hasn't responded to"

Use Gmail thread metadata. A thread is "unresponded" if:
- The most recent message in the thread is NOT from the parent (`from: {{PARENT_EMAIL}}` not in last message)
- AND the parent has never sent a message in that thread (no message from her in `thread.messages`)

Homa drafts don't count as responses (drafts aren't sent).

## The Slack triage card

Send as a **direct message to the parent** (Slack user ID `{{PARENT_USER_ID}}`). NOT to #homa-homeschool — email triage is private to the parent, the family channel doesn't need to see her inbox flow. Format — keep it phone-friendly:

```
📧 New email worth a look
**From:** {sender name} ({sender email})
**Subject:** {subject}
**Received:** {relative time, e.g. "47 min ago"}
**Why I flagged:** {1-line reason — "co-op coordinator," "scheduling for next week," "direct question to you"}

{BODY BLOCK — see rules below}

👍 = draft a reply for me to review
👎 = skip, never ping me about this
🤷 = I'll handle it
```

### Body block rules

Compute the body length AFTER stripping signatures, quoted prior messages, disclaimers, and HTML tags — only the actual new content from this sender.

- **If body ≤ 200 characters:** include the full body verbatim, in a quoted block:
  ```
  > {full body, line breaks preserved}
  ```
  Don't summarize what you can show.

- **If body > 200 characters:** summarize in 1–3 sentences. Lead with the ASK if there is one (what does the sender want from the parent?), then any key context. Plain text, no quote block — make it visually distinct from the verbatim case so the parent knows at a glance "this is my summary, not their words." Format:
  ```
  **Summary:** {1-3 sentences. Lead with the ask.}
  ```
  If the email contains specific dates, times, names, money figures, or links the parent would need, surface them in the summary even if the prose is generic.

- **If body is empty or attachment-only** (e.g., subject says everything, or it's a calendar invite, or it's a forwarded thing): say `_(No body — see attachment / subject line)_` and don't pad with filler.

Don't link to the Gmail thread directly — the parent is on her phone, easier for her to open Gmail app and find it. Subject + sender + body block are enough.

## When the parent reacts

Reactions on Homa's triage card drive the next step (this is where the reaction-feedback skill overlaps — log there too as signal):

- **👍** — Homa pulls the full thread, drafts a reply that matches the parent's voice, **saves as a Gmail draft** (does NOT auto-send), then pings the parent in the same thread: *"Drafted in your Gmail. Open the draft to review and send when ready."* Add the message ID to `drafted_reply_for`.
- **👎** — Add to `skipped_message_ids`. Don't ping again about this thread.
- **🤷** — Add to `skipped_message_ids` (same effect — don't re-ping). the parent is handling it manually.
- **No reaction within 24h** — That's also fine. Don't re-ping. The state already has the message in `pinged_message_ids`.

the parent can also reply with text instead of reacting — handle naturally per her instructions ("send it," "draft something nicer," "tell them I'll get back to them Monday," etc.). For "send it" — verify there's an unsent draft, send it, confirm with one line.

## Voice for drafted replies

When drafting on the parent's behalf:
- Match her tone: warm, direct, occasionally informal, doesn't over-apologize
- First-person ("I'll be there", not "the parent will be there")
- Sign off as "the parent" or "Alessa" (look at recent sent mail for her usual signature)
- Don't sign as Homa — drafts go from the parent's account
- Default length: short. If the email needs more, draft it but flag at the top in the Slack ping: "Long reply — open to review."
- Never include "I'm an AI" or "drafted by Homa" — the parent is sending, not Homa

## Do NOT auto-send

Default behavior is **always draft, never send**. Only send if:
- the parent explicitly says "send it" / "send" / "go ahead and send"
- AND the draft already exists (the parent has had a chance to see it)

Sending email is irreversible and visible to a third party. The 2-second confirmation is the right cost.

## Volume guardrails

- Cap pings at **5 per hour** (sanity check). If filter returns >5, DM the top 5 and add: "*…plus {N} more flagged. Open Gmail when you have a sec.*"
- If 0 important emails, DM NOTHING. Silence = no inbox needs you = good news.
- Quiet hours: only run 7am–10pm ET (cron schedule enforces this).

## Observability

Each run, append a brief log line to `~/.openclaw/workspace/email-triage-log.jsonl`:

```json
{"ts":"2026-05-03T20:47:00Z","scanned":42,"important":3,"new_pinged":1,"skipped_dedup":2,"errors":0}
```

This lets the Sunday Vault Audit (or a future cron) tell you at a glance whether the filter is working — too many pings = filter too loose; too few + the parent keeps complaining about missed emails = filter too tight.

## When this skill is NOT for you

- the parent asking ad-hoc "did I get an email from X?" — just search Gmail directly, no triage state needed
- the partner's email — this skill is the parent-specific
- Sending emails the parent explicitly asks for — that's the Gmail send flow in TOOLS.md, not triage
