import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import {
  blobConfigured,
  insertMaterialRowPinned,
  isFamilyArtifactUrl,
  MATERIAL_KINDS,
  uploadMaterialArtifacts,
  type MaterialKind,
  type MaterialSource,
} from "../../lib/materials/artifact-store";
import { reviewArtifact } from "../../lib/materials/review-artifact";
import {
  printableSlug,
  validatePrintableHtml,
  wrapImagePage,
  wrapPrintablePage,
} from "../../lib/materials/page-shell";
import {
  RendererUnavailableError,
  renderPrintableHtml,
  SUBJECT_LESSON_RENDER_POLICY,
} from "../../lib/materials/render-page";
import { usageChannelFromAttributes } from "../../lib/model-usage";
import { sendSmsProgressTextOnce } from "../../lib/sms-progress";
import { readSubjectLessonTrustedContext } from "../../lib/subject-lessons/dispatch-input";
import { claimSubjectLessonWorksheetEffectPinned } from "../../lib/subject-lessons/store";
import { resolveSubjectLessonWorksheetEffect } from "../../lib/subject-lessons/worksheet-effect";
import { sendHomaSms } from "../../lib/voice/telnyx-api";

/**
 * The materials studio's press (MS-2/MS-3, replacing create_worksheet):
 * turns a page the model designed into the real artifact the parent
 * holds. Two creation paths through one pipeline: `html` (the model
 * composed the page) or `pageImageUrl` (the image model drew the whole
 * page; generate_image made the URL). Either way: letter PDF + JPEG
 * preview via Chromium, bytes to Blob, a materials row with metadata and
 * lineage, a vision review before delivery, and on SMS the artifacts
 * texted straight back.
 *
 * No template on purpose (founder rulings 2026-07-09/10): layout, style,
 * characters, difficulty, and PATH are the model's to choose per child.
 * Code owns tenancy, the brand-law gate, the D7 footer, and the review
 * gate on delivery. No daily materials cap on purpose (founder ruling
 * 2026-07-12, "no 20 a day cap"): series like an A-to-Z worksheet set
 * must build without an artificial stop; usage stays visible through
 * the model_usage ledger.
 */

export const createPrintableInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(90)
    .describe("Short name for the material, e.g. 'Skye's Big O Practice'."),
  kind: z
    .enum(MATERIAL_KINDS)
    .optional()
    .describe("What this is. Defaults to 'worksheet'."),
  skill: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("What it practices, e.g. 'letter O tracing'."),
  subject: z
    .string()
    .trim()
    .max(80)
    .optional()
    .describe("The school subject, e.g. 'handwriting', 'math'."),
  curriculum: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("The curriculum style it follows, e.g. 'Handwriting Without Tears', when the family uses one."),
  theme: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("The personalization hook, e.g. 'Paw Patrol rescue'."),
  characters: z
    .array(z.string().trim().min(1).max(60))
    .max(6)
    .optional()
    .describe("Named characters on the page, e.g. ['Skye']. Spell them the way the family does."),
  childId: z
    .uuid()
    .optional()
    .describe("The child it is for (id from the family context block). Omit for family-wide material."),
  childName: z
    .string()
    .trim()
    .max(60)
    .optional()
    .describe("The child's first name exactly as the family context spells it; printed in the tiny footer."),
  html: z
    .string()
    .min(40)
    .max(100_000)
    .optional()
    .describe(
      "PATH 1: the COMPLETE page content as HTML with its own <style> block (Google Fonts <link>s welcome). Placed inside a letter-size shell that owns @page and the footer. Design for 8.5x11in portrait. No <script>.",
    ),
  pageImageUrl: z
    .string()
    .optional()
    .describe(
      "PATH 2: a generate_image URL of the ENTIRE page (use shape 'portrait'). The shell fits it to letter size. Provide exactly one of html or pageImageUrl.",
    ),
  revisesId: z
    .uuid()
    .optional()
    .describe("When this is a revision, the id of the version it replaces (from the earlier create result). Keeps the version chain intact."),
  requestSummary: z
    .string()
    .trim()
    .max(600)
    .optional()
    .describe("One or two sentences of what the parent actually asked for, used by the automatic quality check."),
});

export type CreatePrintableInput = z.infer<
  typeof createPrintableInputSchema
>;

export interface PrintableGenerationInput {
  title: string;
  kind: MaterialKind;
  skill: string | null;
  subject: string | null;
  curriculum: string | null;
  theme: string | null;
  characters: string[];
  childName: string | null;
  requestSummary: string | null;
  revisesId: string | null;
  path: "html" | "pageImageUrl";
  lessonId?: string;
}

