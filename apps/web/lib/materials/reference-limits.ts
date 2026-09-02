/**
 * The image model's reference budget. Two modules fill it together:
 * generate-image.ts (the family's own reference URLs) and anchors.ts (the
 * fleet anchors, which lead and take their slots first). Both enforce the
 * same byte cap so neither path can hand the model an oversized image.
 */
export const MAX_REFERENCE_IMAGES = 4;
export const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;
