"use client";

import {
  planActivityCheckResponseSchema,
  type PlanActivityCheckRequest,
  type PlanActivityCheckResponse,
} from "@homa/core";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { DashboardPlan } from "./plan-week";

export interface AuthenticatedPlanCheckSeed {
  childId: string;
  subjectId: string;
  planRevision: number;
  progressRevision: number;
  progress: Record<string, boolean>;
}

interface PendingCheck extends PlanActivityCheckRequest {
  mutationId: number;
  epoch: number;
}

type PlanCheckRequester = (
  input: PlanActivityCheckRequest,
) => Promise<PlanActivityCheckResponse>;

const CONFLICT_MESSAGE =
  "That check was not changed. Homa refreshed the plan so the boxes show the server copy.";
const STALE_CONTEXT_MESSAGE =
  "The plan changed while Homa was checking. I refreshed it so the boxes show the server copy.";
const UNCERTAIN_MESSAGE =
  "Homa couldn't confirm that check. I'm refreshing from the server.";
const PLAN_CHECK_REQUEST_TIMEOUT_MS = 10_000;
const PLAN_CHECK_RECONCILIATION_DELAYS_MS = [1_500, 5_000] as const;

function planKey(childId: string, subjectId: string): string {
  return `${childId}:${subjectId}`;
}

function checkScope(childId: string, subjectId: string, checkKey: string): string {
  return `${planKey(childId, subjectId)}:${checkKey}`;
}

export function authenticatedPlanCheckSeeds(
  plans: readonly DashboardPlan[],
): AuthenticatedPlanCheckSeed[] {
  return plans.flatMap((plan) =>
    plan.planRevision === null || plan.progressRevision === null
      ? []
      : [
          {
            childId: plan.childId,
            subjectId: plan.subjectId,
            planRevision: plan.planRevision,
            progressRevision: plan.progressRevision,
            progress: plan.progress,
          },
        ],
  );
}

export async function requestPlanActivityCheck(
  input: PlanActivityCheckRequest,
  options: {
    fetcher?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<PlanActivityCheckResponse> {
  const requestController = new AbortController();
  const timeout = setTimeout(
    () => requestController.abort(),
    options.timeoutMs ?? PLAN_CHECK_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await (options.fetcher ?? fetch)("/api/map/plan/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: requestController.signal,
    });
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new Error("plan check returned non-JSON");
    }
    const parsed = planActivityCheckResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("plan check returned a malformed receipt");
    }
    if (response.status === 409 && parsed.data.status === "conflict") {
      return parsed.data;
    }
    if (response.ok && parsed.data.status === "applied") {
      return parsed.data;
    }
    throw new Error("plan check returned an inconsistent status");
  } finally {
    clearTimeout(timeout);
  }
}

export class AuthenticatedPlanCheckController {
  private seeds = new Map<string, AuthenticatedPlanCheckSeed>();
  private snapshots = new Map<string, AuthenticatedPlanCheckSeed>();
  private pending = new Map<string, PendingCheck[]>();
  private queues = new Map<string, Promise<void>>();
  private epochs = new Map<string, number>();
  private blockedPlans = new Set<string>();
  private reconcilingPlans = new Set<string>();
  private listeners = new Set<() => void>();
  private reconciliationTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly reconciliationDelaysMs: readonly number[];
  private version = 0;
  private nextMutationId = 1;
  private message: string | null = null;

  constructor(
    seeds: readonly AuthenticatedPlanCheckSeed[],
    private requester: PlanCheckRequester = requestPlanActivityCheck,
    private refresh: () => void = () => undefined,
    options: { reconciliationDelaysMs?: readonly number[] } = {},
  ) {
    this.reconciliationDelaysMs =
      options.reconciliationDelaysMs ?? PLAN_CHECK_RECONCILIATION_DELAYS_MS;
    this.replaceSeeds(seeds, false);
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): number => this.version;

  setRefresh(refresh: () => void): void {
    this.refresh = refresh;
  }

  dispose(): void {
    for (const timer of this.reconciliationTimers) clearTimeout(timer);
    this.reconciliationTimers.clear();
    this.reconcilingPlans.clear();
  }

