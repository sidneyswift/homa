import { HOUSE_PATH } from "../../components/brand/Logo";

/**
 * The living character for /world-v3: the actual logo mark, solid clay with
 * animated eyes (blink is CSS in the page's style block, keyed off the
 * .w3char class). One instance per scene, per the v3 composition ruling: the
 * mark IS the character, never shown twice in one view. Server-renderable;
 * all motion is CSS so reduced-motion handling stays in one place.
 */
export function HomaCharacter({ size, motion = "" }: { size: number; motion?: "" | "w3-bob" | "w3-tilt" | "w3-hop" }) {
  return (
    <svg className={`w3char ${motion}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d={HOUSE_PATH} fill="var(--brand, #E7602F)" />
      <g>
        <circle cx="17.4" cy="26" r="4.8" fill="#FFFFFF" />
        <circle className="w3pupil" cx="18.3" cy="26.7" r="2.2" fill="var(--pop-navy, #23304F)" />
      </g>
      <g>
        <circle cx="30.6" cy="26" r="4.8" fill="#FFFFFF" />
        <circle className="w3pupil" cx="31.5" cy="26.7" r="2.2" fill="var(--pop-navy, #23304F)" />
      </g>
    </svg>
  );
}
