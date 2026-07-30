/**
 * Runs lesson-view's suite from a path with no `[bracket]` segments.
 *
 * Node's --test CLI treats a positional file argument through its own glob
 * matcher, not a literal path lookup. `[token]` and `[subjectId]` are valid
 * POSIX bracket-class syntax there, matching any single one of those
 * characters, so a check:* script naming the real file directly would match
 * zero files: 0 tests, 0 fail, exit 0, forever, with no error to notice
 * (confirmed empty test run 2026-07-30). A module import specifier is not
 * glob-matched, so importing it here for its side effect (this is where its
 * describe/it calls register) runs the real suite intact.
 */
import "./r/[token]/lesson/[subjectId]/lesson-view.test";
