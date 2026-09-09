import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

import { Logo } from "../../components/brand/logo";
import { v2Colors as c } from "./theme";

export type IntroductionBenefit = "lessons" | "progress" | "hours";

/** Illustrative objects, not generated lessons or a family's actual
 * records. Homa uses the real Logo adapter; no local character geometry.
 * The entire scene is decorative and stays still, including Reduced Motion. */
export function IntroductionArt({ benefit, width }: { benefit: IntroductionBenefit; width: number }) {
  const scale = width / 400;
  const mascot = benefit === "progress"
    ? { left: 244, top: 12, size: 136, rotation: "8deg" }
    : { left: 12, top: 224, size: 176, rotation: "-8deg" };

  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width, height: width, alignSelf: "center" }}>
      <Svg width={width} height={width} viewBox="0 0 400 400">
        {benefit === "lessons" ? <LessonObjects /> : benefit === "progress" ? <ProgressObjects /> : <HoursObjects />}
      </Svg>
      <View style={{ position: "absolute", left: mascot.left * scale, top: mascot.top * scale,
        transform: [{ rotate: mascot.rotation }] }}>
        <Logo size={mascot.size * scale} variant="mark" />
      </View>
    </View>
  );
}

function Spark({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return <Path d="M0 -1 Q0 0 1 0 Q0 0 0 1 Q0 0 -1 0 Q0 0 0 -1 Z"
    transform={`translate(${x} ${y}) scale(${size})`} fill={color} />;
}

function Pencil({ x, y, rotate }: { x: number; y: number; rotate: number }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <Rect width={22} height={130} rx={8} fill={c.field} />
      <Rect y={18} width={22} height={112} fill={c.fieldMid} />
      <Rect x={9} y={18} width={5} height={112} fill={c.paper} opacity={0.35} />
      <Path d="M0 130 L11 158 L22 130 Z" fill={c.border} />
      <Path d="M7 148 L11 158 L15 148 Z" fill={c.midnight} />
      <Rect y={15} width={22} height={9} fill={c.paper} />
    </G>
  );
}

function LessonObjects() {
  return (
    <>
      <Path d="M108 400 C87 316 133 255 205 218 C283 178 368 205 420 286 L420 420 Z" fill={c.fieldMid} />
      <G transform="rotate(8 234 186)">
        <Rect x={119} y={50} width={225} height={286} rx={18} fill={c.coralSoft} />
      </G>
      <G transform="rotate(-7 222 180)">
        <Rect x={100} y={28} width={228} height={290} rx={18} fill={c.paper} />
        <Rect x={124} y={54} width={112} height={9} rx={4.5} fill={c.midnight} />
        <Rect x={124} y={76} width={170} height={5} rx={2.5} fill={c.border} />
        <Rect x={124} y={96} width={178} height={104} rx={12} fill={c.paperMuted} />
        {[154, 212, 270].map((x) => (
          <G key={x}>
            <Path d={`M${x} 143 C${x - 29} 122 ${x - 30} 165 ${x - 13} 178 Q${x} 186 ${x + 13} 178 C${x + 30} 165 ${x + 29} 122 ${x} 143 Z`} fill={c.field} />
            <Path d={`M${x} 140 Q${x + 2} 122 ${x + 16} 126 Q${x + 14} 140 ${x} 140`} fill={c.inkMuted} />
          </G>
        ))}
        {[148, 212, 276].map((x, i) => (
          <G key={x}>
            <Circle cx={x} cy={237} r={18} fill="none" stroke={c.border} strokeWidth={2} />
            {Array.from({ length: i + 1 }, (_, dot) => <Circle key={dot} cx={x + (dot - i / 2) * 9} cy={237} r={3} fill={c.midnight} />)}
          </G>
        ))}
        <Path d="M130 282 H174 M192 282 H236 M254 282 H298" stroke={c.border} strokeWidth={3} strokeLinecap="round" />
      </G>
      <Pencil x={348} y={158} rotate={19} />
      <Spark x={58} y={109} size={23} color={c.fieldMid} />
      <Spark x={349} y={55} size={13} color={c.coral} />
      <Circle cx={59} cy={182} r={6} fill={c.coralSoft} />
    </>
  );
}

