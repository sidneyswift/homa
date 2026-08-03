import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { EveMessage } from "eve/client";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import type { ArchivedMessage } from "./chat-storage";
import {
  hydrationSafeTranscriptSources,
  useHydrated,
} from "./chat-hydration";

function message(id: string): EveMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text: id }],
  } as EveMessage;
}

function archived(id: string): ArchivedMessage {
  return { at: 1, message: message(id) };
}

describe("chat hydration projection (GH #405)", () => {
  const serverArchived = [archived("server")];
  const clientArchived = [archived("local")];
  const clientLive = [message("live")];
  const clientSpoken = [archived("spoken")];
  const clientLiveTimes = { live: 2 };

  it("uses the server snapshot during SSR", () => {
    function Probe() {
      return createElement("span", null, useHydrated() ? "client" : "server");
    }

    assert.equal(renderToString(createElement(Probe)), "<span>server</span>");
  });

  it("renders only server-known transcript state during SSR and first hydration", () => {
    assert.deepEqual(
      hydrationSafeTranscriptSources({
        hydrated: false,
        serverArchived,
        clientArchived,
        clientLive,
        clientLiveTimes,
        clientSpoken,
      }),
      {
        archived: serverArchived,
        live: [],
        liveTimes: {},
        spoken: [],
      },
    );
  });

  it("reveals the local live-session overlay after hydration", () => {
    assert.deepEqual(
      hydrationSafeTranscriptSources({
        hydrated: true,
        serverArchived,
        clientArchived,
        clientLive,
        clientLiveTimes,
        clientSpoken,
      }),
      {
        archived: clientArchived,
        live: clientLive,
        liveTimes: clientLiveTimes,
        spoken: clientSpoken,
      },
    );
  });
});

describe("ChatClient hydration wiring (GH #405)", () => {
  const source = readFileSync(
    new URL("./chat-client.tsx", import.meta.url),
    "utf8",
  );

  it("uses the hydration-safe sources for transcript and restored-card decisions", () => {
    assert.match(source, /const hydrated = useHydrated\(\);/u);
    assert.match(source, /hydrationSafeTranscriptSources\(\{/u);
    assert.match(source, /const renderBusy = hydrated && busy;/u);
    assert.match(source, /latestDetailRequest\(renderMessages\)/u);
    assert.match(source, /latestChecklistRequest\(renderMessages\)/u);
  });
});
