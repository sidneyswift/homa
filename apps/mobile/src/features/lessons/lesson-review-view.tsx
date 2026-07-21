import { useMemo, useState, type ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { Card } from "../../components/ui/card";
import type {
  LessonMedia,
  LessonRecording,
  LessonReview,
  LessonSegment,
} from "../../lib/lessons";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import {
  aboutMinute,
  MOMENT_LABELS,
  parseStoredInsights,
} from "./insights";

/**
 * The lesson review, the native twin of
 * apps/web/app/app/lessons/[lessonId]/page.tsx: summary up top,
 * tone-grounded moments with their worksheet photos, offers for next
 * time, what the lesson wrote to progress (with the verbatim excerpts),
 * the photo gallery, and the transcript behind a disclosure. Read-only
 * on purpose: retrying a failed analysis and adding photos are web
 * server actions, so this screen names the web app for both instead of
 * pretending it can do them (tool honesty).
 */

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: fontFamilies.displaySemibold,
        fontSize: fontSize.base,
        color: colors.textStrong,
      }}
    >
      {children}
    </Text>
  );
}

function BodyText({
  children,
  muted,
  small,
}: {
  children: ReactNode;
  muted?: boolean;
  small?: boolean;
}) {
  return (
    <Text
      style={{
        fontFamily: fontFamilies.body,
        fontSize: small ? fontSize.xs : fontSize.sm,
        lineHeight: (small ? fontSize.xs : fontSize.sm) * 1.45,
        color: muted ? colors.textMuted : colors.textBody,
      }}
    >
      {children}
    </Text>
  );
}

function BulletList({ lines, tone }: { lines: string[]; tone: string }) {
  return (
    <View style={{ gap: 6 }}>
      {lines.map((line) => (
        <View key={line} style={{ flexDirection: "row", gap: space.sm }}>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: tone,
            }}
          >
            {"•"}
          </Text>
          <View style={{ flex: 1 }}>
            <BodyText>{line}</BodyText>
          </View>
        </View>
      ))}
    </View>
  );
}

