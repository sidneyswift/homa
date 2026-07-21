import { router } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "../../components/ui/button";
import { openWebOnboarding } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, pressScale, radius, space } from "../../theme/tokens";
import {
  binderCover,
  filterMaterials,
  isDefaultFilter,
  KIND_LABELS,
  kindOptions,
  noResultsMessage,
  subjectOptions,
  type BinderFilter,
  type BinderMaterial,
} from "./binder-model";
import { BinderTile } from "./binder-tile";
import { MaterialDetailSheet } from "./material-detail-sheet";
import { useBinderData } from "./use-binder-data";

/**
 * The Binder screen, the native twin of
 * apps/web/app/app/binder/binder-view.tsx: the calm "this week" cover
 * as the default landing, with search and filter chips underneath for
 * whenever a parent is actively narrowing. One difference from web:
 * there is no family/child view-context switcher on mobile yet, so the
 * copy always speaks to the whole family.
 */

const COVER_COUNT = 3;

/** Free-text subjects could sprawl; past this the search box does the tail. */
const MAX_SUBJECT_CHIPS = 10;

/**
 * The kinds a brand-new binder previews in its empty state, spelled by
 * the surface's one kind vocabulary (web's editor gate: no second
 * inflection).
 */
const EMPTY_STATE_PREVIEW = [
  KIND_LABELS.worksheet,
  KIND_LABELS.coloring,
  KIND_LABELS.flashcards,
  KIND_LABELS.reader,
  KIND_LABELS.game,
];

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        justifyContent: "center",
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.brandSoft : colors.border,
        backgroundColor: active ? colors.brandSoft : colors.card,
        paddingHorizontal: 14,
        paddingVertical: 6,
        transform: [{ scale: pressed ? pressScale : 1 }],
      })}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodyBold,
          fontSize: fontSize.xs,
          color: active ? colors.brandHover : colors.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChipRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: space.sm,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodyBold,
          fontSize: 10,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: colors.textSubtle,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function CoverGrid({
  items,
  onOpen,
}: {
  items: BinderMaterial[];
  onOpen: (material: BinderMaterial) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
      {items.map((material) => (
        <View key={material.id} style={{ width: "47%" }}>
          <BinderTile material={material} onOpen={onOpen} />
        </View>
      ))}
    </View>
  );
}

