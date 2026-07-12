# Comparison Lab Verification Checklist

Complete this checklist after the HTML exists. A source review does not replace browser testing.

## 1. Protect the project boundary

- Record repository status before and after the exercise.
- Confirm that the disposable HTML is the only file added or changed by this exercise.
- Confirm there are no real names, messages, records, metrics, credentials, tokens, or copied production payloads.
- Confirm every future or illustrative capability is labeled honestly.
- Confirm the wiring note names only paths verified in the repository.

## 2. Run the artifact in a browser

Open the HTML directly or through a minimal local static server. Do not wire it into the application to test it.

- Check the browser console on initial load and after every direction.
- Require zero uncaught errors.
- Treat failed resource requests as defects. The file must not depend on a network connection.
- Confirm the initial state communicates the core decision and fake-data boundary without scrolling through process notes.

## 3. Exercise every interaction

- Visit every direction.
- Complete the shared core task in every direction.
- Exercise every scope, placement, filter, search, hierarchy, and detail interaction that is present.
- Choose each direction as the winner at least once.
- Select and clear steal chips across different directions.
- Answer every open question.
- Enter punctuation and multiple lines in freeform notes.
- Switch directions and confirm winner, steals, answers, and notes persist.
- Confirm illustrative controls do not imply that they changed real data.

## 4. Verify reply assembly

- Confirm the reply updates after every winner, steal, answer, and notes change.
- Confirm empty optional fields produce readable output.
- Confirm multiline notes are preserved.
- Use the copy button and compare clipboard contents with the visible reply.
- Exercise the fallback path when clipboard permission is unavailable.
- Confirm copied text is plain, complete, and ready to paste into chat without cleanup.

## 5. Check desktop and phone layouts

Test at a representative desktop viewport and a narrow phone viewport, such as 1440 by 900 and 390 by 844.

- Capture one desktop screenshot per direction when screenshot tooling is available.
- Capture at least one phone screenshot of the strongest direction.
- Check for clipped content, unintended horizontal scrolling, unreadable text, hidden controls, and overlapping sticky elements.
- Confirm direction switching and the primary task remain usable on the phone.
- Confirm dense tables, trees, drawers, and comparison controls adapt rather than merely shrink.

## 6. Check keyboard and focus behavior

- Traverse the whole artifact with the keyboard.
- Confirm a logical tab order and visible focus on every control.
- Activate controls with Enter or Space as appropriate.
- After any activation that re-renders content, confirm focus stays on the equivalent control or moves to an intentional next target.
- Confirm selected states are exposed with semantic controls or ARIA.
- For dialogs or drawers, move focus inside on open, support Escape, prevent focus from disappearing behind the overlay, and restore focus to the opener on close.
- Confirm there is no keyboard trap.
- Enable reduced motion and confirm the artifact remains understandable.

## 7. Run visual and persona review

Review the screenshots for hierarchy, brand fit, contrast between directions, and generic AI styling. Fix high-impact visual issues before handoff.

If the project defines a user-persona UX review gate:

1. Run it only after screenshots exist.
2. Give it the screenshots, the core task, and the artifact path.
3. Separate observed usability problems from taste preferences.
4. Fix accepted high-impact issues.
5. Re-run affected browser checks and screenshots.

## 8. Report evidence

At handoff, report:

- Browser and viewport checks completed
- Console result
- Keyboard and focus result
- Reply assembly and clipboard result
- Screenshot paths, when available
- Persona review result, when applicable
- Any check that could not be completed and why

Never describe the artifact as verified if a required browser check was skipped.