  replaceSeeds(
    nextSeeds: readonly AuthenticatedPlanCheckSeed[],
    notify = true,
  ): void {
    const next = new Map<string, AuthenticatedPlanCheckSeed>();
    for (const incoming of nextSeeds) {
      const key = planKey(incoming.childId, incoming.subjectId);
      const current = this.currentState(incoming.childId, incoming.subjectId);
      const currentIsNewer =
        current !== null &&
        (current.planRevision > incoming.planRevision ||
          (current.planRevision === incoming.planRevision &&
            current.progressRevision >= incoming.progressRevision));
      next.set(key, currentIsNewer ? current : incoming);
      if (
        current === null ||
        incoming.planRevision > current.planRevision ||
        (incoming.planRevision === current.planRevision &&
          incoming.progressRevision >= current.progressRevision)
      ) {
        this.blockedPlans.delete(key);
      }
    }
    for (const [key, pending] of this.pending) {
      if (pending.length === 0) continue;
      const currentPlanKey = planKey(pending[0].childId, pending[0].subjectId);
      const seed = next.get(currentPlanKey);
      if (!seed || seed.planRevision !== pending[0].planRevision) {
        this.invalidatePlan(currentPlanKey, STALE_CONTEXT_MESSAGE, false);
      }
      if (!this.pending.has(key)) continue;
    }
    this.seeds = next;
    for (const [key, snapshot] of this.snapshots) {
      const seed = next.get(key);
      if (
        !seed ||
        seed.planRevision !== snapshot.planRevision ||
        seed.progressRevision >= snapshot.progressRevision
      ) {
        this.snapshots.delete(key);
      }
    }
    if (notify) this.notify();
  }

  isWritable(childId: string, subjectId: string): boolean {
    const key = planKey(childId, subjectId);
    return this.seeds.has(key) && !this.blockedPlans.has(key);
  }

  isChecked(childId: string, subjectId: string, key: string): boolean {
    const scope = checkScope(childId, subjectId, key);
    const optimistic = this.pending.get(scope)?.at(-1);
    if (optimistic) return optimistic.done;
    return Boolean(this.currentState(childId, subjectId)?.progress[key]);
  }

  isPending(childId: string, subjectId: string, key: string): boolean {
    return (this.pending.get(checkScope(childId, subjectId, key))?.length ?? 0) > 0;
  }

  getMessage(): string | null {
    return this.message;
  }

  clearMessage(): void {
    if (this.message === null) return;
    this.message = null;
    this.notify();
  }

  refreshFromServer(): void {
    this.refresh();
  }

  toggle(input: {
    childId: string;
    subjectId: string;
    checkKey: string;
    expectedText: string;
  }): void {
    const targetPlanKey = planKey(input.childId, input.subjectId);
    const state = this.currentState(input.childId, input.subjectId);
    if (!state || this.blockedPlans.has(targetPlanKey)) return;
    const scope = checkScope(input.childId, input.subjectId, input.checkKey);
    const operation: PendingCheck = {
      ...input,
      done: !this.isChecked(input.childId, input.subjectId, input.checkKey),
      planRevision: state.planRevision,
      mutationId: this.nextMutationId++,
      epoch: this.epochs.get(targetPlanKey) ?? 0,
    };
    this.pending.set(scope, [...(this.pending.get(scope) ?? []), operation]);
    this.notify();

    const prior = this.queues.get(scope) ?? Promise.resolve();
    const queued = prior
      .catch(() => undefined)
      .then(() => this.execute(operation));
    this.queues.set(scope, queued);
    void queued.finally(() => {
      if (this.queues.get(scope) === queued) this.queues.delete(scope);
    });
  }

  async settled(): Promise<void> {
    while (this.queues.size > 0) {
      await Promise.all([...this.queues.values()]);
    }
  }

  private currentState(
    childId: string,
    subjectId: string,
  ): AuthenticatedPlanCheckSeed | null {
    const key = planKey(childId, subjectId);
    const seed = this.seeds.get(key);
    if (!seed) return null;
    const snapshot = this.snapshots.get(key);
    if (
      snapshot &&
      snapshot.planRevision === seed.planRevision &&
      snapshot.progressRevision >= seed.progressRevision
    ) {
      return snapshot;
    }
    return seed;
  }

