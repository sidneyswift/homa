import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { COLOR_CONTRACT } from "@homa/design/contract";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { KidView } from "../../app/app/kids/[childId]/kid-view";
import type { ChildRecord } from "../../lib/family";

const CHILD: ChildRecord = {
  id: "child-1",
  family_id: "family-1",
  name: "Maya",
  birth_month: "2020-07-01",
  profile: {},
  avatar_url: null,
};
const ORIGINAL_LIVE_PROGRESS_FLAG =
  process.env.HOMA_LIVE_PROGRESS_ENABLED;
const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};

process.env.HOMA_LIVE_PROGRESS_ENABLED = "true";
after(() => {
  if (ORIGINAL_LIVE_PROGRESS_FLAG === undefined) {
    delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
  } else {
    process.env.HOMA_LIVE_PROGRESS_ENABLED =
      ORIGINAL_LIVE_PROGRESS_FLAG;
  }
});

function relativeLuminance(hex: string): number {
  const channels = hex.replace(/^#/u, "").match(/../gu)?.map(
    (channel) => Number.parseInt(channel, 16) / 255,
  );
  if (!channels || channels.length !== 3) {
    throw new TypeError("Expected a six-digit color");
  }
  const linear = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  );
  return (
    0.2126 * linear[0] +
    0.7152 * linear[1] +
    0.0722 * linear[2]
  );
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe("KidView progress action", () => {
  it("uses accessible normal and hover colors with a 44px target", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <KidView
          kids={[CHILD]}
          kidIndex={0}
          parentFirstName="Elena"
          report={null}
          reports={new Map()}
          plans={[]}
          wins={[]}
          curriculum={null}
          curriculumPending={false}
        />
      </AppRouterContext.Provider>,
    );
    const progressLink = html.match(
      /<a class="([^"]+)" href="\/app\/child-1\/progress">[\s\S]*See all progress[\s\S]*<\/a>/u,
    );

    assert.ok(progressLink);
    const className = progressLink[1] ?? "";
    assert.match(className, /quiet-action/u);
    assert.match(className, /quiet-action--primary/u);
    assert.match(className, /quiet-action--default/u);
    assert.ok(
      contrastRatio(COLOR_CONTRACT.tokens.paper, COLOR_CONTRACT.tokens.midnightAction) >= 4.5,
    );
  });
});
