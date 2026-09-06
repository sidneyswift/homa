"use client";

import { useEffect, useRef, useState } from "react";

import type { ResolvedAssessmentAction } from "../../lib/child-progress/assessment-intent";
import { clearSelectedAssessment, selectedAssessmentStatus } from "./assessment-actions";
import type { ChatSendAcceptance, ChatSendSource } from "./chat-send-policy";

export function useSelectedAssessment(input: {
  action: ResolvedAssessmentAction | null;
  storageKey: string;
  ready: boolean;
  walled: boolean;
  send: (message: string, source: ChatSendSource) => ChatSendAcceptance;
}) {
  const [state, setState] = useState<"opening" | "accepted" | "uncertain" | "unavailable">("opening");
  const [retry, setRetry] = useState(0);
  const sendRef = useRef(input.send);
  const dispatched = useRef(new Set<string>());
  useEffect(() => { sendRef.current = input.send; });
  const action = input.action;
  useEffect(() => {
    if (!action || !input.ready || input.walled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const key = `${input.storageKey}:assessment:${action.requestId}`;
    const pointer = {requestId: action.requestId, childId: action.childId, subjectId: action.subjectId};
    const finish = async () => {
      if (cancelled) return;
      setState("accepted");
      try { sessionStorage.removeItem(key); } catch { /* Durable receipt is authoritative. */ }
      await clearSelectedAssessment(pointer).catch(() => undefined);
      if (cancelled) return;
      const url = new URL(window.location.href);
      if (url.searchParams.get("request") === action.requestId) {
        for (const name of ["assessment", "child", "subject", "request"]) url.searchParams.delete(name);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    };
    const poll = async (remaining: number) => {
      const result = await selectedAssessmentStatus(pointer).catch(() => ({status: "unavailable" as const}));
      if (cancelled) return;
      if (result.status === "accepted") { await finish(); return; }
      if (remaining <= 0 || result.status === "unavailable") { setState("uncertain"); return; }
      timer = setTimeout(() => { void poll(remaining - 1); }, 3000);
    };
    void (async () => {
      const receipt = await selectedAssessmentStatus(pointer).catch(() => ({status: "unavailable" as const}));
      if (cancelled) return;
      if (receipt.status === "accepted") { await finish(); return; }
      if (receipt.status === "unavailable") { setState("unavailable"); return; }
      let previouslySent = dispatched.current.has(key);
      try { previouslySent ||= sessionStorage.getItem(key) !== null; } catch { /* In-memory guard remains. */ }
      if ((previouslySent && retry === 0) || dispatched.current.has(`${key}:attempt:${retry}`)) { setState("uncertain"); void poll(20); return; }
      dispatched.current.add(key);
      dispatched.current.add(`${key}:attempt:${retry}`);
      try { sessionStorage.setItem(key, "dispatching"); } catch { /* The server still deduplicates this action. */ }
      setState("opening");
      const result = sendRef.current(action.message, {kind: "assessment_action", assessmentAction: pointer});
      if (result === "rejected") {
        dispatched.current.delete(key);
        try { sessionStorage.removeItem(key); } catch { /* No request was accepted. */ }
        setState("unavailable");
        return;
      }
      void poll(20);
    })();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [action, input.ready, input.storageKey, input.walled, retry]);
  return {state, retry: () => setRetry(value => value + 1)};
}
