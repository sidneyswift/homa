import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { Icon } from "../../components/design/icon";
import { InlineError } from "../../components/ui/inline-error";
import { LoadingStatus } from "../../components/ui/loading-status";
import {
  binderCover,
  filterMaterials,
  isDefaultFilter,
  kindOptions,
  KIND_LABELS,
  noResultsMessage,
  subjectOptions,
  toBinderMaterials,
  type BinderFilter,
  type BinderMaterial,
} from "../../features/binder/binder-model";
import { InProgressCard } from "../../features/binder/in-progress-card";
import { MaterialDetailModal } from "../../features/binder/material-detail-modal";
import { MaterialGridCard } from "../../features/binder/material-grid-card";
import { useBinderData } from "../../features/binder/use-binder-data";
import { useFamilyData } from "../../features/family/use-family-data";
import { useVoiceWorkbench } from "../../features/voice/voice-workbench-provider";
import { keepMaterial } from "../../lib/materials";
import type { StateRecordDocument } from "../../lib/state-records";
import { fontFamilies , colors, fontSize, radius, space } from "../../theme/app2";
import { StateRecordsCard } from "../../features/state-records/state-records-card";

const COVER_COUNT = 3;

/**
 * Binder: every worksheet, coloring page, or other material Homa has
 * made, ported from apps/web/app/app/binder/{page,binder-view}.tsx.
 * The state-record card above the material grid is a separate legal-record
 * surface, backed by the server's reviewed requirements and append-only
 * packet history. Still scoped out of this v1: the general materials
 * VersionRail ("earlier tries" on a detail card), and per-child
 * view-context scoping (mobile has no equivalent session state yet;
 * the whole family's binder shows, same precedent Hours already set).
 *
 * The in-progress shelf is not optional polish: fleet-wide, only
 * 41-59% of revision chains ever reach final (gh#348), so a Binder
 * that only shows finals can look completely empty despite Homa
 * having made real things for that family.
 */
