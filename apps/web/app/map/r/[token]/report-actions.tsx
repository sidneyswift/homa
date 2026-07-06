"use client";

import { useEffect } from "react";

/**
 * Client sliver of the report page: the view beacon (fired once per load,
 * with entry source) and the share/print row. Everything else on the
 * report renders on the server.
 */
export function ReportActions({
  leadId,
  childId,
  childName,
  token,
}: {
  leadId: string;
  childId: string;
  childName: string;
  token: string;
}) {
  useEffect(() => {
    const fresh = new URLSearchParams(window.location.search).has("fresh");
    void fetch("/api/map/report-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, childId, entry: fresh ? "instant" : "link" }),
    }).catch(() => undefined);
  }, [leadId, childId]);

  async function share() {
    const url = `${window.location.origin}/map/r/${token}`;
    const payload = { title: `${childName}'s progress report`, text: `A first look at where ${childName} stands.`, url };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
    } catch {
      // Fall through to clipboard when the sheet is dismissed or unsupported.
    }
    try {
      await navigator.clipboard.writeText(url);
      window.alert("Link copied.");
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <span className="inline-flex flex-wrap gap-x-4 gap-y-1 print:hidden">
      <button type="button" onClick={() => void share()} className="text-brand underline-offset-2 hover:underline">
        share this report
      </button>
      <button type="button" onClick={() => window.print()} className="text-brand underline-offset-2 hover:underline">
        print it
      </button>
      <a
        href={`mailto:hello@mail.thankshoma.com?subject=${encodeURIComponent(`Something looks off on ${childName}'s progress report`)}`}
        className="text-brand underline-offset-2 hover:underline"
      >
        something look off? tell me
      </a>
      <a
        href={`mailto:hello@mail.thankshoma.com?subject=${encodeURIComponent("Please delete my family's data")}`}
        className="text-brand underline-offset-2 hover:underline"
      >
        delete my family&apos;s data
      </a>
    </span>
  );
}
