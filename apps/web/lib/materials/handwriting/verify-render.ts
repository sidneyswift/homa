import type { Page } from "puppeteer-core";

import { withPdfForReading } from "../rasterize-pdf";
import { SHEET_BODY_CLASS, SHEET_PAGE_CLASS } from "../page-shell";
import { HandwritingDocumentError, type HandwritingExpectation } from "./document";

export interface HandwritingPlacement {
  page: number;
  id: string;
  documentRowId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  guideHeightPoints: number;
}

/** Print-media DOM measurement of isolated, server-composed row images. */
export async function verifyHandwritingLayout(page: Page, expected: readonly HandwritingExpectation[]): Promise<HandwritingPlacement[]> {
  const result = await page.evaluate((rows, bodyClass, pageClass) => {
    const failures: string[] = [];
    const placements: HandwritingPlacement[] = [];
    // No functions declared inside this evaluate: esbuild may emit __name
    // references that do not exist in the browser execution world.
    const all = Array.from(document.querySelectorAll("*"));
    if (all.some((element) => /^(script|iframe|object|embed|animate|animatetransform|animatemotion|set)$/i.test(element.tagName) || Array.from(element.attributes).some((attribute) => /^on/i.test(attribute.name)))) failures.push("Guided handwriting needs static page content without scripts, event handlers, or SVG animation.");
    if (all.some((element) => ["fixed", "sticky"].includes(getComputedStyle(element).position))) failures.push("Guided handwriting needs page-local content without fixed or sticky positioning.");
    if (document.getAnimations().length > 0) failures.push("Guided handwriting cannot be verified while the page is animated.");
    let pageRules = 0;
    const rules: CSSRule[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try { rules.push(...Array.from(sheet.cssRules)); }
      catch { failures.push("Guided handwriting needs locally inspectable page styles; use inline styles instead of an external stylesheet."); }
    }
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule instanceof CSSPageRule) {
        pageRules++;
        if (rule.selectorText || rule.style.getPropertyValue("size") !== "letter" || !["0px", "0"].includes(rule.style.getPropertyValue("margin")) || Array.from(rule.style).some((property) => !["size", "margin-top", "margin-right", "margin-bottom", "margin-left"].includes(property))) failures.push("Keep the printable shell's letter page size and zero page margin.");
      } else if ("cssRules" in rule) rules.push(...Array.from((rule as CSSGroupingRule).cssRules));
      else if (rule instanceof CSSImportRule) failures.push("Imported styles cannot be used on a verified handwriting page.");
    }
    if (pageRules !== 1) failures.push("The printable shell must own the only page rule.");
    const pages = Array.from(document.querySelectorAll(`.${pageClass}`));
    const actualRows = Array.from(document.querySelectorAll("[data-homa-handwriting-row]"));
    if (actualRows.length !== rows.length) failures.push("The rendered handwriting row count differs from the server declarations.");
    for (const row of rows) {
      const sheet = pages[row.page - 1];
      const matches = actualRows.filter((element) => element.getAttribute("data-homa-handwriting-row") === row.id && element.closest(`.${pageClass}`) === sheet);
      const element = matches[0];
      if (matches.length !== 1 || !(element instanceof HTMLImageElement)) { failures.push(`Row ${row.id} is missing or repeated in the rendered page.`); continue; }
      const body = element.closest(`.${bodyClass}`);
      if (!sheet || element.closest(`.${pageClass}`) !== sheet || !body) { failures.push(`Row ${row.id} moved to another page.`); continue; }
      const box = element.getBoundingClientRect();
      const sheetBox = sheet.getBoundingClientRect();
      const bodyBox = body.getBoundingClientRect();
      const bodyStyle = getComputedStyle(body);
      if (element.getAttribute("src") !== row.src || element.currentSrc !== row.src || !element.complete || element.naturalWidth !== row.width || Math.abs(element.naturalHeight - row.height) > 0.51 || element.hasAttribute("srcset")) failures.push(`Row ${row.id} no longer contains its exact composed image.`);
      if (Math.abs(box.width - row.width) > 0.1 || Math.abs(box.height - row.height) > 0.1 || Math.abs(sheetBox.width - 816) > 0.1 || Math.abs(sheetBox.height - 1056) > 0.1 || Math.abs(sheetBox.left) > 0.1 || Math.abs(sheetBox.top - (row.page - 1) * 1056) > 0.1) failures.push(`Row ${row.id} changed physical size.`);
      if (box.left < bodyBox.left + parseFloat(bodyStyle.paddingLeft) - 0.1 || box.right > bodyBox.right - parseFloat(bodyStyle.paddingRight) + 0.1 || box.top < bodyBox.top + parseFloat(bodyStyle.paddingTop) - 0.1 || box.bottom > bodyBox.bottom - parseFloat(bodyStyle.paddingBottom) + 0.1) failures.push(`Row ${row.id} crosses the printable content area.`);
      for (let parent: Element | null = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const rect = parent.getBoundingClientRect();
        if (style.transform !== "none" || style.translate !== "none" || style.rotate !== "none" || style.scale !== "none" || Number(style.zoom) !== 1 || style.perspective !== "none") failures.push(`Row ${row.id} has a transformed ancestor.`);
        if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) !== 1 || style.filter !== "none" || style.clipPath !== "none" || style.maskImage !== "none" || style.mixBlendMode !== "normal" || style.clip !== "auto" || style.contentVisibility !== "visible" || style.contain.includes("paint") || !["none", ""].includes(style.getPropertyValue("-webkit-box-reflect"))) failures.push(`Row ${row.id} has hidden or altered paint.`);
        if (parent === element && (style.objectFit !== "fill" || !["normal", "none"].includes(style.content) || !["none", ""].includes(style.getPropertyValue("object-view-box")) || [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].some((radius) => radius !== "0px") || parseFloat(style.paddingTop) || parseFloat(style.paddingRight) || parseFloat(style.paddingBottom) || parseFloat(style.paddingLeft) || parseFloat(style.borderTopWidth) || parseFloat(style.borderRightWidth) || parseFloat(style.borderBottomWidth) || parseFloat(style.borderLeftWidth))) failures.push(`Row ${row.id} has altered image framing.`);
        // The image already has exact dimensions and unchanged framing. Its
        // default overflow:clip cannot crop that same image box. clientHeight
        // rounds fractional heights, so comparing the image to itself falsely
        // rejected a 178.25px row as clipped to 178px. Real ancestors still need
        // their clipping checks, including subpixel crops.
        if (parent === element) continue;
        const clipLeft = rect.left + parent.clientLeft;
        const clipTop = rect.top + parent.clientTop;
        const clipRight = clipLeft + parent.clientWidth;
        const clipBottom = clipTop + parent.clientHeight;
        if ((style.overflowX !== "visible" || style.overflowY !== "visible") && [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].some((radius) => radius !== "0px")) failures.push(`Row ${row.id} has an unverified rounded clipping container.`);
        if (style.overflowX !== "visible" && (box.left < clipLeft - 0.1 || box.right > clipRight + 0.1) || style.overflowY !== "visible" && (box.top < clipTop - 0.1 || box.bottom > clipBottom + 0.1)) failures.push(`Row ${row.id} is clipped by its container.`);
      }
      placements.push({ page: row.page, id: row.id, documentRowId: row.documentRowId, x: box.left - sheetBox.left, y: box.top - sheetBox.top, width: box.width, height: box.height, guideHeightPoints: row.capHeight * 0.75 });
    }
    return { failures: [...new Set(failures)], placements };
  }, [...expected], SHEET_BODY_CLASS, SHEET_PAGE_CLASS);
  if (result.failures.length) throw new HandwritingDocumentError(result.failures.join(" "));
  return result.placements;
}

export async function verifyHandwritingPdfPages(pdf: Buffer, expectedPageCount: number) {
  return await withPdfForReading(pdf, AbortSignal.timeout(15_000), async (document) => {
    if (document.numPages !== expectedPageCount) throw new HandwritingDocumentError("The printed handwriting document changed page count.");
    for (let page = 1; page <= document.numPages; page++) {
      const viewport = (await document.getPage(page)).getViewport({ scale: 1 });
      if (Math.abs(viewport.width - 612) > 0.1 || Math.abs(viewport.height - 792) > 0.1) throw new HandwritingDocumentError("The printed handwriting document is not US letter at its declared physical size.");
    }
    return { status: "verified" as const, pageCount: expectedPageCount, pageWidthPoints: 612, pageHeightPoints: 792 };
  });
}
