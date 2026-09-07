/**
 * Monday's page, sample-stamped. No archived first-making preview exists
 * anywhere in this repo to stand in here (confirmed by research before
 * writing this file), and a photoreal fake risks being read as a real
 * generated page. This is a plainly illustrated mock instead: honest
 * about being a sample, styled to the lab's own visual system, never
 * claiming to be the actual page materials-studio would draw from her
 * real answers.
 */
import Svg, { Circle, Line, Rect, Path } from "react-native-svg";
import { View } from "react-native";

import { NativeText } from "../../components/ui/semantic";
import { v2Colors, v2Radii, v2Space, v2Type } from "./theme";

export function MondayPage({ childName, subjectName }: { childName: string; subjectName: string }) {
  return (
    <View
      style={{
        backgroundColor: v2Colors.paper,
        borderRadius: v2Radii.card,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: v2Colors.border,
        padding: v2Space.lg,
        gap: v2Space.md,
      }}
    >
      <View
        style={{
          alignSelf: "flex-start",
          backgroundColor: v2Colors.coralSoft,
          borderRadius: v2Radii.pill,
          paddingHorizontal: v2Space.sm,
          paddingVertical: 4,
        }}
      >
        <NativeText style={[v2Type.caption, { color: v2Colors.coral, fontSize: 12 }]}>Sample page, not the real one</NativeText>
      </View>

      <View style={{ alignItems: "center", paddingVertical: v2Space.md }}>
        <Svg width={160} height={120} viewBox="0 0 160 120">
          <Rect x={4} y={4} width={152} height={112} rx={12} fill={v2Colors.page} stroke={v2Colors.border} strokeWidth={2} />
          <Line x1={20} y1={30} x2={100} y2={30} stroke={v2Colors.inkMuted} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={30} cy={60} r={8} fill={v2Colors.coral} />
          <Circle cx={55} cy={60} r={8} fill={v2Colors.fieldMid} />
          <Circle cx={80} cy={60} r={8} fill={v2Colors.coral} />
          <Circle cx={105} cy={60} r={8} fill={v2Colors.fieldMid} />
          <Circle cx={130} cy={60} r={8} fill={v2Colors.coral} />
          <Path
            d="M20 90 h30 M60 90 h30 M100 90 h30"
            stroke={v2Colors.border}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Svg>
      </View>

      <NativeText style={[v2Type.hero, { color: v2Colors.ink }]}>{`Made for ${childName}. Nobody else.`}</NativeText>
      <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>{subjectName}</NativeText>
    </View>
  );
}
