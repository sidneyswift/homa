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
  ListChecks,
  Menu,
  Mic,
  MicOff,
  PhoneOff,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Share2,
  Settings,
  Square,
  LogOut,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react-native";
import { createSemanticIconRegistry, iconContract, isSemanticIconName, type SemanticIconName } from "@homa/design/contract";

const semanticIconRegistry = createSemanticIconRegistry("native", {
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

type IconProps = Omit<LucideProps, "size" | "strokeWidth" | "accessibilityLabel" | "accessible"> & {
  name: SemanticIconName;
  size?: (typeof iconContract.sizes)[number];
  decorative?: boolean;
  accessibilityLabel?: string;
};

/** Native counterpart to the web semantic adapter. Use a label for any icon
 * that carries meaning outside the surrounding control's accessible name. */
export function Icon({
  name,
  size = 20,
  decorative = true,
  accessibilityLabel,
  ...props
}: IconProps) {
  if (!isSemanticIconName(name)) throw new Error(`Unknown native semantic icon role: ${name}`);
  const Glyph = semanticIconRegistry[name];
  if (!Glyph) throw new Error(`Missing native glyph for semantic icon role: ${name}`);
  return (
    <Glyph
      {...props}
      size={size}
      strokeWidth={iconContract.strokePx}
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
    />
  );
}

export { semanticIconRegistry };
