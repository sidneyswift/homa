import { activeObjectKey, type ActiveObjectReference } from "@homa/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "expo-router";

import { useSession } from "../auth/session-provider";
import { useVoiceSession, type VoiceSession } from "./use-voice-session";

interface VoiceWorkbenchValue {
  session: VoiceSession;
  activeObject: ActiveObjectReference | null;
  showActiveObject: (reference: ActiveObjectReference) => void;
  clearActiveObject: (reference?: ActiveObjectReference) => void;
}

interface VisibleActiveObject {
  userId: string;
  pathname: string;
  reference: ActiveObjectReference;
}

const VoiceWorkbenchContext = createContext<VoiceWorkbenchValue | null>(null);

/**
 * Owns the logical Voice conversation above Expo Router's screen lifetime.
 * Product navigation can unmount any route without unmounting WebRTC state,
 * the ordered transcript, or Eve's continuation token.
 */
export function VoiceWorkbenchProvider({ children }: { children: ReactNode }) {
  const { session: authSession } = useSession();
  const pathname = usePathname();
  const authUserId = authSession?.user.id ?? null;
  const [visibleActiveObject, setVisibleActiveObject] = useState<VisibleActiveObject | null>(null);
  const previousAuthUserId = useRef<string | null>(authUserId);
  const activeObject = authUserId !== null
    && visibleActiveObject?.userId === authUserId
    && visibleActiveObject.pathname === pathname
    ? visibleActiveObject.reference
    : null;
  const voiceSession = useVoiceSession(activeObject, authUserId);
  const endVoice = voiceSession.end;

  useEffect(() => {
    if (previousAuthUserId.current !== authUserId) {
      previousAuthUserId.current = authUserId;
      setVisibleActiveObject(null);
      endVoice({ persist: false });
      return;
    }
    if (!authSession) {
      endVoice({ persist: false });
    }
  }, [authSession, authUserId, endVoice]);

  const showActiveObject = useCallback((reference: ActiveObjectReference) => {
    if (!authUserId) return;
    setVisibleActiveObject({ userId: authUserId, pathname, reference });
  }, [authUserId, pathname]);
  const clearActiveObject = useCallback((reference?: ActiveObjectReference) => {
    setVisibleActiveObject((current) => {
      if (!current || !reference) return null;
      return activeObjectKey(current.reference) === activeObjectKey(reference)
        ? null
        : current;
    });
  }, []);

  const value = useMemo(
    () => ({
      session: voiceSession,
      activeObject,
      showActiveObject,
      clearActiveObject,
    }),
    [activeObject, clearActiveObject, showActiveObject, voiceSession],
  );

  return (
    <VoiceWorkbenchContext.Provider value={value}>
      {children}
    </VoiceWorkbenchContext.Provider>
  );
}

export function useVoiceWorkbench(): VoiceWorkbenchValue {
  const value = useContext(VoiceWorkbenchContext);
  if (!value) throw new Error("useVoiceWorkbench must run inside VoiceWorkbenchProvider");
  return value;
}