export function BinderView() {
  const { hasFamily, materials, nowMs, loading, error, reload } =
    useBinderData();
  const [filter, setFilter] = useState<BinderFilter>({
    kind: null,
    subject: null,
    query: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const kinds = useMemo(() => kindOptions(materials), [materials]);
  const subjects = useMemo(
    () => subjectOptions(materials).slice(0, MAX_SUBJECT_CHIPS),
    [materials],
  );
  const filtered = useMemo(
    () => filterMaterials(materials, filter),
    [materials, filter],
  );
  const showCover = materials.length > 0 && isDefaultFilter(filter);
  const cover = useMemo(
    () =>
      showCover
        ? binderCover(materials, nowMs, COVER_COUNT)
        : { eyebrow: "", heading: "", items: [] },
    [materials, showCover, nowMs],
  );
  const coverIds = useMemo(
    () => new Set(cover.items.map((item) => item.id)),
    [cover],
  );
  const gridItems = showCover
    ? filtered.filter((item) => !coverIds.has(item.id))
    : filtered;
  const selected = materials.find((item) => item.id === selectedId) ?? null;

  const activeSubject =
    subjects.find((subject) => subject.key === filter.subject) ?? null;
  const sectionTitle = showCover
    ? "Everything else"
    : filter.query.trim()
      ? "Search results"
      : filter.kind
        ? KIND_LABELS[filter.kind]
        : activeSubject
          ? activeSubject.label
          : "In your Binder";

  if (loading) {
    return (
      <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />
    );
  }

  if (error) {
    return (
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            color: colors.textBody,
          }}
        >
          Everything you kept is safe; the Binder just didn&apos;t load this
          time.
        </Text>
        <Button
          label="Try again"
          variant="secondary"
          onPress={() => void reload()}
          style={{ alignSelf: "flex-start" }}
        />
      </View>
    );
  }

  if (!hasFamily) {
    return (
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            color: colors.textBody,
          }}
        >
          Once your family is set up, everything you keep lands here. Start
          with the web onboarding.
        </Text>
        <Button
          label="Open onboarding"
          onPress={() => void openWebOnboarding()}
          style={{ alignSelf: "flex-start" }}
        />
      </View>
    );
  }

  if (materials.length === 0) {
    return (
      <View style={{ padding: space.lg }}>
        <View
          style={{
            borderStyle: "dashed",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.xl,
            backgroundColor: colors.card,
            padding: space.xl,
            alignItems: "center",
            gap: space.sm,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.lg,
              color: colors.textStrong,
            }}
          >
            Nothing kept yet.
          </Text>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textMuted,
              textAlign: "center",
            }}
          >
            When you tell Homa that something she made is a keeper, it lands
            here on its own.
          </Text>
          <View
            style={{
              marginTop: space.sm,
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: space.sm,
            }}
          >
            {EMPTY_STATE_PREVIEW.map((label) => (
              <View
                key={label}
                style={{
                  borderStyle: "dashed",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.pill,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontFamilies.bodyBold,
                    fontSize: fontSize.xs,
                    color: colors.textSubtle,
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
          <Text
            style={{
              marginTop: space.sm,
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textMuted,
            }}
          >
            Your first one starts in chat.
          </Text>
          <Button
            label="Ask HOMA"
            onPress={() => router.push("/chat")}
            style={{ marginTop: space.xs }}
          />
        </View>
      </View>
    );
  }

  const header = (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 6 }}>
        <Text
          style={{
            fontFamily: fontFamilies.bodyBold,
            fontSize: 11,
            letterSpacing: 1.8,
            textTransform: "uppercase",
            color: colors.textSubtle,
          }}
        >
          Kept to use again
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSize.xxl,
            lineHeight: fontSize.xxl * 1.1,
            color: colors.textStrong,
          }}
        >
          Binder
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.textMuted,
          }}
        >
          Everything your family keeps, in one place to browse and print.
        </Text>
      </View>

      <TextInput
        value={filter.query}
        onChangeText={(query) =>
          setFilter((current) => ({ ...current, query }))
        }
        placeholder="Search the Binder"
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel="Search the Binder"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={{
          minHeight: 44,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: space.md,
          paddingVertical: 10,
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          color: colors.textBody,
        }}
      />

      {kinds.length > 1 ? (
        <ChipRow label="Type">
          <Chip
            label="All"
            active={filter.kind === null}
            onPress={() => setFilter((current) => ({ ...current, kind: null }))}
          />
          {kinds.map((kind) => (
            <Chip
              key={kind}
              label={KIND_LABELS[kind]}
              active={filter.kind === kind}
              onPress={() => setFilter((current) => ({ ...current, kind }))}
            />
          ))}
        </ChipRow>
      ) : null}

      {subjects.length > 1 ? (
        <ChipRow label="Subject">
          <Chip
            label="All"
            active={filter.subject === null}
            onPress={() =>
              setFilter((current) => ({ ...current, subject: null }))
            }
          />
          {subjects.map((subject) => (
            <Chip
              key={subject.key}
              label={subject.label}
              active={filter.subject === subject.key}
              onPress={() =>
                setFilter((current) => ({ ...current, subject: subject.key }))
              }
            />
          ))}
        </ChipRow>
      ) : null}

      {showCover && cover.items.length > 0 ? (
        <View
          style={{
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.card,
            padding: space.md + 4,
            gap: space.sm,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.bodyBold,
              fontSize: 10,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: colors.textSubtle,
            }}
          >
            {cover.eyebrow}
          </Text>
          <Text
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.lg,
              color: colors.textStrong,
            }}
          >
            {cover.heading}
          </Text>
          <CoverGrid items={cover.items} onOpen={(item) => setSelectedId(item.id)} />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: space.sm,
          marginTop: space.xs,
        }}
      >
        <Text
          style={{
            fontFamily: fontFamilies.displaySemibold,
            fontSize: fontSize.lg,
            color: colors.textStrong,
          }}
        >
          {sectionTitle}
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.xs,
            color: colors.textSubtle,
          }}
        >
          {gridItems.length} {gridItems.length === 1 ? "thing" : "things"}
        </Text>
      </View>
    </View>
  );

  return (
    <>
      <FlatList
        data={gridItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        keyboardShouldPersistTaps="handled"
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{
          padding: space.lg,
          paddingTop: space.sm,
          paddingBottom: space.xxl,
          gap: space.md,
        }}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          // maxWidth keeps the last odd item at tile width instead of
          // stretching across both columns.
          <View style={{ flex: 1, maxWidth: "48.5%" }}>
            <BinderTile material={item} onOpen={(m) => setSelectedId(m.id)} />
          </View>
        )}
        ListEmptyComponent={
          <View
            style={{
              borderStyle: "dashed",
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              backgroundColor: colors.card,
              padding: space.lg,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              {noResultsMessage(filter)}
            </Text>
          </View>
        }
      />
      {selected ? (
        <MaterialDetailSheet
          material={selected}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </>
  );
}
