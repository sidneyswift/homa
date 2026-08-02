import type { MobileBootstrapFailureReason } from "@homa/core";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getMyChildren,
  getMyFamily,
  getMyMemberDisplayName,
  type ChildRecord,
  type FamilyRecord,
} from "../../lib/family";
import { runMobileBootstrapStep } from "../bootstrap/mobile-bootstrap";

interface FamilyData {
  family: FamilyRecord | null;
  children: ChildRecord[];
  memberDisplayName: string | null;
  loading: boolean;
  error: string | null;
  failureReason: MobileBootstrapFailureReason | null;
  reload: () => Promise<void>;
}

/** Loads the caller's family + children (RLS-scoped) with manual reload. */
export function useFamilyData(): FamilyData {
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
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [reload]);

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
