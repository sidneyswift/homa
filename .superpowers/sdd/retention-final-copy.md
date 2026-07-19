# Retention bridge final copy inventory

Date: 2026-07-16

Worktree:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons`

Status: extracted from current components

## Scope and notation

This inventory covers the retention bridge only:

- the signed-in report subject action;
- the lesson wait, ready, partial-failure, full-failure, retry, and inactive
  views;
- the worksheet `MaterialCard`;
- owner-only Keep states;
- the post-Keep handoff;
- and the existing signed-in adult editor at
  `/app/settings?edit=phone#parents`.

Strings are listed in rendered DOM reading order. Mutually exclusive branches
are separated into named states.

- `[synthetic]` means generated or record-backed content supplied only for this
  review. Every such example is about Maya's literacy lesson.
- `[conditional]` means the string appears only when the named condition is
  true.
- `[accessibility only]` means the string is available to assistive technology
  but is not visually displayed.
- `{value}` means runtime data rather than fixed product copy.

The report inventory begins at the subject action row, not at the top of the
existing progress report. The lesson inventory covers the complete lesson
surface. The settings inventory begins at the `#parents` anchor rather than at
the top of the settings page.

## 1. Signed-in report subject action

Source:
`apps/web/app/onboarding/r/[token]/report-view.tsx` and
`apps/web/app/onboarding/r/[token]/subject-lesson-button.tsx`

### State: eligible subject, no current lesson, idle

1. `Build the next lesson`
2. `Answer a few deeper questions`

### State: subject lesson flag off, legacy per-subject action

1. `Build the 4-week plan`
2. `Answer a few deeper questions`

The public sample's mutually exclusive flag-off label is:

1. `Get your own report to unlock plans`

The founder mirror shows the legacy action, the deeper-question action, then:

1. `hers to tap`

### State: eligible subject, build request pending

This replaces the idle primary label.

1. `Making the lesson...`
2. `Answer a few deeper questions`

### State: eligible subject, build request failed

1. `Build the next lesson`
2. `Your report is safe. The lesson didn't start. You can try again.`
3. `Answer a few deeper questions`

### State: eligible subject, account owner authorization denied

The Build control is replaced by the information note.

1. `Your report is safe. This lesson can only be built from the account that created the report.`
2. `Answer a few deeper questions`

### State: eligible subject, wall changed between render and request

The Build control is replaced by the information note.

1. `Your report is safe. Refreshing this page will reopen the lesson option.`
2. `Answer a few deeper questions`

### State: eligible subject, current lesson exists

`Open the lesson` and `Build the next lesson` are mutually exclusive.

1. `Open the lesson`
2. `Answer a few deeper questions`

### State: eligible subject, token viewer, no ready lesson

The token viewer cannot build.

1. `Answer a few deeper questions`

### State: ineligible subject

Exposure-based and not-mapped subjects render no lesson action row. There is no
retention-bridge string in this state.

### State: founder mirror, no current lesson

1. `Build the next lesson`
2. `Answer a few deeper questions`
3. `hers to tap`

### State: founder mirror, current lesson exists

1. `Open the lesson`
2. `Answer a few deeper questions`
3. `hers to tap`

### State: public sample

1. `Get your own report to build lessons`

### State: membership wall opened from Build

This overlay is possible in the component contract, although the current
production wall is off. `SubjectLessonButton` does not pass a child name into
the wall, so the generic child wording is the current literal result.

1. `Homa membership`
2. `Try Homa free for 30 days`
3. `Your child's progress report is free, forever.`
4. `Your 30 free days include the lesson you tapped, its printable worksheet, worksheets made for your child, phone calls with Homa, and chat.`
5. `A credit card starts your 30 free days. Nothing is charged during them. You get an email before the first charge.`
6. `Start your 30 free days · then $19 a month`
7. `Choose the year instead · then $99 a year`
8. `The year works out to $8.25 a month.`
9. `Adding children never changes the price.`
10. `Cancel anytime.`
11. `Not now`

## 2. Lesson shell shared by wait, ready, and failure

Source:
`apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-layout.tsx`

The following strings wrap every active lesson state.

### Header, before state content

1. `Homa` `[accessibility only, logo label]`
2. `Maya · Literacy` `[synthetic runtime values]`
3. `Maya's literacy lesson` `[synthetic runtime values]`

### Footer, after state content

