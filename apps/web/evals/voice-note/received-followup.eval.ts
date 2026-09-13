import { defineEval } from "eve/evals";

import { sendEvalMessage } from "../../lib/eval-send-message";
import { messageModalityHeaders } from "../../lib/web-message-modality";
import { markVoiceTranscription } from "../../lib/voice/transcription-marker";
import { VOICE_NOTE_JUDGE } from "./judge";

export default defineEval({
  description:
    "A follow-up question in the same session recognizes the preceding web dictation without claiming its audio was saved.",
  tags: ["model-backed", "voice-note"],
  judge: VOICE_NOTE_JUDGE,
  timeoutMs: 120_000,
  async test(t) {
    await sendEvalMessage(t, {
      message: markVoiceTranscription(
        "Maya read nine pages and practiced the sh sound in ship.",
      ),
      headers: messageModalityHeaders("voice"),
    });
    await t.send("Did you get my voice note?");

    t.log(t.reply ?? "(no reply)");
    t.succeeded();
    t.judge.autoevals
      .closedQA(
        [
          "The reply confirms that the parent's transcribed spoken words arrived.",
          "It accurately recognizes the note about Maya reading nine pages and practicing the sh sound in ship.",
          "It does not claim that Homa retained, saved, heard, or can replay an audio file.",
        ].join(" "),
      )
      .gate();
  },
});