export function subjectLessonPrintableRestriction(
  input: CreatePrintableInput,
  attributes: unknown,
): string | null {
  const trustedLesson = readSubjectLessonTrustedContext(attributes);
  if (!trustedLesson) return null;
  const kind = input.kind ?? "worksheet";
  const hasNavigationMarkup =
    typeof input.html === "string"
    && (
      /<(?:base|iframe|frame|frameset|portal)(?:\s|>)/iu.test(input.html)
      || /<meta\b(?=[^>]*\bhttp-equiv\s*=\s*["']?\s*refresh\b)[^>]*>/iu
        .test(input.html)
    );
  const isHtmlOnly =
    typeof input.html === "string"
    && input.pageImageUrl === undefined
    && !hasNavigationMarkup
    && !/<(?:img|image|picture|source|object|embed|video)(?:\s|>)/iu.test(
      input.html,
    )
    && !/\burl\s*\(/iu.test(input.html)
    && !/\bdata:image\//iu.test(input.html)
    && !/\btype\s*=\s*["']image["']/iu.test(input.html)
    && !/\bposter\s*=\s*["'][^"']+["']/iu.test(input.html);
  return (
    kind === "worksheet"
    && input.childId === trustedLesson.childId
    && input.childName === trustedLesson.childName
    && input.subject === trustedLesson.subjectId
    && input.skill === trustedLesson.targetStatement
    && isHtmlOnly
  )
    ? null
    : "Use an HTML-only subject lesson worksheet with the exact trusted child, subject, and target using the canonical subject ID, without image or navigation markup, CSS url(...), or pageImageUrl.";
}

/**
 * Produces the durable, HTML-free input receipt. A lesson id may enter only
 * through a fully validated subject lesson session, never through tool input.
 */
export function buildPrintableGenerationInput(
  input: CreatePrintableInput,
  path: "html" | "pageImageUrl",
  attributes: unknown,
): PrintableGenerationInput {
  const trustedLesson = readSubjectLessonTrustedContext(attributes);
  return {
    title: input.title,
    kind: input.kind ?? "worksheet",
    skill: input.skill ?? null,
    subject: input.subject ?? null,
    curriculum: input.curriculum ?? null,
    theme: input.theme ?? null,
    characters: input.characters ?? [],
    childName: input.childName ?? null,
    requestSummary: input.requestSummary ?? null,
    revisesId: input.revisesId ?? null,
    path,
    ...(trustedLesson ? { lessonId: trustedLesson.lessonId } : {}),
  };
}

export default defineTool({
  description:
    "Render a printable page you designed (worksheet, coloring page, flash cards, poster, any material) into a real PDF plus a preview the parent sees where she is (chat card on web, texted picture on SMS). Two paths: pass your own page HTML, or pass a generate_image URL of the whole page. Load the materials-studio skill before your first material of a conversation. For changes, pass revisesId and call again; when the parent approves a version, call mark_material_final.",
  inputSchema: createPrintableInputSchema,
  async execute(input, ctx) {
    let access;
    try {
      access = resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { created: false, note: error.message };
      }
      throw error;
    }
    const { familyId } = access;
    const attributes = ctx.session.auth.current?.attributes as
      | { channel?: string; phoneNumber?: string }
      | undefined;
    const trustedLesson = readSubjectLessonTrustedContext(attributes);
    const subjectLessonRestriction = subjectLessonPrintableRestriction(
      input,
      attributes,
    );
    if (subjectLessonRestriction) {
      return { created: false, note: subjectLessonRestriction };
    }

    if (!blobConfigured()) {
      return {
        created: false,
        note: "The materials studio is not configured on this deployment (no artifact store). Tell the parent you cannot make the printable right now.",
      };
    }

    const hasHtml = typeof input.html === "string";
    const hasPageImage = typeof input.pageImageUrl === "string";
    if (hasHtml === hasPageImage) {
      return {
        created: false,
        note: "Provide exactly one of html (you composed the page) or pageImageUrl (the image model drew the whole page).",
      };
    }
    let pageImageUrl: string | null = null;
    if (hasPageImage) {
      const rawPageImageUrl = input.pageImageUrl as string;
      if (!isFamilyArtifactUrl(rawPageImageUrl, familyId)) {
        return {
          created: false,
          note: "pageImageUrl must be a URL generate_image returned for this family. Generate the page image first, then pass its URL.",
        };
      }
      pageImageUrl = new URL(rawPageImageUrl).toString();
    }

    const metadataText = [
      input.title,
      input.skill,
      input.subject,
      input.curriculum,
      input.theme,
      ...(input.characters ?? []),
      input.childName,
      input.requestSummary,
    ]
      .filter(Boolean)
      .join(" ");
    const gateFailure = validatePrintableHtml(input.html ?? "", metadataText);
    if (gateFailure) {
      return { created: false, note: gateFailure };
    }

    const channel = usageChannelFromAttributes(attributes);

    if (trustedLesson) {
      const worksheetEffect = resolveSubjectLessonWorksheetEffect(
        await claimSubjectLessonWorksheetEffectPinned({
          familyId: trustedLesson.familyId,
          lessonId: trustedLesson.lessonId,
          childId: trustedLesson.childId,
          attempt: trustedLesson.attempt,
          revisesId: input.revisesId ?? null,
        }),
      );
      switch (worksheetEffect.status) {
        case "create":
          break;
        case "completed":
          return {
            created: true,
            done: true,
            material: worksheetEffect.material,
            review: null,
            sentByText: false,
            note: "The completed worksheet receipt was reused without another render or provider call.",
          };
        case "refused":
          return {
            created: false,
            note: "This worksheet effect is already in flight or uncertain. Do not call create_printable again in this attempt. An explicit parent Retry may start a new attempt.",
          };
        default: {
          const exhaustive: never = worksheetEffect;
          throw new Error(
            `Unhandled worksheet effect result: ${String(exhaustive)}`,
          );
        }
      }
    }

    // Render + review + upload is the slow part of an HTML-only build.
    // This fallback shares the progress window with send_heads_up and
    // generate_image.
    if (channel === "sms" && attributes?.phoneNumber) {
      await sendSmsProgressTextOnce({
        familyId,
        phoneNumber: attributes.phoneNumber,
      });
    }

    const startedAt = Date.now();
    const kind = input.kind ?? "worksheet";
    const source: MaterialSource = hasPageImage
      ? "image"
      : /<img\s/i.test(input.html ?? "")
        ? "hybrid"
        : "html";
    const bodyHtml = hasPageImage
      ? `<img src="${pageImageUrl as string}" style="max-width:100%;max-height:9.5in;display:block;margin:0 auto;" alt="" />`
      : (input.html as string);
    const document = hasPageImage
      ? wrapImagePage(pageImageUrl as string, input.childName ?? "")
      : wrapPrintablePage(input.html as string, input.childName ?? "");

    let rendered;
    try {
      rendered = trustedLesson
        ? await renderPrintableHtml(document, SUBJECT_LESSON_RENDER_POLICY)
        : await renderPrintableHtml(document);
    } catch (error) {
      if (error instanceof RendererUnavailableError) {
        return { created: false, note: error.message };
      }
      console.error(
        "create_printable render failed:",
        error instanceof Error ? error.message : "unknown",
      );
      return {
        created: false,
        note: "Rendering hiccuped (often a slow image URL or heavy CSS). Simplify the page slightly and call this again once.",
      };
    }

    // The studio's own eyes: the reviewer sees the actual pixels against
    // the brief; the agent decides what to do with the verdict. A null
    // review (disabled or unavailable) never blocks anything.
    const brief = [
      `Title: ${input.title}`,
      `Kind: ${kind}`,
      input.skill ? `Practices: ${input.skill}` : null,
      input.theme ? `Theme: ${input.theme}` : null,
      input.characters?.length ? `Characters: ${input.characters.join(", ")}` : null,
      input.childName ? `Child's name as spelled: ${input.childName}` : null,
      input.requestSummary ? `The parent asked for: ${input.requestSummary}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const review = await reviewArtifact({
      familyId,
      channel,
      previewJpeg: rendered.previewJpeg,
      brief,
    });

    const { pdfUrl, previewUrl } = await uploadMaterialArtifacts({
      familyId,
      slug: printableSlug(input.title),
      pdf: rendered.pdf,
      previewJpeg: rendered.previewJpeg,
    });

    // Provenance for the founder deep view: the tool's input metadata
    // (never the html, which lives on the row already), the session that
    // made it, and the review verdict beside the output.
    const generation = {
      sessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
      channel,
      input: buildPrintableGenerationInput(
        input,
        hasPageImage ? "pageImageUrl" : "html",
        attributes,
      ),
      review,
    };

    // The durable record (Postgres is truth; html is what a future
    // session revises or re-themes instead of re-imagining the page).
    let materialId: string;
    if (access.mode === "pinned") {
      const inserted = await insertMaterialRowPinned({
        familyId,
        childId: input.childId ?? null,
        title: input.title,
        kind,
        skill: input.skill ?? null,
        subject: input.subject ?? null,
        curriculum: input.curriculum ?? null,
        theme: input.theme ?? null,
        characters: input.characters ?? [],
        pdfUrl,
        previewUrl,
        html: bodyHtml,
        source,
        revises: input.revisesId ?? null,
        channel,
        ...(trustedLesson
          ? {
              subjectLessonId: trustedLesson.lessonId,
              subjectLessonAttempt: trustedLesson.attempt,
              subjectLessonSubjectId: trustedLesson.subjectId,
              subjectLessonTargetStatement: trustedLesson.targetStatement,
            }
          : {
              subjectLessonId: null,
              subjectLessonAttempt: null,
              subjectLessonSubjectId: null,
              subjectLessonTargetStatement: null,
            }),
        generation,
      });
      if (!inserted.ok) {
        return { created: false, note: inserted.note };
      }
      materialId = inserted.id;
    } else {
      // Caller path: RLS walls the family; revisesId is verified by an
      // RLS-scoped read (a foreign id is simply invisible).
      if (input.revisesId) {
        const { data: revisesRow } = await access.db
          .from("materials")
          .select("id")
          .eq("id", input.revisesId)
          .eq("family_id", familyId)
          .maybeSingle();
        if (!revisesRow) {
          return {
            created: false,
            note: "That revisesId is not one of this family's materials. Use an id from an earlier create result, or leave it off.",
          };
        }
      }
      const { data: insertedRow, error: insertError } = await access.db
        .from("materials")
        .insert({
          family_id: familyId,
          child_id: input.childId ?? null,
          title: input.title,
          kind,
          skill: input.skill ?? null,
          subject: input.subject ?? null,
          curriculum: input.curriculum ?? null,
          theme: input.theme ?? null,
          characters: input.characters ?? [],
          pdf_url: pdfUrl,
          preview_url: previewUrl,
          html: bodyHtml,
          source,
          revises: input.revisesId ?? null,
          channel,
          generation,
        })
        .select("id")
        .single();
      if (insertError || !insertedRow) {
        return {
          created: false,
          note: `Could not save the material record: ${insertError?.message ?? "unknown"}. If the child id was wrong, use one from the family context block.`,
        };
      }
      materialId = insertedRow.id;
    }

    // SMS delivery, gated on the review: a page the reviewer flagged
    // never lands on her phone; revise first. The number comes from
    // channel auth, never the model (anti-relay law).
    const reviewPassed = review === null || review.pass;
    let sentByText = false;
    let previewSentByText = false;
    if (channel === "sms" && reviewPassed && attributes?.phoneNumber) {
      const materialSmsIntro = `${input.title} is ready to print:`;
      previewSentByText = await sendHomaSms(
        attributes.phoneNumber,
        materialSmsIntro,
        [previewUrl, pdfUrl],
      );
      sentByText = previewSentByText;
      if (!sentByText) {
        sentByText = await sendHomaSms(
          attributes.phoneNumber,
          `${materialSmsIntro} ${pdfUrl}`,
        );
      }
    }

    await emitMapEvent("materials.created", {
      family_id: familyId,
      ...(input.childId ? { child_id: input.childId } : {}),
      channel,
      kind,
      source,
      reviewed: review !== null,
      ...(review !== null ? { review_passed: review.pass } : {}),
      sent_by_text: sentByText,
      duration_ms: Date.now() - startedAt,
    });

    const deliveryNote =
      channel === "subject_lesson"
        ? "The worksheet is saved as a draft for this lesson. Read the quality check and attach only when it passed or was unavailable."
        : channel === "sms"
        ? reviewPassed
          ? sentByText
            ? previewSentByText
              ? "The preview and printable link were submitted by text. Follow with ONE short text naming the child and the skill, and invite tweaks."
              : "The printable link was submitted by text. Follow with ONE short text naming the child and the skill, and invite tweaks."
            : "The material is made and saved, but text delivery failed. Tell her it's ready in her Homa chat on the web, and offer to tweak anything."
          : "NOT texted to her yet: fix the issues below (call again with revisesId set to this id), then the passing version sends."
        : "The card with the preview and print button is already visible in chat. Tell her it's ready in one warm sentence (child + skill), and invite tweaks; never paste the links.";
    const reviewNote =
      review === null
        ? ""
        : review.pass
          ? " Quality check passed."
          : ` Quality check found issues: ${review.issues.join("; ")}.`;

    return {
      created: true,
      done: true,
      material: {
        id: materialId,
        title: input.title,
        kind,
        skill: input.skill ?? null,
        childName: input.childName ?? null,
        previewUrl,
        pdfUrl,
        status: "draft",
      },
      review,
      sentByText,
      note: trustedLesson
        ? `${deliveryNote}${reviewNote}`
        : `${deliveryNote}${reviewNote} When the parent approves a version, call mark_material_final with this id.`,
    };
  },
});