1. `made with HOMA for Maya` `[synthetic runtime value]`
2. `Back to the report`

## 3. Lesson wait page

Source:
`apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-view.tsx`

Queued and running are visually identical and mutually exclusive durable build
statuses. Reading order, including the shared shell, is:

1. `Homa` `[accessibility only, logo label]`
2. `Maya · Literacy` `[synthetic]`
3. `Maya's literacy lesson` `[synthetic]`
4. `Lesson goal`
5. `This is the goal for this lesson.`
6. `Names more than half of the uppercase letters` `[synthetic]`
7. `HOMA is making the lesson and worksheet`
8. `This page updates when both are ready.`
9. `You can leave and come back. Your request is saved.`
10. `made with HOMA for Maya` `[synthetic]`
11. `Back to the report`

## 4. Ready draft lesson and worksheet

Sources:

- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-view.tsx`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-layout.tsx`
- `apps/web/app/app/material-card.tsx`
- `apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-keep-button.tsx`

The owner draft state reads:

1. `Homa` `[accessibility only, logo label]`
2. `Maya · Literacy` `[synthetic]`
3. `Maya's literacy lesson` `[synthetic]`
4. `Lesson and worksheet ready.` `[accessibility only, polite status]`
5. `Lesson goal`
6. `This is the goal for this lesson.`
7. `Names more than half of the uppercase letters` `[synthetic]`
8. `The lesson`
9. `Maya's uppercase letter practice` `[synthetic]`
10. `What you'll need`
11. `Six paper letter cards: M, S, T, a, b, and c` `[synthetic]`
12. `A pencil` `[synthetic]`
13. `You might place the uppercase letter cards M, S, and T beside the lowercase cards a, b, and c.` `[synthetic]`
14. `Maya points to M, then S, then T and says each letter name. If one is unfamiliar, you might say its name and invite Maya to repeat it.` `[synthetic]`
15. `Maya writes M, S, and T beside a, b, and c, then circles M, S, and T.` `[synthetic]`
16. `Practice afterward`
17. `Tomorrow, Maya points to and names A, B, and C beside the lowercase letters m, s, and t.` `[synthetic]`
18. `Worksheet`
19. `Maya's uppercase letter practice` `[synthetic]`
20. `Uppercase letter recognition · for Maya` `[synthetic]`
21. `Open the Maya's uppercase letter practice PDF` `[accessibility only, preview link label]`
22. `Preview of Maya's uppercase letter practice` `[accessibility only, image alternative]`
23. `Print it`
24. `Keep in Binder`
25. `Binder saves the worksheet for later. The lesson stays at this link.`
26. `made with HOMA for Maya` `[synthetic]`
27. `Back to the report`

`MaterialCard` supports artifact-kind status headlines in chat. The retention
bridge omits that status line because the `Worksheet` section heading already
names the artifact. The unrelated coloring, flash-card, reader, poster,
infographic, game, and generic-print headlines are outside this review.

## 5. Failed lesson page and retry

### State: worksheet failed after lesson content was saved

1. `Homa` `[accessibility only, logo label]`
2. `Maya · Literacy` `[synthetic]`
3. `Maya's literacy lesson` `[synthetic]`
4. `Lesson goal`
5. `This is the goal for this lesson.`
6. `Names more than half of the uppercase letters` `[synthetic]`
7. `The lesson`
8. `Maya's uppercase letter practice` `[synthetic]`
9. `What you'll need`
10. `Six paper letter cards: M, S, T, a, b, and c` `[synthetic]`
11. `A pencil` `[synthetic]`
12. `You might place the uppercase letter cards M, S, and T beside the lowercase cards a, b, and c.` `[synthetic]`
13. `Maya points to M, then S, then T and says each letter name. If one is unfamiliar, you might say its name and invite Maya to repeat it.` `[synthetic]`
14. `Maya writes M, S, and T beside a, b, and c, then circles M, S, and T.` `[synthetic]`
15. `Practice afterward`
16. `Tomorrow, Maya points to and names A, B, and C beside the lowercase letters m, s, and t.` `[synthetic]`
17. `Worksheet`
18. `The lesson is saved. The worksheet did not finish.`
19. `Make the worksheet again`
20. `made with HOMA for Maya` `[synthetic]`
21. `Back to the report`

### State: full lesson build failed

The saved-content strings do not render.

