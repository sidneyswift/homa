export type IslandPlacement = "top" | "center" | "bottom";

/** A small neutral band prevents placement chatter around the region's thirds. */
export function resolveIslandPlacement(anchor: number, start: number, height: number, previous?: IslandPlacement): IslandPlacement {
  const fraction = height > 0 ? (anchor - start) / height : 0.5;
  const band = previous ? 1 / 24 : 0;
  if (previous === "top" && fraction < 1 / 3 + band) return "top";
  if (previous === "bottom" && fraction > 2 / 3 - band) return "bottom";
  if (fraction < 1 / 3 - band) return "top";
  if (fraction > 2 / 3 + band) return "bottom";
  return "center";
}

export function fitIsland({ x, y, width, height, origin, bounds }: {
  x: number; y: number; width: number; height: number; origin: number;
  bounds: { left: number; top: number; right: number; bottom: number };
}) {
  const maxWidth = Math.max(0, bounds.right - bounds.left);
  const maxHeight = Math.max(0, bounds.bottom - bounds.top);
  const fittedWidth = Math.min(width, maxWidth);
  const fittedHeight = Math.min(height, maxHeight);
  const left = Math.max(bounds.left, Math.min(x - fittedWidth / 2, bounds.right - fittedWidth));
  const top = Math.max(bounds.top, Math.min(y - origin * fittedHeight, bounds.bottom - fittedHeight));
  return { maxWidth, maxHeight, offsetX: left + fittedWidth / 2 - x, offsetY: top + origin * fittedHeight - y };
}
