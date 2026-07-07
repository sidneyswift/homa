import { ImageResponse } from "next/og";

/**
 * Apple touch icon (180x180): the little-home mark centered on the cream
 * page color, since iOS squares off transparent backgrounds with black.
 * Same hand-copied token hexes as opengraph-image.tsx.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const HOUSE_PATH =
  "M24 5.6 C22.5 5.6 21 6.2 19.8 7.3 L7.1 18.9 C5.5 20.4 4.6 22.5 4.6 24.7 L4.6 35.2 C4.6 40.1 8.5 44 13.4 44 L34.6 44 C39.5 44 43.4 40.1 43.4 35.2 L43.4 24.7 C43.4 22.5 42.5 20.4 40.9 18.9 L28.2 7.3 C27 6.2 25.5 5.6 24 5.6 Z";

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
          backgroundColor: "#FBF7F0",
        }}
      >
        <svg width={132} height={132} viewBox="0 0 48 48">
          <path d={HOUSE_PATH} fill="#E7602F" />
          <circle cx="17.4" cy="26" r="4.8" fill="#FFFFFF" />
          <circle cx="30.6" cy="26" r="4.8" fill="#FFFFFF" />
          <circle cx="18.3" cy="26.7" r="2.2" fill="#221E1A" />
          <circle cx="31.5" cy="26.7" r="2.2" fill="#221E1A" />
        </svg>
      </div>
    ),
    size,
  );
}
