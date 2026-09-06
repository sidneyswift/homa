import { deflateSync } from "node:zlib";

import { createCanvas } from "@napi-rs/canvas";

/** Synthetic source bytes used by deterministic tests and isolated OCR evals. */
export function curriculumPdfFixture(pages: Array<{ text?: string; textRepeats?: number; compressed?: boolean; rawContent?: Buffer; contentStreams?: Buffer[]; scan?: string; imageCopies?: number; width?: number; imageWidth?: number; imageHeaderWidth?: number; rotation?: number }>, encrypted = false, paddingBytes = 0): Buffer {
  const objects: Array<Buffer | Buffer[]> = [];
  const reserve = () => { objects.push(Buffer.alloc(0)); return objects.length; };
  const set = (id: number, value: string | Buffer | Buffer[]) => { objects[id - 1] = typeof value === "string" ? Buffer.from(value) : value; };
  const catalog = reserve(); const pageTree = reserve(); const font = reserve();
  set(font, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  for (const page of pages) {
    const id = reserve(); const contents = reserve(); pageIds.push(id);
    const images: number[] = [];
    let drawing = "";
    if (page.scan !== undefined) {
      const canvas = createCanvas(1224, 1584);
      const context = canvas.getContext("2d");
      context.fillStyle = "white"; context.fillRect(0, 0, 1224, 1584);
      context.fillStyle = "black"; context.font = "28px sans-serif";
      page.scan.split("\n").forEach((line, index) => context.fillText(line, 75, 105 + index * 48));
      const jpeg = canvas.toBuffer("image/jpeg", 90);
      if (page.imageHeaderWidth ?? page.imageWidth) {
        for (let index = 0; index < jpeg.length - 9; index++) {
          if (jpeg[index] === 0xff && (jpeg[index + 1] === 0xc0 || jpeg[index + 1] === 0xc2)) {
            jpeg.writeUInt16BE((page.imageHeaderWidth ?? page.imageWidth)!, index + 7);
            break;
          }
        }
      }
      canvas.width = 0; canvas.height = 0;
      for (let index = 0; index < (page.imageCopies ?? 1); index++) {
        const image = reserve(); images.push(image);
        set(image, [Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${page.imageWidth ?? 1224} /Height 1584 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from("\nendstream")]);
        drawing += `q 612 0 0 792 0 0 cm /Scan${index} Do Q\n`;
      }
    }
    if (page.text) drawing += `BT /F1 16 Tf 50 730 Td (${page.text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")}) Tj ET\n`.repeat(page.textRepeats ?? 1);
    if (page.compressed) {
      const encoded = deflateSync(page.rawContent ?? Buffer.from(drawing));
      set(contents, [Buffer.from(`<< /Length ${encoded.length} /Filter /FlateDecode >>\nstream\n`), encoded, Buffer.from("\nendstream")]);
    } else {
      set(contents, `<< /Length ${Buffer.byteLength(drawing)} >>\nstream\n${drawing}endstream`);
    }
    const contentRefs = page.contentStreams?.map(raw => {
      const stream = reserve();
      const encoded = deflateSync(raw);
      set(stream, [Buffer.from(`<< /Length ${encoded.length} /Filter /FlateDecode >>\nstream\n`), encoded, Buffer.from("\nendstream")]);
      return `${stream} 0 R`;
    });
    set(id, `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 ${page.width ?? 612} 792] ${page.rotation ? `/Rotate ${page.rotation}` : ""} /Resources << /Font << /F1 ${font} 0 R >> ${images.length ? `/XObject << ${images.map((image, index) => `/Scan${index} ${image} 0 R`).join(" ")} >>` : ""} >> /Contents ${contentRefs ? `[${contentRefs.join(" ")}]` : `${contents} 0 R`} >>`);
  }
  set(catalog, `<< /Type /Catalog /Pages ${pageTree} 0 R >>`);
  set(pageTree, `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] >>`);
  if (paddingBytes > 0) {
    const padding = reserve();
    set(padding, [Buffer.from(`<< /Length ${paddingBytes} >>\nstream\n`), Buffer.alloc(paddingBytes), Buffer.from("\nendstream")]);
  }
  let encryption: number | null = null;
  if (encrypted) {
    encryption = reserve();
    set(encryption, `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${"00".repeat(32)}> /U <${"11".repeat(32)}> /P -4 >>`);
  }
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0]; let length = parts[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const objectParts = [Buffer.from(`${index + 1} 0 obj\n`), ...(Array.isArray(object) ? object : [object]), Buffer.from("\nendobj\n")];
    parts.push(...objectParts); length += objectParts.reduce((sum, part) => sum + part.length, 0);
  });
  const xref = length;
  parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R ${encryption ? `/Encrypt ${encryption} 0 R /ID [<${"00".repeat(16)}> <${"00".repeat(16)}>]` : ""} >>\nstartxref\n${xref}\n%%EOF\n`));
  return Buffer.concat(parts);
}
