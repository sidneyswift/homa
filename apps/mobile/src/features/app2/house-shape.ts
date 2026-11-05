import { Shape } from "three";

/** The 48-unit mark's center, matching apps/web/app/app2/homa-character.tsx. */
const ORIGIN = { x: 24, y: 24.8 } as const;

/**
 * Builds the extrudable outline from the generated house path. React
 * Native has no DOMParser, so three's SVGLoader cannot parse it here. The
 * contract path uses only absolute M, L, C and Z, and anything else throws
 * so a geometry change fails loudly instead of drawing a different house.
 */
export function houseShape(path: string): Shape {
  const tokens = path.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const shape = new Shape();
  let index = 0;
  let command = "";
  const point = (): [number, number] => {
    const x = Number(tokens[index++]);
    const y = Number(tokens[index++]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`House path ended inside a ${command} command`);
    return [x - ORIGIN.x, ORIGIN.y - y];
  };

  while (index < tokens.length) {
    if (/[A-Za-z]/.test(tokens[index])) command = tokens[index++];
    switch (command) {
      case "M":
        shape.moveTo(...point());
        // Coordinates after a moveto are implicit linetos.
        command = "L";
        break;
      case "L":
        shape.lineTo(...point());
        break;
      case "C": {
        const [first, second, end] = [point(), point(), point()];
        shape.bezierCurveTo(...first, ...second, ...end);
        break;
      }
      case "Z":
        shape.closePath();
        command = "";
        break;
      default:
        throw new Error(`Unsupported house path command: ${command || tokens[index]}`);
    }
  }
  return shape;
}
