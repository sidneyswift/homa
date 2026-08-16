import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { FirstWeekHandoff } from "./first-week-handoff";

describe("FirstWeekHandoff", () => {
  it("gives the report parent one child-bound next move", () => {
    const html = renderToStaticMarkup(<FirstWeekHandoff child={{ id: "kid-1", name: "Ari" }} />);

    assert.match(html, /Ari&apos;s first week is ready|Ari&#x27;s first week is ready/u);
    assert.match(html, /It came from the answers you shared/u);
    assert.match(
      html,
      /href="\/app\?draft=first-week-adjustment&amp;child=kid-1"[^>]*>[^<]*<span>Change one thing<\/span>/u,
    );
  });
});
