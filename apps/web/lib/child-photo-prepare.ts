/**
 * Browser-side photo preparation for child profile photos (D4 photo
 * personalization). The camera original never leaves the device: the
 * photo is decoded and redrawn here at reference size, which
 *   1. keeps the upload small enough to ride the settings server action
 *      (a phone photo is 3 to 10 MB; this produces a few hundred KB),
 *   2. drops EXIF metadata, including the GPS location phone cameras
 *      embed, because a canvas re-encode carries pixels only, and
 *   3. is all the image model needs from a style reference.
 */

/** Long-edge target: matches what generate_image can actually use. */
const MAX_EDGE_PX = 1024;
const JPEG_QUALITY = 0.85;

async function decodeToBitmap(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Some browser and format pairs (older Safari with certain HEICs)
    // fail createImageBitmap but still decode through an <img>.
    try {
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      return null;
    }
  }
}

/**
 * prepareChildPhotoForUpload(file): Promise<Blob | null>
 * A downscaled JPEG ready for the settings action, or null when the
 * file cannot be decoded as an image in this browser (the caller shows
 * a try-a-different-photo message).
 */
export async function prepareChildPhotoForUpload(file: File): Promise<Blob | null> {
  const source = await decodeToBitmap(file);
  if (!source) return null;

  const sourceWidth = source.width;
  const sourceHeight = source.height;
  if (!sourceWidth || !sourceHeight) return null;

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  // A transparent PNG source gets a white ground: the output is JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  if ("close" in source) source.close();

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
  });
}