function ProgressObjects() {
  return (
    <>
      <Path d="M-20 320 C8 243 114 242 174 301 C222 349 310 299 420 324 L420 420 H-20 Z" fill={c.coralSoft} />
      <G transform="rotate(-5 192 233)">
        <Rect x={36} y={110} width={312} height={240} rx={24} fill={c.paper} />
        <Rect x={61} y={137} width={114} height={9} rx={4.5} fill={c.midnight} />
        <Rect x={61} y={158} width={169} height={5} rx={2.5} fill={c.border} />
        <Path d="M93 227 C125 186 164 193 186 247 S250 312 289 236" fill="none" stroke={c.fieldMid} strokeWidth={14} strokeLinecap="round" />
        <Circle cx={93} cy={227} r={29} fill={c.coralSoft} />
        <Path d="M77 216 Q85 211 93 216 Q101 211 109 216 V239 Q101 234 93 239 Q85 234 77 239 Z M93 216 V239" fill={c.paper} stroke={c.coral} strokeWidth={2.5} strokeLinejoin="round" />
        <Circle cx={186} cy={247} r={29} fill={c.paperMuted} stroke={c.border} strokeWidth={2} />
        <Circle cx={179} cy={240} r={5} fill={c.field} />
        <Circle cx={193} cy={240} r={5} fill={c.field} />
        <Circle cx={179} cy={254} r={5} fill={c.field} />
        <Circle cx={193} cy={254} r={5} fill={c.field} />
        <Circle cx={289} cy={236} r={29} fill={c.coralSoft} />
        <Path d="M289 220 L294 230 L305 232 L297 240 L299 251 L289 246 L279 251 L281 240 L273 232 L284 230 Z" fill={c.coral} />
        <Path d="M65 322 H125 M160 322 H213 M255 322 H308" stroke={c.border} strokeWidth={5} strokeLinecap="round" />
      </G>
      <Spark x={70} y={67} size={24} color={c.fieldMid} />
      <Spark x={360} y={273} size={20} color={c.coral} />
      <Circle cx={153} cy={44} r={6} fill={c.coralSoft} />
    </>
  );
}

function HoursObjects() {
  return (
    <>
      <Path d="M145 400 C94 336 124 248 229 237 C322 228 355 305 420 300 L420 420 Z" fill={c.fieldMid} />
      <G transform="rotate(7 249 241)">
        <Rect x={131} y={105} width={223} height={256} rx={18} fill={c.coralSoft} />
        <Rect x={119} y={93} width={223} height={256} rx={18} fill={c.paper} />
        <Path d="M119 111 Q119 93 137 93 H324 Q342 93 342 111 V151 H119 Z" fill={c.field} />
        {[147, 183, 219, 255, 291, 321].map((x) => <Rect key={x} x={x} y={79} width={7} height={31} rx={3.5} fill={c.midnight} />)}
        {[184, 232, 280].map((y) => (
          <G key={y}>
            <Circle cx={153} cy={y} r={10} fill={c.coralSoft} />
            <Path d={`M148 ${y} L152 ${y + 4} L158 ${y - 4}`} fill="none" stroke={c.coral} strokeWidth={2.5} strokeLinecap="round" />
            <Line x1={177} y1={y - 4} x2={306} y2={y - 4} stroke={c.border} strokeWidth={6} strokeLinecap="round" />
            <Line x1={177} y1={y + 10} x2={254} y2={y + 10} stroke={c.border} strokeWidth={4} strokeLinecap="round" />
          </G>
        ))}
        <Path d="M144 320 H316" stroke={c.border} strokeWidth={2} />
      </G>
      <Circle cx={103} cy={111} r={78} fill={c.coralSoft} />
      <Circle cx={98} cy={104} r={74} fill={c.midnight} />
      <Circle cx={98} cy={104} r={62} fill={c.paper} />
      {[0, 90, 180, 270].map((rotation) => (
        <Line key={rotation} x1={98} y1={51} x2={98} y2={58} stroke={c.border} strokeWidth={4} strokeLinecap="round" transform={`rotate(${rotation} 98 104)`} />
      ))}
      <Path d="M98 65 V104 L126 122" fill="none" stroke={c.midnight} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={98} cy={104} r={6} fill={c.field} />
      <Spark x={295} y={40} size={22} color={c.fieldMid} />
      <Spark x={366} y={184} size={17} color={c.coral} />
      <Ellipse cx={79} cy={382} rx={66} ry={6} fill={c.coralSoft} />
    </>
  );
}
