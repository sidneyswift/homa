# Retention bridge final review artifacts

Date: 2026-07-16

Worktree:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons`

Status: DONE

## Review result

The current retention bridge rendered successfully through its real report,
lesson, worksheet, retry, Keep, post-Keep, and Parents settings components at
both requested viewports.

- Phone screenshots are exactly 390 by 844 pixels.
- Desktop screenshots are exactly 1440 by 900 pixels.
- All review data is synthetic Maya literacy content.
- No browser console error or uncaught page error occurred.
- The Build, Keep, and both Retry actions were exercised in both viewports.
- Wait, ready, and failure states render the goal framing before the unchanged
  deterministic target.
- The wait state uses one combined lesson-and-worksheet heading, one readiness
  status, and one saved-request helper.
- The draft state keeps `Print it` and `Keep in Binder`, then explains that
  Binder saves the worksheet while the lesson remains at its link.
- The post-Keep no-phone state keeps chat visually dominant and places
  `Prefer text?`, the optional phone explanation, and `Open phone settings`
  inside a separate existing-token section.
- The phone-linked state keeps the chat CTA and omits the complete phone setup
  section.
- `Open phone settings` targets `/app/settings?edit=phone#parents`.
- The existing `ParentsSection` opens the signed-in adult's editor, focuses
  the empty `Your cell number` field, and keeps the other adult read-only.

## Real components exercised

- `ReportView`
- `SubjectLessonButton`
- `SubjectLessonPageView`
- `LessonShell`
- `LessonTarget`
- `SavedLessonContent`
- `SubjectLessonRetryButton`
- `MaterialCard`
- `SubjectLessonKeepButton`
- `KeptLessonHandoff`
- `ParentsSection`

The review route supplied state and synthetic records only. It did not copy
or restyle the product components.

## Browser interaction evidence

The retained Playwright script is:

```text
.tmp-retention-bridge-review/capture_review.py
```

For each viewport, the script:

1. opened the synthetic signed-in `ReportView`;
2. expanded Literacy;
3. captured `Build the next lesson`;
4. clicked Build and intercepted
   `POST /api/map/subject-lesson/build`;
5. returned a synthetic successful URL and captured the combined lesson and
   worksheet wait view;
6. opened the real ready draft lesson;
7. captured the worksheet, `Print it`, `Keep in Binder`, and its
   Binder-versus-lesson boundary helper;
8. clicked Keep and intercepted
   `POST /api/map/subject-lesson/keep`;
9. returned `{ "ok": true, "kept": true }`;
10. verified focus moved to `Kept in Binder`;
11. captured the chat-first no-phone handoff and separate `Prefer text?`
    section;
12. verified the phone CTA's exact editor URL;
13. captured the failed worksheet state with `Make the worksheet again`;
14. clicked Retry, intercepted its request, and captured the worksheet-specific
    error;
15. repeated the failed Retry for a lesson with no saved content and captured
    the lesson-specific error;
16. captured the already-kept phone-linked state without the no-phone prompt
    section; and
17. opened the real `ParentsSection`, verified that the signed-in adult's
    empty phone field was focused, and captured that editor.

The mocked request bodies used synthetic identifiers only:

```json
{
  "build": {
    "childId": "11111111-1111-4111-8111-111111111111",
    "subjectId": "literacy"
  },
  "keep": {
    "lessonId": "33333333-3333-4333-8333-333333333333"
  },
  "retry": {
    "lessonId": "33333333-3333-4333-8333-333333333333"
  }
}
```

All `/api/**` requests were intercepted by Playwright. No real family API,
database, Blob, analytics, or provider request was used.

## Phone screenshots, 390 by 844

1. `.tmp-retention-bridge-review/screenshots/01-report-build-phone-390x844.png`
2. `.tmp-retention-bridge-review/screenshots/02-wait-phone-390x844.png`
3. `.tmp-retention-bridge-review/screenshots/03-ready-draft-phone-390x844.png`
4. `.tmp-retention-bridge-review/screenshots/04-kept-no-phone-after-click-phone-390x844.png`
5. `.tmp-retention-bridge-review/screenshots/05-failed-retry-phone-390x844.png`
6. `.tmp-retention-bridge-review/screenshots/06-kept-phone-linked-phone-390x844.png`
7. `.tmp-retention-bridge-review/screenshots/07-failed-worksheet-retry-error-phone-390x844.png`
8. `.tmp-retention-bridge-review/screenshots/08-failed-lesson-retry-error-phone-390x844.png`
9. `.tmp-retention-bridge-review/screenshots/09-phone-settings-editor-phone-390x844.png`

## Desktop screenshots, 1440 by 900

1. `.tmp-retention-bridge-review/screenshots/01-report-build-desktop-1440x900.png`
2. `.tmp-retention-bridge-review/screenshots/02-wait-desktop-1440x900.png`
3. `.tmp-retention-bridge-review/screenshots/03-ready-draft-desktop-1440x900.png`
4. `.tmp-retention-bridge-review/screenshots/04-kept-no-phone-after-click-desktop-1440x900.png`
5. `.tmp-retention-bridge-review/screenshots/05-failed-retry-desktop-1440x900.png`
6. `.tmp-retention-bridge-review/screenshots/06-kept-phone-linked-desktop-1440x900.png`
7. `.tmp-retention-bridge-review/screenshots/07-failed-worksheet-retry-error-desktop-1440x900.png`
8. `.tmp-retention-bridge-review/screenshots/08-failed-lesson-retry-error-desktop-1440x900.png`
9. `.tmp-retention-bridge-review/screenshots/09-phone-settings-editor-desktop-1440x900.png`

