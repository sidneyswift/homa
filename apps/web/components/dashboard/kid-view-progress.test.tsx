import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

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
const GLOBALS_CSS = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);
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

function cssHexToken(name: string): string {
  const match = GLOBALS_CSS.match(
    new RegExp(
      `--${name}:\\s*#([0-9a-f]{6})`,
      "iu",
    ),
  );
  if (!match?.[1]) {
    throw new TypeError(`Missing CSS color token --${name}`);
  }
  return match[1];
}

function relativeLuminance(hex: string): number {
  const channels = hex.match(/../gu)?.map(
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
          lessonListen={null}
        />
      </AppRouterContext.Provider>,
    );
    const progressLink = html.match(
      /<a class="([^"]+)" href="\/app\/child-1\/progress">See all progress<\/a>/u,
    );

    assert.ok(progressLink);
    const className = progressLink[1] ?? "";
    assert.match(className, /min-h-11/u);
    assert.match(className, /bg-\[var\(--brand-active\)\]/u);
    assert.match(className, /text-on-brand/u);
    assert.match(
      className,
      /hover:bg-\[var\(--clay-600\)\]/u,
    );
    assert.match(
      GLOBALS_CSS,
      /--brand-active:\s*var\(--clay-700\)/u,
    );
    const onBrand = cssHexToken("on-brand");
    assert.ok(
      contrastRatio(onBrand, cssHexToken("clay-700")) >= 4.5,
    );
    assert.ok(
      contrastRatio(onBrand, cssHexToken("clay-600")) >= 4.5,
    );
  });
});
