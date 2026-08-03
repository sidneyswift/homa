import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookmarkMinus,
  BookmarkPlus,
  Bot,
  Camera,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronUp,
  Check,
  CircleAlert,
  ClipboardCheck,
  Ellipsis,
  ExternalLink,
  Eraser,
  FileText,
  Files,
  FlaskConical,
  FolderOpen,
  Globe2,
  GraduationCap,
  HelpCircle,
  History,
  Info,
  Image,
  Leaf,
  ListChecks,
  Menu,
  Mail,
  Mic,
  MicOff,
  Moon,
  PhoneOff,
  PhoneForwarded,
  Pause,
  Play,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Settings,
  Square,
  LogOut,
  Sparkles,
  Smartphone,
  Trash2,
  TriangleAlert,
  Undo2,
  Users,
  UserRound,
  Wrench,
  Zap,
  Bell,
  Clock3,
  ArrowUp,
  Volume2,
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
  expand: ChevronUp,
  check: Check,
  warning: TriangleAlert,
  error: CircleAlert,
  info: Info,
  external: ExternalLink,
  refresh: RefreshCw,
  stop: Square,
  play: Play,
  pause: Pause,
  reminder: Bell,
  experiment: FlaskConical,
  journal: Moon,
  document: FileText,
  undo: Undo2,
  phone: PhoneForwarded,
  camera: Camera,
  image: Image,
  time: Clock3,
  learn: GraduationCap,
  command: Zap,
  bookmark_add: BookmarkPlus,
  bookmark_remove: BookmarkMinus,
  erase: Eraser,
  history: History,
  mail: Mail,
  search: Search,
  spark: Sparkles,
  person: UserRound,
  people: Users,
  tools: Wrench,
  folder: FolderOpen,
  files: Files,
  help: HelpCircle,
  nature: Leaf,
  globe: Globe2,
  mobile: Smartphone,
  send: ArrowUp,
  assistant: Bot,
  volume: Volume2,
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
