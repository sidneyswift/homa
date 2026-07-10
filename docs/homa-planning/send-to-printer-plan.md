# Send-to-printer plan (founder ask, 2026-07-09 late)

Goal: Homa sends worksheets and other materials straight to the family's own
WiFi printer, so "print Maya's worksheet" in chat ends with paper coming out,
no dialog, no download. Founder framing: this is the magic feature. This doc
records how it is actually possible in 2026, the architecture, and the build
order. Status: proposed, not started. Research verified 2026-07-09 (sources
at the bottom).

## Why this is hard, in one paragraph

Homa runs on Vercel; the printer sits behind the family's router on a private
address (NAT). Nothing on the internet can connect inward to it. Every
remote-print product ever built puts a helper on the inside of the network
and has it connect outward: the printer's own firmware polling its vendor
cloud (email-to-print), a phone on the same WiFi (AirPrint), or a desktop
daemon (PrintNode). Browsers deliberately cannot print silently, so the web
app alone can never be the whole answer.

## The two doors Homa can use

1. **The printer's own cloud, via email.** Some printers have an email
   address in the vendor's cloud; anything mailed there prints automatically.
   Homa already sends transactional email through Resend
   (`apps/web/lib/map/email.ts`), and Resend supports PDF attachments
   (base64 `attachments`, 40MB cap). Fully server-side: works from chat, SMS,
   voice, and scheduled jobs ("want me to print it Sunday night?" in
   journeys/03 becomes literally possible while she sleeps).
2. **Her phone, already inside the house.** The Expo app (`apps/mobile`) acts
   as the print bridge. On iOS, `expo-print` gives a one-time printer picker
   (`Print.selectPrinterAsync()`, returns a persistent printer URL) and then
   `Print.printAsync({ uri, printerUrl })` prints with NO dialog. Virtually
   every WiFi printer sold since about 2014 speaks AirPrint, all brands.

Rejected: PrintNode-style relays (require a desktop client on an always-on
computer, wrong for the ICP), Google Cloud Print (dead since 2020), silent
printing from the browser or PWA (impossible by design).

## Vendor reality, verified 2026-07-09

