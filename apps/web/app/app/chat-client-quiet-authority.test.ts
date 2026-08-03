import { readFileSync } from "node:fs";
import { test } from "node:test";

const chatSource = readFileSync(new URL("./chat-client.tsx", import.meta.url), "utf8");
const voiceSource = readFileSync(new URL("./voice-mode.tsx", import.meta.url), "utf8");

test("chat owns the Quiet surface contract at the route boundary", () => {
  if (!chatSource.includes('data-brand-surface="chat"')) throw new Error("chat surface marker missing");
  if (!chatSource.includes('data-brand-layer="composer"')) throw new Error("composer layer marker missing");
  if (!chatSource.includes("<Icon name=\"next\"")) throw new Error("send and scroll controls need semantic icons");
  if (!chatSource.includes("<Icon name=\"refresh\"")) throw new Error("recovery controls need the semantic refresh icon");
  if (!chatSource.includes("<Icon name=\"stop\"")) throw new Error("stop control needs the semantic stop icon");
  if (!chatSource.includes("<QuietAction")) throw new Error("recovery actions need the shared action primitive");
  if (/lucide-react|RefreshCw|quiet-chat__stop-glyph|var\(--stone|var\(--clay|rounded-pill|bg-brand/.test(chatSource)) {
    throw new Error("chat route still contains retired visual dependencies");
  }
});

test("voice mode uses Quiet framing and semantic controls", () => {
  if (!voiceSource.includes("<QuietFrame")) throw new Error("voice panel is not Quiet framed");
  if (!voiceSource.includes('name="voice"')) throw new Error("voice state needs the semantic voice icon");
  if (!voiceSource.includes('name="close"')) throw new Error("voice exit needs the semantic close icon");
});
