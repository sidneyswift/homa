import assert from "node:assert/strict";
import { test } from "node:test";

import { colors, darkColors } from "./tokens";

function relativeLuminance(hex: string): number {
  assert.match(hex, /^#[0-9A-F]{6}$/iu);
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  );
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const NORMAL_TEXT_PAIRS = [
  ["primary button", colors.onBrand, colors.brandHover],
  ["strong text on page", colors.textStrong, colors.page],
  ["body text on page", colors.textBody, colors.page],
  ["muted text on page", colors.textMuted, colors.page],
  ["strong text on brand soft", colors.textStrong, colors.brandSoft],
  ["body text on danger soft", colors.textBody, colors.dangerSoft],
  ["body text on card", colors.textBody, colors.card],
  ["muted text on card", colors.textMuted, colors.card],
  ["field idle boundary", colors.textMuted, colors.card],
  ["field focus boundary", colors.brandHover, colors.card],
  ["success text on page", colors.success, colors.page],
  ["success text on soft sage", colors.success, colors.sageSoft],
  ["dark primary button", darkColors.onBrand, darkColors.action],
  ["dark strong text", darkColors.textStrong, darkColors.page],
  ["dark body text", darkColors.textBody, darkColors.page],
  ["dark muted text", darkColors.textMuted, darkColors.page],
] as const;

test("approved semantic text pairs meet 4.5 to 1 contrast", () => {
  for (const [label, foreground, background] of NORMAL_TEXT_PAIRS) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${label} is ${contrastRatio(foreground, background).toFixed(2)}:1`,
    );
  }
});

const NON_TEXT_PAIRS = [
  ["active control boundary", colors.brandHover, colors.card],
  ["idle control boundary", colors.textMuted, colors.card],
  ["active boundary on brand soft", colors.brandHover, colors.brandSoft],
  ["idle switch thumb", colors.textMuted, colors.surfaceSunken],
] as const;

test("approved control boundaries meet 3 to 1 contrast", () => {
  for (const [label, foreground, background] of NON_TEXT_PAIRS) {
    assert.ok(
      contrastRatio(foreground, background) >= 3,
      `${label} is ${contrastRatio(foreground, background).toFixed(2)}:1`,
    );
  }
});
