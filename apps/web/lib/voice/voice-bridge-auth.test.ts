import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  trustedVoiceBridgeRequest,
  voiceBridgeAuthHeaders,
  voiceBridgeMessageMatches,
} from "./voice-bridge-auth";

const NOW = new Date("2026-08-01T12:00:00.000Z");
const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";

describe("voice bridge authentication", () => {
  it("binds a short-lived signature to the token, source row, and message", () => {
    const headers = voiceBridgeAuthHeaders({
      accessToken: "caller-token",
      message: "Make Maya a maze",
      messageId: MESSAGE_ID,
      activeObjectContext: "## Visible object\nMaterial 123",
      secret: "deployment-secret",
      now: NOW,
    });
    const trusted = trustedVoiceBridgeRequest(
      new Request("https://example.test/eve", { headers }),
      {
        accessToken: "caller-token",
        secret: "deployment-secret",
        now: new Date(NOW.getTime() + 30_000),
      },
    );
    assert.deepEqual(trusted, {
      messageId: MESSAGE_ID,
      messageSha256: headers["x-homa-voice-bridge-message-sha256"],
      activeObjectContext: "## Visible object\nMaterial 123",
    });
    assert.equal(
      voiceBridgeMessageMatches(
        "Make Maya a maze",
        trusted?.messageSha256 ?? "",
      ),
      true,
    );
    assert.equal(
      voiceBridgeMessageMatches(
        "Make Noah a maze",
        trusted?.messageSha256 ?? "",
      ),
      false,
    );
  });

  it("rejects visible-object context changed after signing", () => {
    const headers = {
      ...voiceBridgeAuthHeaders({
        accessToken: "caller-token",
        message: "What do you think about this?",
        messageId: MESSAGE_ID,
        activeObjectContext: "material-a",
        secret: "deployment-secret",
        now: NOW,
      }),
      "x-homa-voice-active-object": Buffer.from("material-b").toString("base64url"),
    };
    assert.equal(
      trustedVoiceBridgeRequest(
        new Request("https://example.test/eve", { headers }),
        { accessToken: "caller-token", secret: "deployment-secret", now: NOW },
      ),
      null,
    );
  });

  it("rejects a forged, expired, or differently authenticated request", () => {
    const headers = voiceBridgeAuthHeaders({
      accessToken: "caller-token",
      message: "Open the planner",
      messageId: MESSAGE_ID,
      secret: "deployment-secret",
      now: NOW,
    });
    for (const input of [
      { accessToken: "other-token", secret: "deployment-secret", now: NOW },
      { accessToken: "caller-token", secret: "other-secret", now: NOW },
      {
        accessToken: "caller-token",
        secret: "deployment-secret",
        now: new Date(NOW.getTime() + 60_001),
      },
    ]) {
      assert.equal(
        trustedVoiceBridgeRequest(
          new Request("https://example.test/eve", { headers }),
          input,
        ),
        null,
      );
    }
  });
});