1. `Homa` `[accessibility only, logo label]`
2. `Maya · Literacy` `[synthetic]`
3. `Maya's literacy lesson` `[synthetic]`
4. `Lesson goal`
5. `This is the goal for this lesson.`
6. `Names more than half of the uppercase letters` `[synthetic]`
7. `The lesson`
8. `Lesson build status` `[accessibility only, status section label]`
9. `The lesson did not finish. Your request is saved.`
10. `Make the lesson again`
11. `made with HOMA for Maya` `[synthetic]`
12. `Back to the report`

### State: retry request pending

The pending action names the work being retried:

1. Saved content: `Making the worksheet...`
2. No saved content: `Making the lesson...`

### State: retry request failed

The button returns to the action that names the failed work. The error also
matches that retry target:

1. Saved content: `The worksheet did not start. Your lesson is still saved.`
2. No saved content: `The lesson did not start. Your request is still saved.`

## 6. Keep UI states

Source:
`apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-keep-button.tsx`

These branches replace one another at the end of the ready worksheet section.

### State: owner draft, idle

1. `Keep in Binder`
2. `Binder saves the worksheet for later. The lesson stays at this link.`

### State: owner draft, Keep request pending

1. `Keeping...`
2. `Binder saves the worksheet for later. The lesson stays at this link.`

### State: Keep request failed

1. `Keep in Binder`
2. `Binder saves the worksheet for later. The lesson stays at this link.`
3. `The worksheet is still on this page, but it was not saved to Binder.`

### State: kept, no family phone

1. `Kept in Binder`
2. `HOMA can help you adjust the lesson or talk through how it went.`
3. `Message HOMA about this lesson`
4. `Prefer text?`
5. `Phone setup is optional. HOMA sends one research note by text each weekday morning.`
6. `Open phone settings`

The entire panel is a persistent polite status. After a newly successful Keep,
focus moves to `Kept in Binder`. The phone setup content sits in its own
existing-token section after the primary chat action.

### State: kept, family phone linked

1. `Kept in Binder`
2. `HOMA can help you adjust the lesson or talk through how it went.`
3. `Message HOMA about this lesson`

All no-phone prompt strings are absent:

1. `Prefer text?`
2. `Phone setup is optional. HOMA sends one research note by text each weekday morning.`
3. `Open phone settings`

### State: token viewer

No Keep or kept-handoff string renders.

### State: superseded owner material

No Keep or kept-handoff string renders.

## 7. Inactive lesson link

Source:
`apps/web/app/onboarding/r/[token]/lesson/[subjectId]/lesson-layout.tsx`

This state replaces the complete active lesson shell.

1. `Homa` `[accessibility only, logo label]`
2. `This lesson link isn't active.`
3. `The progress report is still available.`
4. `Back to the report`

## 8. Phone settings editor destination

Source:
`apps/web/app/app/settings/parents-section.tsx`

The post-Keep link is:

```text
/app/settings?edit=phone#parents
```

The server accepts only the exact `edit=phone` value and passes one boolean
into the existing `ParentsSection`. That boolean initializes the existing
profile editor only for the adult whose row is marked `isYou`. The hash still
targets the existing `<div id="parents">`, and the phone field receives focus.
No adult id enters the URL or prop.

The section's fixed strings are below in their local DOM order. Record-backed
names, email addresses, and phone numbers are represented as placeholders and
no family data is used.

### State: section collapsed to its normal single-adult view

1. `Parents`
2. `{adult name}`
3. `(you)` `[conditional, signed-in adult row]`
4. `{adult email}` `[conditional]`
5. `{adult phone}` `[conditional]`
6. `Edit`
7. `Invite another parent`

### State: two adults or a pending invite

1. `Parents`
2. `The main account set up Homa and gets her task texts.` `[conditional, a primary adult exists]`
3. `{adult name}`
4. `(you)` `[conditional]`
5. `Main account` `[conditional, primary row]`
6. `{adult email}` `[conditional]`
7. `{adult phone}` `[conditional]`
8. `Edit` `[signed-in adult row only]`
9. `{other adult name}`
10. `Main account` `[conditional, if the other adult is primary]`
11. `{other adult email}` `[conditional]`
12. `{other adult phone}` `[conditional]`
13. `Each parent edits their own info.` `[conditional, another adult exists]`
14. `Invite another parent`

### State: signed-in adult editor open

