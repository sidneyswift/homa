import { createHash } from "node:crypto";
import type { Page } from "puppeteer-core";

import { SHEET_BODY_CLASS, SHEET_PAGE_CLASS } from "../page-shell";
import { HandwritingDocumentError } from "./document";
import type { LegacyRowMeasurement, LegacyRowTarget } from "./revision";

/** Known local reproduction's immutable Fredoka Regular 2.001 bytes. This
 * does not attest a historical Google Fonts response or a fallback font. */
export const LEGACY_FREDOKA_SHA256 = "7fe52d17e4c5c80ec74c9b26cb635d593e72cfc30cc189dab7a0babece57e153";

export async function verifyLegacyHandwritingLayout(page: Page, targets: readonly LegacyRowTarget[]): Promise<LegacyRowMeasurement[]> {
  const result = await page.evaluate((items, bodyClass, pageClass) => {
    const failures: string[] = [];
    const rows: { page: number; svgOrdinal: number; text: string; cap: number; body: number; fontSource: string; fontSize: number; }[] = [];
    const elements = Array.from(document.querySelectorAll("*"));
    if (elements.length > 12_000 || elements.some((element) => /^(script|iframe|object|embed|link|animate|animatetransform|animatemotion|set)$/i.test(element.tagName) || Array.from(element.attributes).some((attribute) => /^on/i.test(attribute.name)))) failures.push("Legacy proof requires bounded static source with no external styles or executable content.");
    if (document.getAnimations().length) failures.push("Legacy proof cannot use animation.");
    const rules: CSSRule[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try { rules.push(...Array.from(sheet.cssRules)); } catch { failures.push("The old stylesheet is not locally inspectable."); }
    }
    const faces: CSSFontFaceRule[] = [];
    let pageRules = 0;
    for (let index = 0; index < rules.length; index++) {
      const rule = rules[index];
      if (rule instanceof CSSImportRule) failures.push("The old font/style source was not saved with this page.");
      else if (rule instanceof CSSFontFaceRule) faces.push(rule);
      else if (rule instanceof CSSPageRule) {
        pageRules++;
        if (rule.selectorText || rule.style.getPropertyValue("size") !== "letter" || !["0", "0px"].includes(rule.style.getPropertyValue("margin")) || Array.from(rule.style).some((property) => !["size", "margin-top", "margin-right", "margin-bottom", "margin-left"].includes(property))) failures.push("The old print page rule is unsupported.");
      } else if ("cssRules" in rule) rules.push(...Array.from((rule as CSSGroupingRule).cssRules));
    }
    if (pageRules !== 1) failures.push("The printable shell must own the old page rule.");
    const bodies = Array.from(document.querySelectorAll(`.${bodyClass}`));
    const sheets = Array.from(document.querySelectorAll(`.${pageClass}`));
    for (const item of items) {
      const body = bodies[item.page - 1];
      const svg = body?.querySelectorAll("svg")[item.svgOrdinal - 1];
      const parsed = new DOMParser().parseFromString(item.source, "image/svg+xml");
      // HTML source does not require an xmlns attribute. Parse it in an HTML
      // template for DOM equality while XML is used only to detect malformed tags.
      const template = document.createElement("template"); template.innerHTML = item.source;
      if (!(svg instanceof SVGSVGElement) || !template.content.firstElementChild?.isEqualNode(svg) || parsed.querySelector("parsererror") || template.content.childElementCount !== 1) { failures.push("The source SVG ordinal does not identify the same exact DOM element."); continue; }
      const children = Array.from(svg.children);
      if (children.length !== 4 || children.slice(0, 3).some((element) => element.tagName.toLowerCase() !== "line") || !(children[3] instanceof SVGTextElement)) { failures.push("Only the explicit three-line, one-text legacy row has a conversion proof."); continue; }
      const text = children[3];
      const lines = children.slice(0, 3) as SVGLineElement[];
      const box = svg.getBoundingClientRect();
      const view = svg.viewBox.baseVal;
      const sheet = sheets[item.page - 1]?.getBoundingClientRect();
      const bodyBox = body.getBoundingClientRect();
      const bodyStyle = getComputedStyle(body);
      if (!sheet || Math.abs(sheet.width - 816) > 0.1 || Math.abs(sheet.height - 1056) > 0.1 || Math.abs(sheet.left) > 0.1 || Math.abs(sheet.top - (item.page - 1) * 1056) > 0.1 || view.x !== 0 || view.y !== 0 || view.width !== 700 || view.height !== 132 || svg.getAttribute("preserveAspectRatio") !== "none" || Math.abs(box.width - 700) > 1 || Math.abs(box.height - 132) > 0.1) failures.push("The legacy row uses an unsupported or transformed print frame.");
      if (box.left < bodyBox.left + parseFloat(bodyStyle.paddingLeft) - 0.1 || box.right > bodyBox.right - parseFloat(bodyStyle.paddingRight) + 0.1 || box.top < bodyBox.top + parseFloat(bodyStyle.paddingTop) - 0.1 || box.bottom > bodyBox.bottom - parseFloat(bodyStyle.paddingBottom) + 0.1) failures.push("The old guide frame falls outside the printable content area.");
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index]; const style = getComputedStyle(line); const matrix = line.getScreenCTM();
        if (line.x1.baseVal.value !== 0 || line.x2.baseVal.value !== 700 || line.y1.baseVal.value !== [2, 66, 130][index] || line.y2.baseVal.value !== line.y1.baseVal.value || style.stroke === "none" || style.stroke === "transparent" || /rgba\([^)]*,\s*0(?:\.0+)?\)/.test(style.stroke) || parseFloat(style.strokeOpacity) !== 1 || parseFloat(style.strokeWidth) <= 0 || parseFloat(style.strokeWidth) > 3 || !matrix || Math.abs(matrix.a - box.width / 700) > 0.001 || Math.abs(matrix.d - 1) > 0.001 || matrix.b !== 0 || matrix.c !== 0 || Math.abs(matrix.e - box.left) > 0.1 || Math.abs(matrix.f - box.top) > 0.1) failures.push("The exact legacy guide positions or paint cannot be verified.");
      }
      const style = getComputedStyle(text); const matrix = text.getScreenCTM();
      if (text.children.length || text.textContent !== item.nextText || text.getAttribute("x") !== "16" || text.getAttribute("y") !== "129" || ["dx", "dy", "rotate", "textLength", "lengthAdjust"].some((attribute) => text.hasAttribute(attribute)) || !matrix || Math.abs(matrix.a - box.width / 700) > 0.001 || Math.abs(matrix.d - 1) > 0.001 || matrix.b !== 0 || matrix.c !== 0 || Math.abs(matrix.e - box.left) > 0.1 || Math.abs(matrix.f - box.top) > 0.1 || style.fontWeight !== "400" || style.fontStyle !== "normal" || style.fontStretch !== "100%" || style.writingMode !== "horizontal-tb" || style.fill === "none" || style.fill === "transparent" || /rgba\([^)]*,\s*0(?:\.0+)?\)/.test(style.fill) || parseFloat(style.fillOpacity) !== 1 || style.textAnchor !== "start" || style.dominantBaseline !== "auto") failures.push("The selected literal text uses an unsupported legacy font layout.");
      for (const child of children) {
        for (let parent: Element | null = child; parent; parent = parent.parentElement) {
          const css = getComputedStyle(parent);
          if (parent instanceof HTMLElement) {
            const frame = parent.getBoundingClientRect();
            const left = frame.left + parent.clientLeft; const top = frame.top + parent.clientTop;
            if (css.overflowX !== "visible" && (box.left < left - 0.1 || box.right > left + parent.clientWidth + 0.1) || css.overflowY !== "visible" && (box.top < top - 0.1 || box.bottom > top + parent.clientHeight + 0.1)) failures.push("The old writing-guide frame is clipped by an ancestor.");
          }
          if (css.transform !== "none" || css.translate !== "none" || css.rotate !== "none" || css.scale !== "none" || Number(css.zoom) !== 1 || css.perspective !== "none" || css.display === "none" || css.visibility !== "visible" || Number(css.opacity) !== 1 || css.filter !== "none" || css.clipPath !== "none" || css.maskImage !== "none" || css.mixBlendMode !== "normal" || css.clip !== "auto" || css.contentVisibility !== "visible" || css.contain.includes("paint") || ["fixed", "sticky"].includes(css.position)) failures.push("The old row has an unverified transformed or hidden ancestor.");
        }
      }
      const family = style.fontFamily.replaceAll('"', "").replaceAll("'", "").trim();
      const matches = faces.filter((face) => face.style.fontFamily.replaceAll('"', "").replaceAll("'", "").trim() === family && ["", "400", "normal"].includes(face.style.fontWeight) && ["", "normal"].includes(face.style.fontStyle));
      if (matches.length !== 1 || !document.fonts.check(`${style.fontSize} "${family}"`, text.textContent ?? "")) { failures.push("The exact embedded old font cannot be verified."); continue; }
      rows.push({ page: item.page, svgOrdinal: item.svgOrdinal, text: text.textContent ?? "", cap: 128, body: 64, fontSource: matches[0].style.getPropertyValue("src"), fontSize: parseFloat(style.fontSize) });
    }
    return { failures: [...new Set(failures)], rows };
  }, [...targets], SHEET_BODY_CLASS, SHEET_PAGE_CLASS);
  if (result.failures.length) throw new HandwritingDocumentError(result.failures.join(" "));
  const session = await page.createCDPSession();
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const rows: LegacyRowMeasurement[] = [];
    for (const row of result.rows) {
      const font = /^url\(["']?(data:font\/(?:ttf|opentype);base64,[A-Za-z0-9+/=]+)["']?\)\s*(?:format\(["'](?:truetype|opentype)["']\))?$/i.exec(row.fontSource);
      if (!font || font[1].length > 100_000) throw new HandwritingDocumentError("The old font bytes are missing or unsupported; no fallback was substituted.");
      const fontSha256 = createHash("sha256").update(Buffer.from(font[1].split(",")[1], "base64")).digest("hex");
      if (fontSha256 !== LEGACY_FREDOKA_SHA256) throw new HandwritingDocumentError("The saved old font does not match the bounded Fredoka conversion proof.");
      const { nodeIds } = await session.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: `.${SHEET_BODY_CLASS}` });
      const { nodeIds: svgs } = await session.send("DOM.querySelectorAll", { nodeId: nodeIds[row.page - 1], selector: "svg" });
      const { nodeId } = await session.send("DOM.querySelector", { nodeId: svgs[row.svgOrdinal - 1], selector: "text" });
      const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
      if (fonts.length !== 1 || !fonts[0].isCustomFont || fonts[0].familyName !== "Fredoka" || fonts[0].glyphCount < 1) throw new HandwritingDocumentError("The old row used a fallback or mixed font. Its original letter geometry cannot be inferred.");
      rows.push({ page: row.page, svgOrdinal: row.svgOrdinal, text: row.text, cap: row.cap, body: row.body, fontSize: row.fontSize, fontSha256 });
    }
    return rows;
  } finally { await session.detach(); }
}
