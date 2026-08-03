import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  Check,
  CircleAlert,
  ClipboardCheck,
  Ellipsis,
  ExternalLink,
  Info,
  LogOut,
  Menu,
  Mic,
  MicOff,
  PhoneOff,
  ListChecks,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Share2,
  Settings,
  Square,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createSemanticIconRegistry, type SemanticIconName } from "@homa/design/contract";

/**
 * The web edge maps semantic contract names to the installed Lucide glyphs.
 * Routes should import `Icon` rather than selecting a glyph directly. This
 * registry is intentionally small, so an alias can be reviewed as part of the
 * design contract instead of being inferred from a screen's local context.
 */
export const semanticIconRegistry = createSemanticIconRegistry("web", {
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
  settings: Settings,
  logout: LogOut,
  print: Printer,
  share: Share2,
  voice: Mic,
  muted: MicOff,
  end: PhoneOff,
  collapse: ChevronDown,
  check: Check,
  warning: TriangleAlert,
  error: CircleAlert,
  info: Info,
  external: ExternalLink,
  refresh: RefreshCw,
  stop: Square,
} as const satisfies Record<SemanticIconName, LucideIcon>);

export type { SemanticIconName };