  private async execute(operation: PendingCheck): Promise<void> {
    const key = planKey(operation.childId, operation.subjectId);
    if ((this.epochs.get(key) ?? 0) !== operation.epoch) return;
    const state = this.currentState(operation.childId, operation.subjectId);
    if (!state || state.planRevision !== operation.planRevision) {
      this.invalidatePlan(key, STALE_CONTEXT_MESSAGE);
      return;
    }

    let response: PlanActivityCheckResponse;
    try {
      response = await this.requester(operation);
    } catch {
      // A lost receipt cannot prove whether this write committed. Never replay
      // it: another device may already have written a newer intent to the same
      // key. Read-only reconciliation preserves the database's final order.
      if ((this.epochs.get(key) ?? 0) !== operation.epoch) {
        this.scheduleReconciliation(key);
        return;
      }
      this.invalidatePlan(key, UNCERTAIN_MESSAGE, true, true);
      return;
    }
    if ((this.epochs.get(key) ?? 0) !== operation.epoch) {
      this.refresh();
      this.scheduleReconciliation(key);
      return;
    }
    if (response.status === "conflict") {
      this.invalidatePlan(key, CONFLICT_MESSAGE);
      return;
    }
    if (
      response.planRevision !== operation.planRevision ||
      response.checkKey !== operation.checkKey ||
      response.done !== operation.done ||
      response.progress[operation.checkKey] !== operation.done
    ) {
      this.invalidatePlan(key, UNCERTAIN_MESSAGE);
      return;
    }

    const current = this.currentState(operation.childId, operation.subjectId);
    if (
      current &&
      current.planRevision === response.planRevision &&
      response.progressRevision >= current.progressRevision
    ) {
      this.snapshots.set(key, {
        childId: operation.childId,
        subjectId: operation.subjectId,
        planRevision: response.planRevision,
        progressRevision: response.progressRevision,
        progress: response.progress,
      });
    }
    this.removePending(operation);
    this.notify();
  }

  private removePending(operation: PendingCheck): void {
    const scope = checkScope(
      operation.childId,
      operation.subjectId,
      operation.checkKey,
    );
    const remaining = (this.pending.get(scope) ?? []).filter(
      (candidate) => candidate.mutationId !== operation.mutationId,
    );
    if (remaining.length === 0) this.pending.delete(scope);
    else this.pending.set(scope, remaining);
  }

  private invalidatePlan(
    key: string,
    message: string,
    refresh = true,
    reconcile = false,
  ): void {
    this.epochs.set(key, (this.epochs.get(key) ?? 0) + 1);
    this.blockedPlans.add(key);
    this.snapshots.delete(key);
    for (const [scope, operations] of this.pending) {
      if (
        operations[0] &&
        planKey(operations[0].childId, operations[0].subjectId) === key
      ) {
        this.pending.delete(scope);
      }
    }
    this.message = message;
    this.notify();
    if (refresh) this.refresh();
    if (reconcile) this.scheduleReconciliation(key);
  }

  private scheduleReconciliation(key: string): void {
    if (this.reconcilingPlans.has(key)) return;
    this.reconcilingPlans.add(key);
    let remaining = this.reconciliationDelaysMs.length;
    if (remaining === 0) {
      this.reconcilingPlans.delete(key);
      return;
    }
    for (const delayMs of this.reconciliationDelaysMs) {
      const timer = setTimeout(() => {
        this.reconciliationTimers.delete(timer);
        this.refresh();
        remaining -= 1;
        if (remaining === 0) this.reconcilingPlans.delete(key);
      }, delayMs);
      this.reconciliationTimers.add(timer);
    }
  }

  private notify(): void {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }
}

export function useAuthenticatedPlanChecks({
  plans,
  refresh,
}: {
  plans: readonly DashboardPlan[];
  refresh: () => void;
}) {
  const seeds = useMemo(() => authenticatedPlanCheckSeeds(plans), [plans]);
  return useAuthenticatedPlanCheckSeeds({ seeds, refresh });
}

export function useAuthenticatedPlanCheckSeeds({
  seeds,
  refresh,
}: {
  seeds: readonly AuthenticatedPlanCheckSeed[];
  refresh: () => void;
}) {
  const [controller] = useState(
    () =>
      new AuthenticatedPlanCheckController(
        seeds,
        requestPlanActivityCheck,
        refresh,
      ),
  );
  useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => {
    controller.setRefresh(refresh);
    controller.replaceSeeds(seeds);
  }, [controller, refresh, seeds]);

  useEffect(() => {
    const refreshOnFocus = () => controller.refreshFromServer();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") controller.refreshFromServer();
    };
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("online", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("online", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [controller]);

  useEffect(() => () => controller.dispose(), [controller]);

  return controller;
}
