import { z } from "zod";

/**
 * Visible product objects that Voice can point at. The union deliberately
 * includes future native surfaces, but a reference becomes usable only after
 * the authenticated server resolver finds that exact object for the family.
 */
export const ACTIVE_OBJECT_KINDS = [
  "material",
  "plan",
  "recording",
  "photo_proposal",
  "state_packet",
  "calendar_preview",
  "task",
] as const;

export const activeObjectReferenceSchema = z.object({
  kind: z.enum(ACTIVE_OBJECT_KINDS),
  objectId: z.uuid(),
  version: z.string().trim().min(1).max(160),
});

export type ActiveObjectKind = (typeof ACTIVE_OBJECT_KINDS)[number];
export type ActiveObjectReference = z.infer<typeof activeObjectReferenceSchema>;

export function parseActiveObjectReference(
  value: unknown,
): ActiveObjectReference | null {
  const parsed = activeObjectReferenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function activeObjectKey(reference: ActiveObjectReference): string {
  return `${reference.kind}:${reference.objectId}:${reference.version}`;
}
