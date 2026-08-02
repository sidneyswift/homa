import {
  CHILD_PROGRESS_PROJECTION_VERSION,
  childProgressViewSchema,
} from "@homa/core";

import type { ChildProgressView } from "./types";

export { CHILD_PROGRESS_PROJECTION_VERSION, childProgressViewSchema };

export function parseChildProgressView(value: unknown): ChildProgressView {
  return childProgressViewSchema.parse(value);
}
