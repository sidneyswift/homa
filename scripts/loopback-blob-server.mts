import { readFile } from "node:fs/promises";
import { createServer as createHttpServer, type Server } from "node:http";
import { resolve } from "node:path";

const BLOB_CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Serves a local artifact directory over loopback so the PDF renderer
 * (headless Chromium inside create_printable) can fetch the images the
 * studio generated during the same run, and the simulator can open the
 * finished PDFs. GET only, path-prefix guarded. Used by the eval sandbox
 * (throwaway directory) and the local stack (kept between runs).
 */
export function startBlobServer(
  blobDir: string,
  /** 0 picks a free port; the local stack pins one so stored URLs survive restarts. */
  port = 0,
): Promise<{ server: Server; url: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createHttpServer((request, response) => {
      void (async () => {
        try {
          const pathname = decodeURIComponent(
            new URL(request.url ?? "/", "http://sandbox").pathname,
          );
          const filePath = resolve(blobDir, pathname.replace(/^\/+/, ""));
          if (request.method !== "GET" || !filePath.startsWith(blobDir + "/")) {
            response.writeHead(404).end();
            return;
          }
          const body = await readFile(filePath);
          const extension = pathname.slice(pathname.lastIndexOf("."));
          response
            .writeHead(200, {
              "content-type": BLOB_CONTENT_TYPES[extension] ?? "application/octet-stream",
            })
            .end(body);
        } catch {
          response.writeHead(404).end();
        }
      })();
    });
    server.once("error", rejectPromise);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        rejectPromise(new Error("blob server: could not allocate a port"));
        return;
      }
      resolvePromise({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}
