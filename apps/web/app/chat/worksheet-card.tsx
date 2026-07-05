"use client";

/**
 * Renders a create_worksheet tool result as an on-brand card with a print
 * button. Printing opens a minimal print-styled window (v0 of the MJ-01
 * print pipeline: browser print dialog to paper or PDF; the real preflight
 * pipeline replaces this later).
 */

export interface WorksheetPayload {
  childName: string;
  title: string;
  subtitle: string;
  theme: string;
  items: { instruction: string; content: string }[];
  encouragement: string;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function printableHtml(worksheet: WorksheetPayload): string {
  const items = worksheet.items
    .map(
      (item, index) => `
        <section class="item">
          <p class="instruction"><span class="num">${index + 1}</span> ${escapeHtml(item.instruction)}</p>
          ${item.content ? `<p class="content">${escapeHtml(item.content).replaceAll("\n", "<br/>")}</p>` : ""}
        </section>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(worksheet.title)}</title>
<style>
  @page { size: letter; margin: 0.75in; }
  body { font-family: "Hanken Grotesk", "Segoe UI", sans-serif; color: #221e1a; margin: 0; }
  header { border-bottom: 3px solid #e7602f; padding-bottom: 12px; }
  .name-line { font-size: 13px; color: #6b6259; margin: 0 0 10px; }
  .name-line span { display: inline-block; min-width: 200px; border-bottom: 1.5px solid #b3a492; }
  h1 { font-size: 26px; margin: 0; }
  .subtitle { color: #6b6259; margin: 4px 0 0; font-size: 15px; }
  .item { margin-top: 26px; break-inside: avoid; }
  .instruction { font-size: 16px; font-weight: 600; margin: 0; }
  .num { display: inline-flex; width: 24px; height: 24px; border-radius: 999px; background: #fff0e8; color: #e7602f; font-size: 13px; align-items: center; justify-content: center; margin-right: 8px; }
  .content { font-size: 22px; letter-spacing: 0.08em; line-height: 2.1; margin: 10px 0 0 32px; white-space: pre-wrap; }
  footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e7ddce; color: #6b6259; font-size: 13px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <header>
    <p class="name-line">Name: <span>&nbsp;${escapeHtml(worksheet.childName)}&nbsp;</span></p>
    <h1>${escapeHtml(worksheet.title)}</h1>
    <p class="subtitle">${escapeHtml(worksheet.subtitle)}</p>
  </header>
  ${items}
  <footer>
    <span>${escapeHtml(worksheet.encouragement)}</span>
    <span>made with Homa for ${escapeHtml(worksheet.childName)}</span>
  </footer>
</body>
</html>`;
}

export function WorksheetCard({ worksheet }: { worksheet: WorksheetPayload }) {
  function handlePrint() {
    const w = window.open("", "_blank", "width=850,height=1100");
    if (!w) return;
    w.document.write(printableHtml(worksheet));
    w.document.close();
    w.focus();
    // Give fonts/layout a beat before the dialog.
    setTimeout(() => w.print(), 250);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-brand">Worksheet ready</p>
      <p className="mt-1 font-display text-lg font-semibold text-strong">
        {worksheet.title}
      </p>
      <p className="mt-0.5 text-sm text-muted">
        {worksheet.subtitle} &middot; for {worksheet.childName}
      </p>
      <ol className="mt-3 space-y-1.5">
        {worksheet.items.map((item, index) => (
          <li key={index} className="text-sm text-body">
            <span className="mr-1.5 font-semibold text-brand">{index + 1}.</span>
            {item.instruction}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={handlePrint}
        className="mt-4 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
      >
        Print worksheet
      </button>
    </div>
  );
}