export default function BinderScreen() {
  const router = useRouter();
  const { family, children, loading: familyLoading } = useFamilyData();
  const { finalMaterials, inProgressMaterials, loading, error, reload } = useBinderData(family?.id ?? null);
  const [filter, setFilter] = useState<BinderFilter>({ kind: null, subject: null, query: "" });
  const [openMaterial, setOpenMaterial] = useState<BinderMaterial | null>(null);
  const [keepingId, setKeepingId] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const { showActiveObject, clearActiveObject } = useVoiceWorkbench();

  const materials = useMemo(() => toBinderMaterials(finalMaterials, children), [finalMaterials, children]);
  const inProgress = useMemo(() => toBinderMaterials(inProgressMaterials, children), [inProgressMaterials, children]);
  const kinds = kindOptions(materials);
  const subjects = subjectOptions(materials);
  const filtered = filterMaterials(materials, filter);
  const showCover = isDefaultFilter(filter) && materials.length > COVER_COUNT;
  const cover = showCover ? binderCover(materials, nowMs, COVER_COUNT) : null;
  const gridMaterials = cover ? filtered.filter((material) => !cover.items.some((item) => item.id === material.id)) : filtered;

  useEffect(() => {
    if (!openMaterial) return;
    const reference = {
      kind: "material" as const,
      objectId: openMaterial.id,
      version: openMaterial.createdAt,
    };
    return () => clearActiveObject(reference);
  }, [clearActiveObject, openMaterial]);

  async function handleKeep(materialId: string) {
    if (!family) return;
    setKeepingId(materialId);
    await keepMaterial(family.id, materialId);
    setKeepingId(null);
    void reload();
  }

  function openStateRecord(document: StateRecordDocument) {
    openMaterialDetail({
      id: document.id,
      title: document.title,
      kind: "packet",
      subject: document.type === "pack" ? "State pack" : "State filing",
      theme: null,
      skill: null,
      childId: null,
      childName: null,
      previewUrl: document.previewUrl,
      pdfUrl: document.pdfUrl,
      createdAt: document.createdAt,
      pageCount: document.pageCount,
      pagePreviewUrls: null,
    });
  }

  function openMaterialDetail(material: BinderMaterial) {
    showActiveObject({
      kind: "material",
      objectId: material.id,
      version: material.createdAt,
    });
    setOpenMaterial(material);
  }

  function closeMaterialDetail() {
    if (openMaterial) {
      clearActiveObject({
        kind: "material",
        objectId: openMaterial.id,
        version: openMaterial.createdAt,
      });
    }
    setOpenMaterial(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.md }}
        // The pull spinner only while pages are on screen; the first load
        // has its own named loader below (2026-11-03 walk, gh#1236).
        refreshControl={<RefreshControl refreshing={loading && materials.length > 0} onRefresh={() => void reload()} />}
      >
        {/* The App 2 top bar already titles this screen "Binder" (and
            carries the header role), so the screen opens on what it
            holds rather than saying "Binder" twice (2026-11-03 walk). */}
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
          Every worksheet, coloring page, or other material Homa has made.
        </Text>

        {familyLoading || (loading && materials.length === 0) ? (
          <View style={{ paddingVertical: space.xl, alignItems: "center" }}>
            <LoadingStatus label="Loading your binder" />
          </View>
        ) : null}

        {error ? <InlineError message="That didn't load. Pull down to try again." /> : null}

        {!familyLoading && family ? (
          <StateRecordsCard onOpenDocument={openStateRecord} />
        ) : null}

        {inProgress.length > 0 ? (
          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
              Still in progress
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {inProgress.map((material) => (
                <InProgressCard
                  key={material.id}
                  material={material}
                  keeping={keepingId === material.id}
                  onOpen={() => openMaterialDetail(material)}
                  onKeep={() => void handleKeep(material.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {materials.length > 0 ? (
          <TextInput
            value={filter.query}
            accessibilityLabel="Search your binder"
            accessibilityHint="Filters materials by title, subject, theme, or skill"
            onChangeText={(query) => setFilter((current) => ({ ...current, query }))}
            placeholder="Search your binder"
            placeholderTextColor={colors.textMuted}
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.sm,
              minHeight: 48,
              padding: space.sm,
            }}
          />
        ) : null}

        {kinds.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            <FilterChip
              label="All"
              accessibilityLabel="Filter material type: All"
              active={filter.kind === null}
              onPress={() => setFilter((current) => ({ ...current, kind: null }))}
            />
            {kinds.map((kind) => (
              <FilterChip
                key={kind}
                label={KIND_LABELS[kind]}
                accessibilityLabel={`Filter material type: ${KIND_LABELS[kind]}`}
                active={filter.kind === kind}
                onPress={() => setFilter((current) => ({ ...current, kind: current.kind === kind ? null : kind }))}
              />
            ))}
          </ScrollView>
        ) : null}

        {subjects.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            <FilterChip
              label="All subjects"
              accessibilityLabel="Filter by subject: All subjects"
              active={filter.subject === null}
              onPress={() => setFilter((current) => ({ ...current, subject: null }))}
            />
            {subjects.map((subject) => (
              <FilterChip
                key={subject.key}
                label={subject.label}
                accessibilityLabel={`Filter by subject: ${subject.label}`}
                active={filter.subject === subject.key}
                onPress={() =>
                  setFilter((current) => ({ ...current, subject: current.subject === subject.key ? null : subject.key }))
                }
              />
            ))}
          </ScrollView>
        ) : null}

        {!loading && !error && materials.length === 0 ? (
          <View style={{ paddingVertical: space.xl, alignItems: "center", gap: space.md }}>
            <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
              Nothing kept yet.
            </Text>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center" }}>
              Your first one starts in chat.
            </Text>
            <Button label="Ask Homa" onPress={() => router.push("/chat")} />
          </View>
        ) : null}

        {materials.length > 0 && filtered.length === 0 ? (
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
            {noResultsMessage(filter)}
          </Text>
        ) : null}

        {cover ? (
          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
              {cover.heading}
            </Text>
            <MaterialGrid materials={cover.items} onSelect={openMaterialDetail} />
          </View>
        ) : null}

        {gridMaterials.length > 0 ? <MaterialGrid materials={gridMaterials} onSelect={openMaterialDetail} /> : null}
      </ScrollView>

      <MaterialDetailModal material={openMaterial} onClose={closeMaterialDetail} />
    </SafeAreaView>
  );
}

function MaterialGrid({ materials, onSelect }: { materials: BinderMaterial[]; onSelect: (material: BinderMaterial) => void }) {
  const { fontScale } = useWindowDimensions();
  const columns = fontScale >= 1.4 ? 1 : 2;
  const rows: BinderMaterial[][] = [];
  for (let index = 0; index < materials.length; index += columns) {
    rows.push(materials.slice(index, index + columns));
  }
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((row) => (
        <View key={row[0].id} style={{ flexDirection: "row", gap: space.sm }}>
          {row.map((material) => (
            <MaterialGridCard key={material.id} material={material} onPress={() => onSelect(material)} />
          ))}
          {columns === 2 && row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

function FilterChip({
  label,
  accessibilityLabel,
  active,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.xs,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.brandSoft : colors.card,
        borderWidth: 1,
        borderColor: active ? colors.brandHover : colors.borderSubtle,
      }}
    >
      {active ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name="check" size={16} color={colors.textStrong} />
        </View>
      ) : null}
      <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.xs, color: active ? colors.textStrong : colors.textMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}
