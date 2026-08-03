import { ImageResponse } from "next/og";
import { colorTokens, logoGeometry } from "@homa/design/contract";

/**
 * Apple touch icon (180x180): the little-home mark centered on the cream
 * page color, since iOS squares off transparent backgrounds with black.
 * Colors and geometry come from @homa/design so the platform icon cannot
 * drift from the master mark.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const HOUSE_PATH = logoGeometry.housePath;

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colorTokens.canvas,
        }}
      >
        <svg width={132} height={132} viewBox="0 0 48 48">
          <path d={HOUSE_PATH} fill={colorTokens.visualCoral} />
          <circle cx="17.4" cy="26" r="4.8" fill={colorTokens.paper} />
          <circle cx="30.6" cy="26" r="4.8" fill={colorTokens.paper} />
          <circle cx="18.3" cy="26.7" r="2.2" fill={logoGeometry.pupilFill} />
          <circle cx="31.5" cy="26.7" r="2.2" fill={logoGeometry.pupilFill} />
        </svg>
      </div>
    ),
    size,
  );
}
