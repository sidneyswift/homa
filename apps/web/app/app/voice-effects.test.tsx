import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { VoiceHomaBridgeOutput, VoiceHomaEffect } from "../../lib/voice/homa-bridge";
import { selectParentVisibleMaterialMessageParts } from "./material-message-parts";
import { appendVoiceEffects, appendVoiceWork, voiceEffectPresentation, webVoiceOutputForDisplay } from "./voice-effects";
import { VoiceWorkStatus } from "./voice-work-status";
import { VoiceEffectsView } from "./voice-effects-view";
import { spokenTurnMessage } from "./voice-transcript";

const context = { sessionId: "voice-one", sourceSequence: 0 };
const output = (effects: VoiceHomaEffect[]): VoiceHomaBridgeOutput => ({
  ok: true, spokenReply: "Here it is.", effects,
});
const hours = { callId: "hours-1", toolName: "log_hours", output: {
  logged: true, subject: "Reading", minutes: 20,
} };

function view(effects: VoiceHomaEffect[], canAnswerOutLoud = true, currentRequest = true) {
  const [entry] = appendVoiceEffects([], output(effects), context, 1);
  return renderToStaticMarkup(
    <VoiceEffectsView
      message={entry.message}
      currentRequest={currentRequest}
      canAnswerOutLoud={canAnswerOutLoud}
      timeZone="America/New_York"
      familyId="family-one"
      childNameById={new Map()}
      onOpenPlanner={() => {}}
      onOpenChecklist={() => {}}
      onOpenReport={() => {}}
    />,
  );
}

