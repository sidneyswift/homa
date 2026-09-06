import { useRef, useState } from "react";
import { printPageSummary, type PrintHandoff } from "@homa/core";
import { Button } from "../../components/ui/button";
import { NativeSurface, NativeText } from "../../components/ui/semantic";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { quietSpace } from "../../theme/native-projection";
import { runPreparedMaterialPrint } from "../materials/material-print";

export function MaterialPrintCard({ handoff }: { handoff: PrintHandoff }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useAccessibilityAnnouncement(notice);
  async function print() {
    if (!handoff.ready || pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice("Checking the selected pages…");
    try { setNotice((await runPreparedMaterialPrint(handoff.request)).message); }
    catch { setNotice("I could not open the print options. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  }
  return (
    <NativeSurface style={{ padding: quietSpace.scale[4], gap: quietSpace.scale[2] }}>
      <NativeText role="label">{handoff.ready ? "Print request" : "Print preparation stopped"}</NativeText>
      {handoff.ready ? <>
        <NativeText role="display">{handoff.request.title}</NativeText>
        <NativeText>{printPageSummary(handoff.request)}</NativeText>
        <NativeText>{"Confirm the copies in Apple's print sheet."}</NativeText>
        <Button label={busy ? "Preparing print options…" : "Open print options"} busy={busy} disabled={busy} onPress={() => void print()} />
      </> : <NativeText>{handoff.note}</NativeText>}
      {notice ? <NativeText>{notice}</NativeText> : null}
    </NativeSurface>
  );
}
