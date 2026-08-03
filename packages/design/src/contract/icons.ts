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
export const semanticIcons = ["back", "next", "close", "menu", "more", "add", "edit", "delete", "calendar", "book", "plan", "progress", "chat", "tasks", "print", "share", "voice", "check", "warning", "error", "info", "external"] as const;
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
  print: "Printer",
  share: "Share2",
  voice: "Mic",
  check: "Check",
  warning: "TriangleAlert",
  error: "CircleAlert",
  info: "Info",
  external: "ExternalLink",
} as const satisfies Record<SemanticIconName, string>;

export const ICON_CONTRACT = { version: DESIGN_CONTRACT_VERSION, iconContract, semanticIcons, semanticIconAliases } as const;
