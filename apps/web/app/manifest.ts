import type { MetadataRoute } from "next";

/**
 * Web app manifest: identity + brand colors for browsers, install surfaces,
 * and crawlers that read it as an entity signal. Colors are the cream page
 * and clay brand tokens.
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Homa",
    short_name: "Homa",
    description:
      "The calm homeschool assistant. Homa learns each child, makes printable materials just for them, tracks hours for your state, and shows you it's working.",
    start_url: "/",
    display: "browser",
    background_color: "#FBF7F0",
    theme_color: "#FBF7F0",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
