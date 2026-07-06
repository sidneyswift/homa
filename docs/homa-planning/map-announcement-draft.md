# Draft: the one announce email to the existing waitlist (decision D6=A)

> STATUS: DRAFT, NOT SENT. Founder sends this once, manually, after the
> read-aloud pass. One send ever, no sequence (the D6 ruling). Audience:
> every `public.waitlist` row that predates the /map launch. Send from
> Resend (hello@mail.thankshoma.com), plain and personal, no tracking-heavy
> template needed.
>
> Consent note: these addresses were collected under "your email is only
> used to send your invite." This email is framed as the waitlist itself
> getting better, not a new pitch, which is the reading D6=A approved. If
> anyone replies unhappy, a human apologizes and that's that.

**Subject:** your waitlist spot now comes with your child's progress report

**Preview text:** a five-minute checklist for you, and a progress report on where they stand.

---

Hi, it's Homa.

You joined the founding families waitlist, and your spot just got better.

While you wait for your invite, I can build your child's progress report:
an honest first look at where they stand, checked against national benchmarks
(the same sources schools and pediatric milestones use), from a
five-minute checklist about what you've already seen them do.

No test for your child, ever. You answer, they never do. Strengths come
first, and anything still growing arrives with one small thing to try.

[See where your child stands](https://thankshoma.com/map)

It's free, it lands in your inbox to keep, and everything you share is
saved, so when your invite opens, Homa already knows your kids.

Checklists cover ages 2 to 7 today. Add any child from 2 to 16 and I'll
email you the moment their age's checklist is ready.

You've got this. Homa's got the rest.

P.S. Reply to this email and a real person answers. If you'd rather we
delete your info instead, say the word and it's done.

---

## Send procedure (founder)

1. Read the email aloud once (the wince test).
2. Pull recipient list: `select email from waitlist where created_at < '2026-07-06'`
   (adjust the date to the /map deploy time) via the Supabase dashboard.
3. Send via Resend broadcasts (or one-by-one for the first handful to
   watch replies land).
4. Log the send date in the build log. Never send it twice.
