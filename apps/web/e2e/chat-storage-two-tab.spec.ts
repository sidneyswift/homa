import { accessSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";

import serverlessChromium from "@sparticuz/chromium";
import {
  chromium as playwrightChromium,
  expect,
  test,
  type Browser,
} from "@playwright/test";
import ts from "typescript";

const storageKey = "homa-chat-two-tab-e2e";
const cacheSource = readFileSync(
  resolve(process.cwd(), "app/app/chat-session-cache.ts"),
  "utf8",
);
const cacheModule = ts.transpileModule(cacheSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

let browser: Browser;
let server: Server;
let origin: string;

async function chromiumLaunchOptions(): Promise<{
  executablePath: string;
  args: string[];
}> {
  const localCandidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  for (const candidate of localCandidates) {
    try {
      accessSync(candidate);
      return { executablePath: candidate, args: [] };
    } catch {
      // Try the next installed desktop browser.
    }
  }
  return {
    executablePath: await serverlessChromium.executablePath(),
    args: serverlessChromium.args,
  };
}

test.beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === "/chat-session-cache.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(cacheModule);
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>Homa chat cache test</title>");
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("two-tab fixture server did not bind a TCP port");
  }
  origin = `http://127.0.0.1:${address.port}`;
  browser = await playwrightChromium.launch({
    ...(await chromiumLaunchOptions()),
    headless: true,
  });
});

test.afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
});

test("two tabs preserve one session cursor and one complete event log", async () => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto(origin), second.goto(origin)]);

  for (const page of [first, second]) {
    await page.evaluate(async ({ key }) => {
      const loadCacheModule = new Function(
        "return import('/chat-session-cache.js')",
      ) as () => Promise<{
        mergeSavedSessionEvents(
          saved: Record<string, unknown>,
          incoming: Record<string, unknown>,
        ): Record<string, unknown>;
        withChatTurnLock<T>(
          storageKey: string,
          operation: () => Promise<T>,
        ): Promise<T>;
      }>;
      const { mergeSavedSessionEvents, withChatTurnLock } =
        await loadCacheModule();
      Object.assign(globalThis, {
        claimSession(candidate: string) {
          return withChatTurnLock(key, async () => {
            const raw = localStorage.getItem(key);
            const saved = raw ? JSON.parse(raw) : {};
            if (saved.session?.sessionId) return saved.session.sessionId;
            await new Promise((resolve) => setTimeout(resolve, 40));
            const session = { sessionId: candidate, streamIndex: 0 };
            localStorage.setItem(key, JSON.stringify({ session }));
            return candidate;
          });
        },
        writeChatRange(start: number, end: number) {
          const incoming = {
            events: Array.from({ length: end - start }, (_, offset) => ({
              type: "turn.started",
              data: { turnId: `event-${start + offset}` },
            })),
            session: {
              sessionId: "shared-session",
              streamIndex: end,
            },
            lastActivityAt: end,
          };
          const raw = localStorage.getItem(key);
          const saved = raw ? JSON.parse(raw) : {};
          localStorage.setItem(
            key,
            JSON.stringify(mergeSavedSessionEvents(saved, incoming)),
          );
        },
      });
    }, { key: storageKey });
  }

  const claimed = await Promise.all([
    first.evaluate(() =>
      (globalThis as typeof globalThis & {
        claimSession(candidate: string): Promise<string>;
      }).claimSession("session-from-first"),
    ),
    second.evaluate(() =>
      (globalThis as typeof globalThis & {
        claimSession(candidate: string): Promise<string>;
      }).claimSession("session-from-second"),
    ),
  ]);
  expect(new Set(claimed).size).toBe(1);

  await first.evaluate((key) => localStorage.removeItem(key), storageKey);

  await first.evaluate(() =>
    (globalThis as typeof globalThis & {
      writeChatRange(start: number, end: number): void;
    }).writeChatRange(0, 10),
  );
  await second.evaluate(() =>
    (globalThis as typeof globalThis & {
      writeChatRange(start: number, end: number): void;
    }).writeChatRange(10, 15),
  );
  // The older tab writes after the newer tab, the production clobber order.
  await first.evaluate(() =>
    (globalThis as typeof globalThis & {
      writeChatRange(start: number, end: number): void;
    }).writeChatRange(0, 10),
  );

  const saved = await second.evaluate((key) =>
    JSON.parse(localStorage.getItem(key) ?? "{}"),
    storageKey,
  );
  expect(saved.session).toEqual({
    sessionId: "shared-session",
    streamIndex: 15,
  });
  expect(saved.events).toHaveLength(15);
  expect(saved.events.map((event: { data: { turnId: string } }) => event.data.turnId))
    .toEqual(Array.from({ length: 15 }, (_, index) => `event-${index}`));

  await context.close();
});
