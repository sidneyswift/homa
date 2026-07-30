/**
 * Runs subject-lesson-button's suite from a path with no `[bracket]` segment.
 * See lesson-view.wrapper.test.ts for why: node --test glob-matches CLI file
 * arguments, and `[token]` matches zero files rather than the literal folder.
 */
import "./r/[token]/subject-lesson-button.test";
