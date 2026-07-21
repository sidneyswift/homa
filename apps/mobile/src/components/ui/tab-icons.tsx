import type { ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

/**
 * Line-treatment tab icons drawn from the brand geometry (the home icon
 * is the logo mark's own house path), so the tab bar stays on-brand
 * without an icon-font dependency.
 */

const HOUSE_PATH =
  "M24 5.6 C22.5 5.6 21 6.2 19.8 7.3 L7.1 18.9 C5.5 20.4 4.6 22.5 4.6 24.7 L4.6 35.2 C4.6 40.1 8.5 44 13.4 44 L34.6 44 C39.5 44 43.4 40.1 43.4 35.2 L43.4 24.7 C43.4 22.5 42.5 20.4 40.9 18.9 L28.2 7.3 C27 6.2 25.5 5.6 24 5.6 Z";

interface TabIconProps {
  color: ColorValue;
  size: number;
}

export function TodayTabIcon({ color, size }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d={HOUSE_PATH}
        fill="none"
        stroke={color}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Circle cx="17.4" cy="26" r="2.7" fill={color} />
      <Circle cx="30.6" cy="26" r="2.7" fill={color} />
    </Svg>
  );
}

export function ChatTabIcon({ color, size }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M24 7 C13.5 7 5.5 14 5.5 22.8 C5.5 27.9 8.3 32.4 12.6 35.2 L11 42 L19 38 C20.6 38.4 22.3 38.6 24 38.6 C34.5 38.6 42.5 31.6 42.5 22.8 C42.5 14 34.5 7 24 7 Z"
        fill="none"
        stroke={color}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Circle cx="16.5" cy="23" r="2.4" fill={color} />
      <Circle cx="24" cy="23" r="2.4" fill={color} />
      <Circle cx="31.5" cy="23" r="2.4" fill={color} />
    </Svg>
  );
}

export function PlannerTabIcon({ color, size }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M13 8 L35 8 C39.4 8 43 11.6 43 16 L43 34 C43 38.4 39.4 42 35 42 L13 42 C8.6 42 5 38.4 5 34 L5 16 C5 11.6 8.6 8 13 8 Z"
        fill="none"
        stroke={color}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Path
        d="M5 18.5 L43 18.5"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <Circle cx="16" cy="27" r="2.4" fill={color} />
      <Circle cx="24" cy="27" r="2.4" fill={color} />
      <Circle cx="32" cy="27" r="2.4" fill={color} />
      <Circle cx="16" cy="34.5" r="2.4" fill={color} />
      <Circle cx="24" cy="34.5" r="2.4" fill={color} />
    </Svg>
  );
}

export function ProgressTabIcon({ color, size }: TabIconProps) {
  // Ascending bars, growth framing: progress climbs, never a red dip.
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M9 40 L9 30"
        stroke={color}
        strokeWidth={4.2}
        strokeLinecap="round"
      />
      <Path
        d="M19 40 L19 24"
        stroke={color}
        strokeWidth={4.2}
        strokeLinecap="round"
      />
      <Path
        d="M29 40 L29 17"
        stroke={color}
        strokeWidth={4.2}
        strokeLinecap="round"
      />
      <Path
        d="M39 40 L39 10"
        stroke={color}
        strokeWidth={4.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MoreTabIcon({ color, size }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx="11" cy="24" r="3.2" fill={color} />
      <Circle cx="24" cy="24" r="3.2" fill={color} />
      <Circle cx="37" cy="24" r="3.2" fill={color} />
    </Svg>
  );
}

export function FamilyTabIcon({ color, size }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle
        cx="17"
        cy="17"
        r="6.5"
        fill="none"
        stroke={color}
        strokeWidth={3.2}
      />
      <Path
        d="M5.5 41 C5.5 33.5 10.5 28.5 17 28.5 C23.5 28.5 28.5 33.5 28.5 41"
        fill="none"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <Circle
        cx="33.5"
        cy="20.5"
        r="5"
        fill="none"
        stroke={color}
        strokeWidth={3.2}
      />
      <Path
        d="M28 41 C28.5 35 32 31.5 36.5 31.5 C40.5 31.5 43.5 34.5 44 39.5"
        fill="none"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}
