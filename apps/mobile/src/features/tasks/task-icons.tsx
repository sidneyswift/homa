import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { TaskRunKind } from "../../lib/tasks";

/**
 * Line-treatment kind icons for the tasks screen, drawn in the same
 * stroke style as components/ui/tab-icons.tsx (no icon-font
 * dependency). Kind-to-shape mapping mirrors the web's TaskIcon
 * (app/app/tasks/tasks-view.tsx): flask for research (morning brief and
 * fleet research), moon for the evening check-in, bell for custom tasks.
 */

interface KindIconProps {
  color: ColorValue;
  size: number;
}

function FlaskIcon({ color, size }: KindIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9.5 3 L9.5 9 L4.6 18.6 C4 19.9 4.9 21 6.2 21 L17.8 21 C19.1 21 20 19.9 19.4 18.6 L14.5 9 L14.5 3"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 3 L16 3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M7 15 L17 15"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function MoonIcon({ color, size }: KindIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3 A6.5 6.5 0 0 0 21 12.5 A9 9 0 1 1 12 3 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BellIcon({ color, size }: KindIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 9 A6 6 0 0 1 18 9 C18 14.5 20 16.5 20 16.5 L4 16.5 C4 16.5 6 14.5 6 9 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.2 20 A2 2 0 0 0 13.8 20"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function TaskKindIcon({
  kind,
  color,
  size,
}: KindIconProps & { kind: TaskRunKind }) {
  switch (kind) {
    case "morning_brief":
    case "fleet_research":
      return <FlaskIcon color={color} size={size} />;
    case "journal_prompt":
      return <MoonIcon color={color} size={size} />;
    case "custom":
      return <BellIcon color={color} size={size} />;
    default: {
      const exhaustive: never = kind;
      throw new Error(`unhandled task icon kind: ${String(exhaustive)}`);
    }
  }
}
