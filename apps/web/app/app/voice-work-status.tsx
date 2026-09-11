import { QuietFrame } from "../../components/design/QuietFrame";

export function VoiceWorkStatus({ voiceActive }: { voiceActive: boolean }) {
  return (
    <QuietFrame tone="paper" className="p-4">
      <p className="font-semibold text-strong">Working on your request</p>
      <p className="mt-1 text-sm text-muted">
        {voiceActive
          ? "You can keep talking. The result will appear here."
          : "Your request is still running. Keep this chat open for the result."}
      </p>
    </QuietFrame>
  );
}
