# App Review notes, R1 companion submission

Corrected 2026-07-28 against what actually shipped in PR #311. The
council draft in `app-review.md` §3 made two claims that were not true
in the codebase at draft time; both are fixed here rather than carried
into a real submission. Paste into App Store Connect's App Review
Information > Notes; replace bracketed values.

---

**About Homa**

Homa is an assistant for homeschooling parents. The parent (an adult)
chats with Homa to plan lessons, create printable worksheets, and
track their children's progress. Children do not use the app; there
are no child accounts and no child-facing features. Homa is a
companion app to our web service at https://thankshoma.com, where
families create their accounts.

**Demo account (full access)**

- Email: sswift+homatest@swiftdrtv.com
- Password: HomaReview2026!qT7m
- This account (`billing_exempt` set 2026-07-28) is a fully set-up
  family with a child, progress history, and saved materials, and has
  full access with no payment state to encounter.
- Sign in with Apple and Google sign-in are also supported and can be
  tested with any account; a brand-new account will show a simple
  "finish setting up on the web" state, because family setup happens
  on our website.

**Subscriptions**

Homa does not sell anything inside the app. There are no in-app
purchases, no paid tiers presented in the app, and no purchase flows.
Subscriptions are purchased and managed on our website, and every
signed-in user sees the same app regardless of how or where they
subscribed (multiplatform service per guideline 3.1.3(b); the app is a
companion to the web product). The demo account above has full access,
so no subscription state will interrupt review.

**AI content and moderation**

Homa's chat is powered by large language models. Safeguards: (1) the
assistant is instructed and constrained to the homeschooling domain,
with refusal behavior for unsafe or inappropriate requests; (2)
objectionable content can be reported via hello@thankshoma.com, linked
in the app under Settings > Support > Contact us, and we respond
promptly; (3) chat is one-to-one between the parent and the assistant
only, there is no user-to-user communication, so blocking other users
does not apply; (4) conversations are private to the signed-in adult.
Our processing of conversation content by third-party AI providers is
disclosed with explicit, affirmative consent the first time a parent
opens Chat, in our privacy policy (https://thankshoma.com/privacy),
and in the App Privacy details.

**Account deletion**

Account deletion is available in the app under Settings > Delete
account. It permanently deletes the account and, for a family with one
parent, the family's personal data (children's profiles, chat history,
records); for a family shared by more than one parent, only the
deleting parent's own account and access are removed, and the shared
family's records remain for the other parent, by design.

**Contact**

[Founder name], [support email], [phone]. We respond quickly during
review and are happy to demonstrate anything over a call.

---

## What changed from the first draft, and why

1. **Dropped "revokes Sign in with Apple tokens."** Not true yet: the
   revoke call needs a Sign in with Apple private key from Apple
   Developer's Keys section that does not exist in this project
   (tracked, founder-blocked, issue #314). The account and data
   deletion itself is real and was verified end to end against
   production with three throwaway accounts before this note was
   written; only the Apple-side revoke leg is missing. Promising it in
   review notes and having a reviewer find it absent turns a pass into
   a rejection.
2. **Reworded the report-content claim.** No per-message report
   affordance exists in chat, web or mobile (grepped, confirmed empty).
   Used the weaker, true fallback the original research explicitly
   sanctioned for this case: the Contact us link, which is real and
   shipped in this same PR. Tracked as a real follow-up, issue #331.
3. **Everything else matches the original draft** (`app-review.md`
   §3-4), including the guidance not to cite guideline numbers beyond
   the one 3.1.3(b) anchor, and that the mobile channel's own chat
   prose was independently reworded (PR #311) to stop naming trial
   mechanics in the account-gate reply.
