import { DESIGN_CONTRACT_VERSION } from "./version.ts";

export const iconContract = {
  family: "Lucide",
  webVersion: "1.27.0",
  nativeVersion: "1.27.0",
  sizes: [16, 20, 24] as const,
  strokePx: 1.75,
  source: "semantic-adapter-only",
  characterIsNotAControl: true,
} as const;
export const semanticIcons = ["back", "next", "close", "menu", "more", "add", "edit", "delete", "calendar", "book", "plan", "progress", "chat", "tasks", "settings", "logout", "print", "share", "voice", "muted", "end", "collapse", "check", "warning", "error", "info", "external", "refresh", "stop"] as const;
export type SemanticIconName = (typeof semanticIcons)[number];

/**
 * The contract names the meaning, not the glyph implementation. Keeping this
 * alias table here lets web and native adapters agree on the vocabulary while
 * still choosing their platform's Lucide component at the edge.
 */
export const semanticIconAliases = {
  back: "ArrowLeft",
  next: "ArrowRight",
  close: "X",
  menu: "Menu",
  more: "Ellipsis",
  add: "Plus",
  edit: "Pencil",
  delete: "Trash2",
  calendar: "CalendarDays",
  book: "BookOpen",
  plan: "ClipboardCheck",
  progress: "ChartNoAxesCombined",
  chat: "Sparkles",
  tasks: "ListChecks",
  settings: "Settings",
  logout: "LogOut",
  print: "Printer",
  share: "Share2",
  voice: "Mic",
  muted: "MicOff",
  end: "PhoneOff",
  collapse: "ChevronDown",
  check: "Check",
  warning: "TriangleAlert",
  error: "CircleAlert",
  info: "Info",
  external: "ExternalLink",
  refresh: "RefreshCw",
  stop: "Square",
} as const satisfies Record<SemanticIconName, string>;

export type SemanticIconPlatform = "web" | "native";
export type SemanticIconRegistry<TGlyph> = Readonly<Record<SemanticIconName, TGlyph>>;

/**
 * The adapter contract keeps platform ownership explicit. A platform may
 * choose a different component implementation later, but it cannot invent a
 * role or silently fall back to a guessed glyph.
 */
export const semanticIconAdapterContract = {
  platforms: ["web", "native"] as const,
  packages: {
    web: "lucide-react",
    native: "lucide-react-native",
  },
  unknownRole: "throw",
  sourcePolicy: "registry-only",
} as const satisfies {
  platforms: readonly SemanticIconPlatform[];
  packages: Record<SemanticIconPlatform, string>;
  unknownRole: "throw";
  sourcePolicy: "registry-only";
};

/** The aliases are intentionally shared until a platform needs an optical adjustment. */
export const semanticIconAdapters = {
  web: semanticIconAliases,
  native: semanticIconAliases,
} as const satisfies Record<SemanticIconPlatform, SemanticIconRegistry<string>>;

export function isSemanticIconName(value: string): value is SemanticIconName {
  return (semanticIcons as readonly string[]).includes(value);
}

/**
 * Validate a platform registry at its adapter boundary. This catches missing
 * and extra roles even when a caller is JavaScript or has widened a value.
 */
export function createSemanticIconRegistry<TGlyph>(
  platform: SemanticIconPlatform,
  registry: SemanticIconRegistry<TGlyph>,
): SemanticIconRegistry<TGlyph> {
  const expected = new Set<string>(semanticIcons);
  const actual = Object.keys(registry);
  const missing = semanticIcons.filter((name) => !(name in registry));
  const extra = actual.filter((name) => !expected.has(name));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`Invalid ${platform} semantic icon registry: missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}`);
  }
  return registry;
}

/** Resolve an icon role without allowing unknown values to disappear. */
export function getSemanticIcon<TGlyph>(
  platform: SemanticIconPlatform,
  registry: SemanticIconRegistry<TGlyph>,
  name: string,
): TGlyph {
  if (!isSemanticIconName(name)) throw new Error(`Unknown ${platform} semantic icon role: ${name}`);
  const glyph = registry[name];
  if (glyph === undefined || glyph === null) throw new Error(`Missing ${platform} glyph for semantic icon role: ${name}`);
  return glyph;
}

export const ICON_CONTRACT = {
  version: DESIGN_CONTRACT_VERSION,
  iconContract,
  semanticIcons,
  semanticIconAliases,
  semanticIconAdapterContract,
  semanticIconAdapters,
} as const;
