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
  ListChecks,
  Menu,
  Mic,
  Pencil,
  Plus,
  Printer,
  Share2,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react-native";
import { iconContract, type SemanticIconName } from "@homa/design/contract";

const semanticIconRegistry = {
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
  const Glyph = semanticIconRegistry[name];
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
