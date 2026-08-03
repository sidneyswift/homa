import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CircleAlert,
  ClipboardCheck,
  Ellipsis,
  ExternalLink,
  Info,
  Menu,
  Mic,
  ListChecks,
  Pencil,
  Plus,
  Printer,
  Share2,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SemanticIconName } from "@homa/design/contract";

/**
 * The web edge maps semantic contract names to the installed Lucide glyphs.
 * Routes should import `Icon` rather than selecting a glyph directly. This
 * registry is intentionally small, so an alias can be reviewed as part of the
 * design contract instead of being inferred from a screen's local context.
 */
export const semanticIconRegistry = {
  back: ArrowLeft,
  next: ArrowRight,
  close: X,
  menu: Menu,
  more: Ellipsis,
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  calendar: CalendarDays,
  book: BookOpen,
  plan: ClipboardCheck,
  progress: ChartNoAxesCombined,
  chat: Sparkles,
  tasks: ListChecks,
  print: Printer,
  share: Share2,
  voice: Mic,
  check: Check,
  warning: TriangleAlert,
  error: CircleAlert,
  info: Info,
  external: ExternalLink,
} as const satisfies Record<SemanticIconName, LucideIcon>;

export type { SemanticIconName };
