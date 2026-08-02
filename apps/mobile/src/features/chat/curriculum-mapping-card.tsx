import { Text, View } from "react-native";

import { Card } from "../../components/ui/card";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import type {
  CurriculumMappingCardData,
  CurriculumMappingCardUnit,
} from "./curriculum-mapping-card-model";

function pluralUnit(kind: CurriculumMappingCardData["unitKind"], count: number): string {
  if (count === 1) return kind;
  return kind === "day" ? "days" : `${kind}s`;
}

const REVIEW_LABELS: Record<CurriculumMappingCardUnit["confidence"], string> = {
  high: "Source match: clear",
  medium: "Source match: check Homa's summary",
  low: "Source match: check the unit boundary",
};

export function CurriculumMappingCard({ card }: { card: CurriculumMappingCardData }) {
  const foundLabel =
    card.decompositionQuality === "partial"
      ? `${card.units.length} of ${card.declaredUnitCount} ${pluralUnit(card.unitKind, card.declaredUnitCount)} found`
      : `${card.units.length} ${pluralUnit(card.unitKind, card.units.length)} found`;
  const unitHeading = pluralUnit(card.unitKind, card.units.length);
  const unitHeadingLabel = `${unitHeading[0]?.toUpperCase() ?? ""}${unitHeading.slice(1)}`;
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <View style={{ backgroundColor: colors.brandSoft, padding: space.md }}>
        <Text
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.xs,
            color: colors.textMuted,
            textTransform: "uppercase",
          }}
        >
          {card.restoredFrom
            ? `Review before saving · Restored version ${card.restoredFrom}`
            : "Review before saving"}
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontFamily: fontFamilies.displaySemibold,
            fontSize: fontSize.lg,
            color: colors.textStrong,
          }}
        >
          {card.sourceTitle}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.textBody,
          }}
        >
          {foundLabel} · {card.placements.length} Planner {card.placements.length === 1 ? "addition" : "additions"}
        </Text>
        <Text
          style={{
            marginTop: space.sm,
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.sm,
            color: colors.textStrong,
          }}
        >
          This review has not changed Library or Planner.
        </Text>
      </View>

      {card.notes ? (
        <View style={{ backgroundColor: colors.goldSoft, padding: space.md }}>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              lineHeight: fontSize.sm * 1.5,
              color: colors.textBody,
            }}
          >
            <Text style={{ fontFamily: fontFamilies.bodySemibold }}>
              Homa couldn&apos;t read the whole file:{" "}
            </Text>
            {card.notes}
          </Text>
        </View>
      ) : null}

      <View style={{ padding: space.md, gap: space.lg }}>
        <View style={{ gap: space.sm }}>
          <Text
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.base,
              color: colors.textStrong,
            }}
          >
            {unitHeadingLabel}
          </Text>
          {card.units.map((unit) => (
            <View
              key={unit.ordinal}
              style={{
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                borderRadius: radius.md,
                padding: 12,
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.sm,
                  color: colors.textStrong,
                }}
              >
                {unit.unitLabel} · {unit.sourceLocator}
              </Text>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  lineHeight: fontSize.sm * 1.5,
                  color: colors.textBody,
                }}
              >
                {unit.summary}
              </Text>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.xs,
                  color: colors.textMuted,
                }}
              >
                {unit.subjectNames.join(" · ")} · {REVIEW_LABELS[unit.confidence]}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ gap: space.sm }}>
          <Text
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.base,
              color: colors.textStrong,
            }}
          >
            Planner additions
          </Text>
          {card.placements.length === 0 ? (
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                lineHeight: fontSize.sm * 1.5,
                color: colors.textMuted,
              }}
            >
              None. Saving these units will leave Planner unchanged.
            </Text>
          ) : (
            card.placements.map((placement, index) => (
              <View
                key={`${placement.unitOrdinal}:${placement.childName}:${placement.subjectName}:${placement.week}:${index}`}
                style={{ backgroundColor: colors.page, borderRadius: radius.md, padding: 12, gap: 4 }}
              >
                <Text
                  style={{
                    fontFamily: fontFamilies.bodySemibold,
                    fontSize: fontSize.sm,
                    color: colors.textStrong,
                  }}
                >
                  {placement.childName} · {placement.subjectName} · Week {placement.week} in Planner
                </Text>
                <Text
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSize.sm,
                    lineHeight: fontSize.sm * 1.5,
                    color: colors.textBody,
                  }}
                >
                  {placement.activityText}
                </Text>
                <Text
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSize.xs,
                    color: colors.textMuted,
                  }}
                >
                  From {card.sourceTitle} · {placement.unitLabel}
                  {card.units.find((unit) => unit.ordinal === placement.unitOrdinal)
                    ?.sourceLocator
                    ? ` · ${card.units.find((unit) => unit.ordinal === placement.unitOrdinal)?.sourceLocator}`
                    : ""}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={{ backgroundColor: colors.page, padding: space.md }}>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            lineHeight: fontSize.sm * 1.5,
            color: colors.textBody,
          }}
        >
          {card.placements.length === 0
            ? "Tell Homa what to change, or say “Save these units.”"
            : "Tell Homa what to change, or say “Save these units and Planner additions.”"}
        </Text>
      </View>
    </Card>
  );
}