| Route | Works on | Setup burden | Hands-free? |
|---|---|---|---|
| Email-to-print | Epson (Epson Connect Email Print: alive, 20MB, PDF); Brother select models (Attach Email and Print: first job released at the machine panel); HP released before fall 2020 only | Find the printer's email once | Yes, fully server-side |
| HP Print Anywhere (ePrint's replacement on newer HPs) | Newer HP | n/a | Closed to third parties: HP Smart app only, address is private |
| Canon consumer email print | Discontinued Nov 2017 | n/a | No |
| App AirPrint bridge | Essentially every WiFi printer since ~2014, all brands | Pick printer once in the Homa app | One tap, no dialog (iOS) |
| Browser print (today's `worksheet-card.tsx`) | Everything | None | No, always a dialog |

Conclusion: neither door alone covers everyone. Email-to-print is perfect but
only guaranteed on Epson; the app bridge covers every brand but needs the
mobile app installed. Architecture: **one print pipeline, three delivery
routes** (printer email, app bridge, browser print floor), best available
route per family.

## Architecture

Flow: parent asks in chat → agent calls a `send_to_printer` tool → tool
resolves the family's printer under RLS (familyId from auth context only) →
renders the PDF server-side → routes it:

- `kind = 'email'`: Resend send with the PDF attached, to the printer's
  stored address. Paper comes out via the vendor cloud.
- `kind = 'airprint'`: insert a `print_jobs` row; the mobile app picks it up
  (push tap or app open) and prints silently via the saved printer URL.
- No printer configured: tool refuses with a note offering the setup link;
  the chat card's browser print button remains the floor.

Chat never says "I emailed your printer"; it says "sent". The route is a
per-family detail, so new routes (Android IPP, the sandbox PDF factory) grow
the table without changing the tool contract or the promise to the parent.

### Pieces, mapped to the repo

1. **Server-side PDF (prerequisite).** Today printing is client-only:
   `printableHtml()` + `window.print()` in
   `apps/web/app/app/worksheet-card.tsx`. Email needs real PDF bytes on the
   server. Interim: `@react-pdf/renderer` (pure JS, no headless Chrome, fine
   on Vercel functions) in a new `apps/web/lib/print/worksheet-pdf.ts`,
   rendering the same `WorksheetPayload`. Freeze the contract now so the
   M0-03/M2-05 sandbox reportlab pipeline can swap in later:
   `renderWorksheetPdf(worksheet: WorksheetPayload): Promise<Buffer>`.
2. **`printers` table**, following the `hours_log` migration pattern
   (family_id FK, `is_family_member()` RLS policies):
   `id, family_id, label, kind check in ('email','airprint'), email,
   airprint_url, created_at`. Run `pnpm check:isolation` before landing.
3. **Attachment-capable send** beside `send()` in `lib/map/email.ts` (that
   function is html/text only). Same Resend endpoint plus
   `attachments: [{ filename, content: base64 }]`. Epson prints the email
   body too by default (parent can flip "attachments only" on her Epson
   Connect page), so the body stays one line.
4. **`send_to_printer` eve tool**, structurally mirroring
   `apps/web/agent/tools/send_followup_email.ts`: `createCallerDbClient`
   for the RLS-scoped client, rate limited, and the same anti-relay law:
   the model NEVER supplies a destination. The tool reads the printer row
   for the caller's family or refuses. New event
   `materials.sent_to_printer` goes in the MJ-08 registry
   (`pnpm check:events` stays green).
5. **Settings surface**: printer setup lives in `/app/settings`.
   Copy job: help her find her printer's email (Epson panel info sheet),
   plus the approved-senders note (if she enables Epson's Approved Senders
   list she must add `hello@mail.thankshoma.com`).
6. **Mobile bridge (later phase).** `npx expo install expo-print`; a
   "Set up my printer" screen calls `Print.selectPrinterAsync()` (iOS),
   persists `printer.url` (AsyncStorage + `printers` row); the worksheet
   card's button becomes `Print.printAsync({ uri, printerUrl })`. This flips
   the current mobile card copy ("Paper copies print from Homa on the web",
   `apps/mobile/src/features/chat/worksheet-card.tsx`). Known quirk: reuse
   the URL-from-storage path, not the in-memory cached UIPrinter (expo issue
   6964 shows the cached path flaking; the URL fallback path is the reliable
   one). Push-tap-to-print rides on expo-notifications once that lands.
   Android silent printing means speaking IPP to port 631 directly; Android
   starts with the system print sheet.

## Build order

1. **STP-1 · Epson-ready email route (1 to 2 days).** PDF renderer +
   `printers` migration + settings field + `send_to_printer` tool. Ships the
   full magic for Epson households (plus Brother and legacy HP) with zero new
   infrastructure.
2. **STP-2 · MJ-01 preflight, as already ticketed.** Letter+A4 margins,
   shrink-safe layouts, reprint, AirPrint help walkthrough, email-to-self
   fallback. The email route reuses all of it.
3. **STP-3 · Mobile AirPrint bridge.** Picker, silent print button,
   `print_jobs` queue with honest status in chat.
4. **STP-4 · Notification-tap printing, Sunday-night scheduled batch print
   (P2 batch-print ask in journeys/03), Android IPP.**

## Guards and laws that apply

- Tenant isolation: familyId from auth only; printer address never
  model-supplied; RLS policies on `printers` and `print_jobs`;
  `pnpm check:isolation` before any schema change.
- Event registry parity: `pnpm check:events` after adding
  `materials.sent_to_printer`.
- Voice laws on all new copy (setup guide, chat asides, failure states).
  Email-route jobs are fire-and-forget: we never truly know it printed, so
  chat copy promises "sent to your printer", offers "did it come out?" +
  one-tap reprint, never claims completion we cannot see.

## Founder decision queue

- **D-print-1: reverse the printing cut.** `15-agentic-architecture.md` §4
  records WiFi printing as deliberately cut ("browser print + email-to-self
  replace printing"). This plan reverses that. Log the reversal in
  `build-log.md` when STP-1 ships.
- **D-print-2: survey the waitlist for printer brands.** Decides whether the
  email tier covers 20% or 60% of families before the mobile app exists.
- **D-print-3: privacy policy naming.** A worksheet PDF carries a child's
  first name; sending it through Epson/Brother clouds makes those vendors
  processors. The 1-page privacy policy must name them.
- **D-print-4: interim PDF renderer.** `@react-pdf/renderer` now behind the
  frozen contract, or wait for the sandbox reportlab pipeline. Plan assumes
  the former.

## Sources (accessed 2026-07-09)

- HP: ePrint unsupported on printers released after fall 2020; Print
  Anywhere is HP Smart only, address private
  (support.hp.com ish_2060244-1929404-16; HP support community 9484530).
- Epson: Email Print active, 20MB / 10 attachments, PDF supported, Approved
  Senders optional (epsonconnect.com guide + FAQ).
- Brother: Attach Email and Print on select models, per-sender release at
  the machine (help.brother-usa.com a_id 158082).
- Canon: consumer Print from E-mail discontinued 2017-11-29 (Canon community
  service notice).
- Resend attachments: base64 `attachments`, 40MB per email, not on the batch
  endpoint (resend.com/docs).
- expo-print: `selectPrinterAsync` / `printAsync({ printerUrl })`, iOS
  dialog-free path; cached-printer flakiness workaround via stored URL
  (docs.expo.dev sdk/print; expo/expo issue 6964).