describe("web voice effect rendering", () => {
  it("holds a real request's place and resolves it without moving the result", () => {
    const pending = appendVoiceWork([], context, 10);
    assert.equal(appendVoiceWork(pending, context, 20).length, 1);
    const complete = appendVoiceEffects(pending, output([hours]), context, 30);
    assert.equal(complete.length, 1);
    assert.equal(complete[0].at, 10);
    assert.equal(complete[0].message.id, pending[0].message.id);
    assert.equal(complete[0].message.parts[0].type, "dynamic-tool");
  });

  it("replaces pending work with an honest ambiguous failure even without a receipt", () => {
    const pending = appendVoiceWork([], context, 10);
    const failed = appendVoiceEffects(pending, {
      ok: false, spokenReply: "I could not confirm that request. Please check the chat before trying it again.", effects: [],
    }, context, 30);
    assert.equal(failed.length, 1);
    assert.equal(failed[0].at, 10);
    assert.match(JSON.stringify(failed[0].message.parts), /could not confirm/);
  });

  it("explains that work continues after voice ends without claiming completion", () => {
    const markup = renderToStaticMarkup(<VoiceWorkStatus voiceActive={false} />);
    assert.match(markup, /still running/);
    assert.doesNotMatch(markup, /ready|percent|spinner/);
    assert.match(renderToStaticMarkup(<VoiceWorkStatus voiceActive />), /keep talking/);
  });
  it("projects a successful report control without changing receipts or continuation state", () => {
    const original: VoiceHomaBridgeOutput = {
      ...output([hours, { callId: "report", toolName: "open_progress_report", output: {
        opened: true, childId: "child-one",
      } }]),
      spokenReply: "Your report is on screen.",
      sessionId: "eve-one",
      sessionState: { sessionId: "eve-one", streamIndex: 9, continuationToken: "next" },
    };
    const projected = webVoiceOutputForDisplay(original);
    assert.equal(projected.spokenReply, "Your report is ready. Use Open report in our chat to see it.");
    assert.equal(projected.ok, original.ok);
    assert.equal(projected.sessionId, original.sessionId);
    assert.equal(projected.effects, original.effects);
    assert.equal(projected.sessionState, original.sessionState);
    assert.equal(original.spokenReply, "Your report is on screen.");
  });

  it("leaves unrelated, refused, and failed results unchanged", () => {
    for (const original of [
      output([hours]),
      output([{ callId: "report", toolName: "open_progress_report", output: { opened: false, childId: "child-one" } }]),
      output([{ callId: "report", toolName: "open_progress_report", output: { opened: true } }]),
      { ...output([{ callId: "report", toolName: "open_progress_report", output: { opened: true, childId: "child-one" } }]), ok: false },
    ]) {
      assert.equal(webVoiceOutputForDisplay(original), original);
    }
  });

  it("deduplicates within a batch and on replay while retaining distinct source turns", () => {
    const first = appendVoiceEffects([], output([hours, hours]), context, 10);
    const replay = appendVoiceEffects(first, output([hours]), context, 20);
    assert.equal(replay.length, 1);
    assert.equal(replay[0].message.parts.length, 1);
    assert.equal(replay[0].at, 10);
    const next = appendVoiceEffects(replay, output([hours]), {
      ...context, sourceSequence: 2,
    }, 30);
    assert.equal(next.length, 2);
    assert.notEqual(next[0].message.id, next[1].message.id);
    assert.equal(next[1].sessionId, context.sessionId);
  });

  it("keeps a turn's material revisions together and shows only the final visible one", () => {
    function material(id: string, revisesId: string | null, title: string): VoiceHomaEffect {
      return { callId: id, toolName: "create_printable", output: {
        created: true, material: {
          id, revisesId, title, status: revisesId ? "final" : "draft",
          reviewPassed: true,
          previewUrl: `https://example.test/${id}.png`,
          pdfUrl: `https://example.test/${id}.pdf`,
        },
      } };
    }
    const effects = [material("draft", null, "First draft"), material("final", "draft", "Final page")];
    const [entry] = appendVoiceEffects([], output(effects), context, 1);
    assert.equal(entry.message.parts.length, 2);
    assert.deepEqual(selectParentVisibleMaterialMessageParts(entry.message.parts).map((part) => part.id), ["final"]);
    const html = view(effects, false);
    assert.match(html, /Final page/u);
    assert.doesNotMatch(html, /First draft/u);
  });

  it("renders actual successful receipts after close without turning refusals into saves", () => {
    assert.match(view([hours], false), /Hours saved/u);
    assert.doesNotMatch(view([{ ...hours, output: { logged: false, note: "Not saved" } }]), /Hours saved/u);
  });

  it("shows every question and option with a spoken answer path, never text-session answer buttons", () => {
    const effect = { callId: "question", toolName: "ask_user_questions", output: {
      asked: true,
      questions: [
        { question: "Which child?", options: [{ label: "Maya" }, { label: "Ben" }] },
        { question: "Which book?", options: [{ label: "Blue book" }, { label: "Green book" }] },
      ],
    } };
    const [entry] = appendVoiceEffects([], output([effect]), context, 1);
    assert.equal(voiceEffectPresentation(entry.message).questions.length, 2);
    assert.equal(voiceEffectPresentation(entry.message).message.parts.length, 0);
    const open = view([effect]);
    assert.match(open, /Which child\?/u);
    assert.match(open, /Which book\?/u);
    assert.match(open, /Green book/u);
    assert.match(open, /Tell Homa your answer out loud/u);
    assert.doesNotMatch(open, /<button/u);
    const closed = view([effect], false);
    assert.match(closed, /Asked during your voice conversation/u);
    assert.doesNotMatch(closed, /Tell Homa your answer out loud|<button/u);
  });

  it("renders a real details form and an explicit report control", () => {
    const html = view([
      { callId: "details", toolName: "ask_for_details", output: { asked: true, kind: "family_basics" } },
      { callId: "report", toolName: "open_progress_report", output: { opened: true, childId: "child-one" } },
    ]);
    assert.match(html, /<input/u);
    assert.match(html, /Open report/u);
    assert.doesNotMatch(html, /Details saved/u);
  });

  it("preserves an older details request without presenting a new save form or a fake save", () => {
    const html = view([{ callId: "details", toolName: "ask_for_details", output: {
      asked: true, kind: "family_basics",
    } }], false, false);
    assert.match(html, /asked for details during your voice conversation/u);
    assert.doesNotMatch(html, /<input|Details saved/u);
  });

  it("uses origin identity for spoken upserts across separate voice conversations", () => {
    const line = { role: "user" as const, text: "We read", sessionId: "voice-one", sequence: 0 };
    assert.equal(spokenTurnMessage(line, 0).id, spokenTurnMessage(line, 99).id);
    assert.notEqual(spokenTurnMessage(line, 0).id,
      spokenTurnMessage({ ...line, sessionId: "voice-two" }, 0).id);
  });
});