This is the immediate post-Keep destination. The editor follows the signed-in
adult's name, email, and phone row. Another adult's row stays read-only.
The synthetic no-phone review fixture omits the adult phone value, so this
field opens empty in the final screenshots.

1. `Your name`
2. `Your photo`
3. `Your new photo` `[accessibility only, selected-photo preview]`
4. `Your cell number`
5. `Ten digits, like 954 555 0123` `[input placeholder]`
6. `Texts from this number reach your family's Homa. Clear it to unlink. Standard messaging rates apply.`
7. `{one profile error below}` `[conditional]`
8. `{phone verification flow below}` `[conditional]`
9. `Save`
10. `Saving…` `[mutually exclusive pending label]`
11. `Cancel`

The mutually exclusive profile errors are:

1. `That photo didn't upload. Try a different one, or save without a photo.`
2. `Set up your family first.`
3. `Add your name so Homa knows what to call you.`
4. `That name is too long. Try a shorter one.`
5. `You're signed out. Sign in and try again.`
6. `Your name and photo saved. That doesn't look like a US cell number, it needs all ten digits.`
7. `Your name and photo saved. That number is linked to a different Homa family right now; if it's yours, verify it below and it moves here.`

### State: phone verification offer inside the adult editor

This conditional block follows the profile error and precedes Save and Cancel.

1. `If {phone} is your number, Homa can text it a 6-digit code; entering the code moves it here.`
2. `Text me the code`
3. `Sending…` `[mutually exclusive pending label]`
4. `{one send-code error below}` `[conditional]`

The mutually exclusive send-code errors are:

1. `That number has had its three codes for today. Try again tomorrow.`
2. `That number already reaches this family; nothing to verify.`
3. `The code didn't send. Give it another try in a minute.`
4. `Couldn't reach us just now. Try again in a minute.`

### State: phone verification code entry

1. `The 6-digit code from the text`
2. `123456` `[input placeholder]`
3. `Verify`
4. `Checking…` `[mutually exclusive pending label]`
5. `{one verification error below}` `[conditional]`

The mutually exclusive verification errors are:

1. `That code doesn't match. Check the text and try again.`
2. `Too many tries. Send a fresh code and use that one.`
3. `That code expired. Send a fresh one.`
4. `That didn't work. Try once more.`
5. `Couldn't reach us just now. Try again in a minute.`

### State: phone verification complete

1. `Verified. Texts from {phone} reach this family now.`

### State: pending invite row

This row appears in the adult list before the section-level helper and invite
control.

1. `{invite email}`
2. `{Invite sent date}`
3. `Cancel invite`
4. `Canceling…` `[mutually exclusive pending label]`
5. `{one cancellation error below}` `[conditional]`

The mutually exclusive cancellation errors are:

1. `That didn't cancel. Finish setting up your family first.`
2. `That cancel didn't go through. Refresh the page and try again.`

### State: legacy linked phone row

1. `{linked phone}`
2. `Linked number`
3. `Remove {linked phone}` `[accessibility-only control label]`
4. `Remove`
5. `Remove?` `[mutually exclusive armed label]`
6. `Removing…` `[mutually exclusive pending label]`
7. `{one removal error below}` `[conditional]`

The mutually exclusive removal errors are:

1. `Set up your family first.`
2. `That number didn't parse; nothing was removed.`

### State: Homa texting number configured

This appears after adult, invite, and legacy-phone rows.

1. `Text Homa · {Homa phone}`
2. `Only texts from the numbers above reach her.`

### State: invite form open

The closed `Invite another parent` control is replaced by:

1. `Invite another parent`
2. `They'll see everything here: the kids, every conversation with Homa so far, and all your materials. They sign in with their own Google or email.`
3. `Their email`
4. `name@example.com` `[input placeholder]`
5. `The emailed link works for 7 days. If they've never used Homa, signing in creates their account.`
6. `{one invite error below}` `[conditional]`
7. `Send invite`
8. `Sending…` `[mutually exclusive pending label]`
9. `Cancel`

The mutually exclusive invite errors are:

1. `The invite didn't send. Finish setting up your family first.`
2. `That doesn't look like an email address.`
3. `They're already part of this family.`
4. `This one didn't send: that's three invites to this address today. Ask them to check spam. You can send another tomorrow.`
5. `The invite didn't send. Try again in a minute.`

The retention link targets the Parents section. It does not open the nested
phone-verification or invite flows automatically.
