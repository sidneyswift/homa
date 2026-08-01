import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
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
import { keepMaterial } from "../../lib/materials";
import type { StateRecordDocument } from "../../lib/state-records";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
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

  const materials = useMemo(() => toBinderMaterials(finalMaterials, children), [finalMaterials, children]);
  const inProgress = useMemo(() => toBinderMaterials(inProgressMaterials, children), [inProgressMaterials, children]);
  const kinds = kindOptions(materials);
  const subjects = subjectOptions(materials);
  const filtered = filterMaterials(materials, filter);
  const showCover = isDefaultFilter(filter) && materials.length > COVER_COUNT;
  const cover = showCover ? binderCover(materials, nowMs, COVER_COUNT) : null;
  const gridMaterials = cover ? filtered.filter((material) => !cover.items.some((item) => item.id === material.id)) : filtered;

  async function handleKeep(materialId: string) {
    if (!family) return;
    setKeepingId(materialId);
    await keepMaterial(family.id, materialId);
    setKeepingId(null);
    void reload();
  }

  function openStateRecord(document: StateRecordDocument) {
    setOpenMaterial({
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.md }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} />}
      >
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong }}>
            Binder
          </Text>
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
            Every worksheet, coloring page, or other material Homa has made.
          </Text>
        </View>

        {familyLoading || (loading && materials.length === 0) ? (
          <View style={{ paddingVertical: space.xl, alignItems: "center" }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : null}

        {error ? (
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.danger }}>
            {"That didn't load. Pull down to try again."}
          </Text>
        ) : null}

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
                  onKeep={() => void handleKeep(material.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {materials.length > 0 ? (
          <TextInput
            value={filter.query}
            onChangeText={(query) => setFilter((current) => ({ ...current, query }))}
            placeholder="Search your binder"
            placeholderTextColor={colors.textSubtle}
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.sm,
              padding: space.sm,
            }}
          />
        ) : null}

        {kinds.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            <FilterChip
              label="All"
              active={filter.kind === null}
              onPress={() => setFilter((current) => ({ ...current, kind: null }))}
            />
            {kinds.map((kind) => (
              <FilterChip
                key={kind}
                label={KIND_LABELS[kind]}
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
              active={filter.subject === null}
              onPress={() => setFilter((current) => ({ ...current, subject: null }))}
            />
            {subjects.map((subject) => (
              <FilterChip
                key={subject.key}
                label={subject.label}
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
            <MaterialGrid materials={cover.items} onSelect={setOpenMaterial} />
          </View>
        ) : null}

        {gridMaterials.length > 0 ? <MaterialGrid materials={gridMaterials} onSelect={setOpenMaterial} /> : null}
      </ScrollView>

      <MaterialDetailModal material={openMaterial} onClose={() => setOpenMaterial(null)} />
    </SafeAreaView>
  );
}

function MaterialGrid({ materials, onSelect }: { materials: BinderMaterial[]; onSelect: (material: BinderMaterial) => void }) {
  const rows: BinderMaterial[][] = [];
  for (let index = 0; index < materials.length; index += 2) {
    rows.push(materials.slice(index, index + 2));
  }
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((row) => (
        <View key={row[0].id} style={{ flexDirection: "row", gap: space.sm }}>
          {row.map((material) => (
            <MaterialGridCard key={material.id} material={material} onPress={() => onSelect(material)} />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.brandSoft : colors.card,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.borderSubtle,
      }}
    >
      <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.xs, color: active ? colors.brandHover : colors.textMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}