export function LessonReviewView({
  lesson,
  childName,
  review,
  media,
  segments,
}: {
  lesson: LessonRecording;
  childName: string;
  review: LessonReview | null;
  media: LessonMedia[];
  segments: LessonSegment[];
}) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const insights = useMemo(
    () => parseStoredInsights(review?.insights),
    [review],
  );

  // Device clock formatting; web reads family.time_zone because its
  // server renders far from the reader.
  const startedAt = new Date(lesson.startedAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const title = (
    <Text
      style={{
        fontFamily: fontFamilies.display,
        fontSize: fontSize.xl,
        lineHeight: fontSize.xl * 1.2,
        color: colors.textStrong,
      }}
    >
      {childName}&apos;s lesson from {startedAt}
    </Text>
  );

  if (lesson.status !== "ready") {
    const transcribed = segments.filter(
      (segment) => segment.transcript !== null,
    ).length;
    return (
      <View style={{ gap: space.md }}>
        {title}
        {lesson.status === "failed" ? (
          <Card style={{ gap: space.sm }}>
            <Text
              style={{
                fontFamily: fontFamilies.displaySemibold,
                fontSize: fontSize.lg,
                color: colors.textStrong,
              }}
            >
              Homa couldn&apos;t finish this one.
            </Text>
            <BodyText>
              This was not anything you did. The recording is safe and nothing
              was lost. You can have Homa listen again from the web app.
            </BodyText>
          </Card>
        ) : (
          <Card style={{ gap: space.sm }}>
            <Text
              style={{
                fontFamily: fontFamilies.displaySemibold,
                fontSize: fontSize.lg,
                color: colors.textStrong,
              }}
            >
              Homa is listening back through the lesson.
            </Text>
            <BodyText muted>
              {segments.length > 0
                ? `Listened through about ${transcribed * 3} of ${segments.length * 3} minutes so far.`
                : "Getting the recording ready."}
            </BodyText>
            <BodyText muted small>
              This screen updates by itself. Leaving is fine. The review will
              be here when you come back.
            </BodyText>
          </Card>
        )}
      </View>
    );
  }

  if (!review) {
    return (
      <View style={{ gap: space.md }}>
        {title}
        <Card>
          <BodyText>
            The review is done, it just didn&apos;t load this time. Pulling
            this screen up again will retry.
          </BodyText>
        </Card>
      </View>
    );
  }

  const ledgerNotes = insights.progressNotes.filter(
    (note) => note.outcome === "evidence" || note.outcome === "conflict",
  );
  const observationNotes = insights.progressNotes.filter(
    (note) => note.outcome === "observation",
  );
  const mediaBySeq = new Map(
    media
      .filter((item) => item.capturedDuringSeq !== null)
      .map((item) => [item.capturedDuringSeq as number, item]),
  );
  const transcribedSegments = segments.filter(
    (segment) => segment.transcript !== null,
  );

  return (
    <View style={{ gap: space.md }}>
      {title}
      {lesson.durationSeconds ? (
        <BodyText muted>
          {Math.max(1, Math.round(lesson.durationSeconds / 60))} minutes
          together
        </BodyText>
      ) : null}

      <View
        accessibilityLabel="How it went"
        style={{
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          backgroundColor: colors.sageSoft,
          padding: space.md + 4,
          gap: space.sm,
        }}
      >
        <BodyText>{review.summary}</BodyText>
        {insights.siblingNote ? (
          <BodyText muted>{insights.siblingNote}</BodyText>
        ) : null}
      </View>

      {insights.moments.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.lg,
              color: colors.textStrong,
            }}
          >
            Moments from the lesson
          </Text>
          {insights.moments.map((moment, index) => {
            const photo = mediaBySeq.get(moment.segmentSeq);
            return (
              <Card
                key={`${moment.segmentSeq}-${index}`}
                style={{ padding: space.md, gap: 4 }}
              >
                <Text
                  style={{
                    fontFamily: fontFamilies.bodyMedium,
                    fontSize: fontSize.xs,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    color: colors.textMuted,
                  }}
                >
                  {MOMENT_LABELS[moment.kind] ?? moment.kind} {"·"}{" "}
                  {aboutMinute(moment.segmentSeq)}
                </Text>
                <Text
                  style={{
                    fontFamily: fontFamilies.bodyMedium,
                    fontSize: fontSize.base,
                    color: colors.textStrong,
                  }}
                >
                  {moment.headline}
                </Text>
                <BodyText>{moment.detail}</BodyText>
                {photo ? (
                  <Image
                    source={{ uri: photo.blobUrl }}
                    accessibilityLabel={
                      photo.caption ?? "A photo from this lesson"
                    }
                    style={{
                      marginTop: space.sm,
                      width: "100%",
                      height: 224,
                      borderRadius: radius.xs,
                      borderWidth: 1,
                      borderColor: colors.borderSubtle,
                    }}
                    resizeMode="contain"
                  />
                ) : null}
              </Card>
            );
          })}
        </View>
      ) : null}

      {insights.whatWorked.length > 0 ? (
        <Card style={{ padding: space.md + 4, gap: space.sm }}>
          <SectionTitle>What worked</SectionTitle>
          <BulletList lines={insights.whatWorked} tone={colors.sage} />
        </Card>
      ) : null}
      {insights.friction.length > 0 ? (
        <Card style={{ padding: space.md + 4, gap: space.sm }}>
          <SectionTitle>Where it dragged</SectionTitle>
          <BulletList lines={insights.friction} tone={colors.textMuted} />
        </Card>
      ) : null}

      {insights.nextTime.length > 0 ? (
        <Card style={{ padding: space.md + 4, gap: space.sm }}>
          <SectionTitle>Ideas for next time</SectionTitle>
          <BulletList lines={insights.nextTime} tone={colors.brand} />
          {insights.openQuestions.length > 0 ? (
            <BodyText muted small>
              Homa wasn&apos;t sure about: {insights.openQuestions.join(" ")}
            </BodyText>
          ) : null}
        </Card>
      ) : null}

      {ledgerNotes.length > 0 || observationNotes.length > 0 ? (
        <Card style={{ padding: space.md + 4, gap: space.sm }}>
          <SectionTitle>
            {`What this lesson added to ${childName}'s progress`}
          </SectionTitle>
          {ledgerNotes.length > 0 ? (
            <View style={{ gap: space.sm }}>
              {ledgerNotes.map((note) => (
                <View key={note.clause} style={{ gap: 2 }}>
                  <BodyText>{note.clause}</BodyText>
                  <BodyText muted small>
                    From the lesson, {aboutMinute(note.segmentSeq)}: {"“"}
                    {note.excerpt}
                    {"”"}
                  </BodyText>
                </View>
              ))}
            </View>
          ) : null}
          {observationNotes.length > 0 ? (
            <BodyText muted small>
              Homa also saved {observationNotes.length} smaller{" "}
              {observationNotes.length === 1 ? "moment" : "moments"} to{" "}
              {childName}&apos;s progress, ready to build on this week.
            </BodyText>
          ) : null}
          <BodyText muted small>
            Something look off? Tell Homa in chat and she&apos;ll fix it.
          </BodyText>
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        <SectionTitle>Photos from this lesson</SectionTitle>
        {media.length > 0 ? (
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm + 4 }}
          >
            {media.map((item) => (
              <Image
                key={item.id}
                source={{ uri: item.blobUrl }}
                accessibilityLabel={item.caption ?? "A photo from this lesson"}
                style={{
                  height: 112,
                  width: 112,
                  borderRadius: radius.xs,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                }}
                resizeMode="cover"
              />
            ))}
          </View>
        ) : (
          <BodyText muted>
            No photos are with this lesson yet. You can add worksheet photos
            from the web app and they will show up here.
          </BodyText>
        )}
      </View>

      <Card style={{ padding: space.md + 4, gap: space.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: transcriptOpen }}
          onPress={() => setTranscriptOpen((open) => !open)}
        >
          <Text
            style={{
              fontFamily: fontFamilies.bodyMedium,
              fontSize: fontSize.sm,
              color: colors.textBody,
            }}
          >
            {transcriptOpen
              ? "Hide the transcript"
              : "Read the whole transcript"}
          </Text>
        </Pressable>
        {transcriptOpen ? (
          <View style={{ gap: space.md }}>
            {transcribedSegments.map((segment) => (
              <View key={segment.id} style={{ gap: 4 }}>
                <Text
                  style={{
                    fontFamily: fontFamilies.bodyMedium,
                    fontSize: fontSize.xs,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    color: colors.textMuted,
                  }}
                >
                  {aboutMinute(segment.seq)}
                </Text>
                <BodyText>{segment.transcript}</BodyText>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </View>
  );
}
