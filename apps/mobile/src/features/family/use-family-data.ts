import type { MobileBootstrapFailureReason } from "@homa/core";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  getMyChildren,
  getMyFamily,
  getMyMemberDisplayName,
  type ChildRecord,
  type FamilyRecord,
} from "../../lib/family";
import { useSession } from "../auth/session-provider";
import { runMobileBootstrapStep } from "../bootstrap/mobile-bootstrap";

export interface FamilyData {
  family: FamilyRecord | null;
  children: ChildRecord[];
  memberDisplayName: string | null;
  loading: boolean;
  error: string | null;
  failureReason: MobileBootstrapFailureReason | null;
  reload: () => Promise<void>;
}

const FamilyDataContext = createContext<FamilyData | null>(null);

function useFamilyDataState(): FamilyData {
  const { session, initializing } = useSession();
  const [family, setFamily] = useState<FamilyRecord | null>(null);
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [memberDisplayName, setMemberDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failureReason, setFailureReason] =
    useState<MobileBootstrapFailureReason | null>(null);
  const attemptRef = useRef(0);

  const reload = useCallback(async () => {
    const attempt = ++attemptRef.current;
    if (!session) {
      setFamily(null);
      setChildren([]);
      setMemberDisplayName(null);
      setError(null);
      setFailureReason(null);
      setLoading(initializing);
      return;
    }
    setLoading(true);
    setError(null);
    setFailureReason(null);
    const result = await runMobileBootstrapStep("family", async () => {
      const nextFamily = await getMyFamily();
      const [nextChildren, nextMemberDisplayName] = nextFamily
        ? await Promise.all([
            getMyChildren(nextFamily.id),
            getMyMemberDisplayName(),
          ])
        : [[], null];
      return { nextFamily, nextChildren, nextMemberDisplayName };
    });
    if (attempt !== attemptRef.current) return;
    if (result.ok) {
      setFamily(result.value.nextFamily);
      setChildren(result.value.nextChildren);
      setMemberDisplayName(result.value.nextMemberDisplayName);
    } else {
      setError("family-unavailable");
      setFailureReason(result.reason);
    }
    setLoading(false);
  }, [initializing, session]);

  useEffect(() => {
    if (initializing) return;
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [initializing, reload]);

  return {
    family,
    children,
    memberDisplayName,
    loading,
    error,
    failureReason,
    reload,
  };
}

/** Shares the caller's family snapshot across the signed-in native shell. */
export function FamilyDataProvider({ children }: { children: ReactNode }) {
  const value = useFamilyDataState();
  return createElement(FamilyDataContext.Provider, { value }, children);
}

/** Reads the shared family snapshot and its manual reload action. */
export function useFamilyData(): FamilyData {
  const value = useContext(FamilyDataContext);
  if (!value) {
    throw new Error("useFamilyData must run inside FamilyDataProvider");
  }
  return value;
}
