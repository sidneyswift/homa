import { readFileSync } from "node:fs";
import { test } from "node:test";

const childRoutes = [
  ["families", "admin-families"],
  ["chats", "admin-chats"],
  ["sessions", "admin-sessions"],
  ["pulse", "admin-pulse"],
  ["funnels", "admin-funnels"],
  ["drip", "admin-drip"],
  ["makings", "admin-makings"],
  ["studio", "admin-studio"],
  ["library", "admin-library"],
] as const;

test("admin child routes expose Quiet surface boundaries", () => {
  for (const [route, surface] of childRoutes) {
    const source = readFileSync(new URL(`./${route}/page.tsx`, import.meta.url), "utf8");
    if (!source.includes(`data-brand-surface="${surface}"`)) {
      throw new Error(`${route} route is missing ${surface} marker`);
    }
    if (!source.includes("quiet-admin__child")) {
      throw new Error(`${route} route is missing Quiet child hook`);
    }
  }
});

test("admin nav uses semantic contract icons at a contract size", () => {
  const source = readFileSync(new URL("./admin-nav.tsx", import.meta.url), "utf8");
  if (source.includes('from "lucide-react"')) throw new Error("admin nav bypasses semantic icon adapter");
  if (!source.includes('<Icon name={item.icon}')) throw new Error("admin nav does not render semantic icons");
  if (!source.includes('size={20}')) throw new Error("admin nav icon size is not contract-backed");
});
