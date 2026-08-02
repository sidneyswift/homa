import { gateway } from "ai";

import { HOMA_MODEL } from "../../agent/model";

export const VOICE_NOTE_JUDGE = {
  model: gateway(HOMA_MODEL),
  modelOptions: {
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        tags: ["voice_note_provenance_eval"],
      },
    },
  },
};