## Visual review notes

- The phone report capture keeps both subject actions readable without
  horizontal clipping.
- The phone wait state shows the explicit goal framing, unchanged target, one
  combined build heading, one readiness status, and the saved-request helper.
- The phone ready capture shows the worksheet identity, worksheet preview,
  `Print it`, `Keep in Binder`, and the exact worksheet-versus-lesson boundary.
- The phone failure capture keeps the saved lesson visible above the warning
  panel and places `Make the worksheet again` inside that panel.
- The two retry-error captures keep the action available and match the error
  to the worksheet or full lesson work being retried.
- The no-phone capture shows chat as the dominant primary action, then a
  separate `Prefer text?` section with optional setup copy and
  `Open phone settings`. The phone-linked capture omits that complete section.
- The settings captures open the existing signed-in adult editor with the
  empty cell-number field focused. The other adult remains a read-only row.
- The synthetic lesson and worksheet provide exact letter options and do not
  assume a particular example exists in an outside item.
- The synthetic lesson steps use active subject-verb offers or declarative
  statements without repeated weak `can` wording.
- The desktop lesson states stay centered in the existing bounded lesson
  column. Controls and handoff copy remain readable at the requested width.
- The Next development indicator was hidden by the capture script. Product
  markup and product styling were not changed for that cleanup.

No visual retention-bridge blocker was found in these states.

## Capture setup and cleanup

Before starting the server, terminal metadata was inspected and showed no
running development server for this worktree. Port 4173 was also confirmed
free.

The webapp-testing `with_server.py` helper started one local Next development
server, waited for port 4173, ran the Playwright script, and stopped the server.

The worktree intentionally has no local Supabase environment values. To avoid
altering the environment, the capture used a temporary development-only proxy
bypass for the temporary review path. Both that bypass and the temporary app
route were removed after capture. `apps/web/proxy.ts` has no retained diff.

The removed route was:

```text
/retention-bridge-review-dev
```

No application route remains under that path.

## Screenshot integrity

SHA-256:

```text
c5bdacdf299c670b46ecdf69b907c24df0ba218c016543d9038125154ac462de  01-report-build-desktop-1440x900.png
d2181497fa52a3311a6822472c68fd80c0f4c12e9cee34c60613a7f2dacf8500  01-report-build-phone-390x844.png
b1a436e6b226f59ae0755db6524e69e03cff3ad6f2ed95fd80a949840cee8281  02-wait-desktop-1440x900.png
96c103e090cd65061cd7c039d2e3f67f7bdf0d5a033dab7c23c61898ccf5e7e1  02-wait-phone-390x844.png
7e411d89fd5a62aa08e2021ddc1c8e221753a6830ecb86caa5c922409542aac7  03-ready-draft-desktop-1440x900.png
11659922715c5570bb677991e7517aac965a0dcac72a30c17b51724b7606855a  03-ready-draft-phone-390x844.png
9b180548b1909ce77cf9573646f662f5c390ae15c766d505aa92beb2b246abdd  04-kept-no-phone-after-click-desktop-1440x900.png
3fff4d0e145827633d5a4b883756a7a500932bad25c626107c09d7ff8f4d6351  04-kept-no-phone-after-click-phone-390x844.png
35f38a4b02b234bcbe31e4b6186ff161828e499b6bc9acf7f40608e46368f856  05-failed-retry-desktop-1440x900.png
4ce73590ff6e8fb975dae6d219823f6eeab751f3ad332f1725df325ae0bfd3d6  05-failed-retry-phone-390x844.png
d78963bf1bd005803c95c1186ec737889b84963cbf301be4fca01d331a9e35c2  06-kept-phone-linked-desktop-1440x900.png
90b1418a84a8e9501abf0a7465d47fad3d9c5a6dc807bd510f9c93ea4d7bd95a  06-kept-phone-linked-phone-390x844.png
2f5a824b1ee039540adec09777db34d191a571788548a0f0bed1541ec73534bc  07-failed-worksheet-retry-error-desktop-1440x900.png
915ddbc3048e2412accc3168f8200b92db713226a8c47fae74b2c8316d2d634d  07-failed-worksheet-retry-error-phone-390x844.png
8b23c88f5054be1cb11cdfcfaf53c4d43465b398866051e1e6623fd88862a928  08-failed-lesson-retry-error-desktop-1440x900.png
b5f96192ba5866f2ce5f2007cc122ce74bcc2e6662a875f370e24c8dc420a30e  08-failed-lesson-retry-error-phone-390x844.png
27b89ed1b980f4ea2a8306a28d0cf475fcb5bd5d0d6171d45953b857ad9ce15e  09-phone-settings-editor-desktop-1440x900.png
9e511f51df081e63ba41b09543e89acee6c4c8af28326205840f27144807f2a2  09-phone-settings-editor-phone-390x844.png
```

## Boundaries

- This is a component review with mocked successful Build and Keep responses
  plus two mocked failed Retry results.
- It is not an authenticated database or production journey.
- No migration was applied.
- No environment value was added, changed, or persisted.
- Product changes are limited to the accepted lesson, Keep, handoff,
  signed-in phone-editor initialization, and generation-quality feedback.
- No commit, push, deployment, or production probe was performed.
