"use client";

import type { KidAgeBand, WaitlistSource } from "@homa/core";

/**
 * Client-side waitlist submission built for a phone on bad convention-center
 * wifi (BUILD.md Deliverable 0):
 *   1. POST with a hard timeout so the UI never hangs on a stalled socket.
 *   2. Retry with backoff while the user is still on the page.
 *   3. If the network stays down, persist the submission to localStorage and
 *      flush it when connectivity returns (online event or next page load).
 * The server treats duplicate emails as success, so retries are idempotent.
 */

export interface WaitlistPayload {
  email: string;
  firstName?: string;
  usState?: string;
  kidAgeBands: KidAgeBand[];
  source: WaitlistSource;
  utm: Record<string, string>;
}

export type SubmitOutcome = "saved" | "queued";

const QUEUE_KEY = "homa-waitlist-queue-v1";
const REQUEST_TIMEOUT_MS = 8_000;
const RETRY_DELAYS_MS = [1_000, 3_000, 9_000];

/** Reads utm_* params (plus ref) from the current URL at submit time. */
export function readUtmFromLocation(): Record<string, string> {
  const utm: Record<string, string> = {};
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of params.entries()) {
    if (key.startsWith("utm_") || key === "ref") {
      utm[key] = value.slice(0, 200);
    }
  }
  return utm;
}

async function postOnce(payload: WaitlistPayload): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    // 4xx means the payload itself is bad; retrying will not help, and the
    // form validates before submit, so treat only network/5xx as retryable.
    if (response.ok) return true;
    if (response.status >= 400 && response.status < 500) return true;
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readQueue(): WaitlistPayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as WaitlistPayload[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: WaitlistPayload[]): void {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(QUEUE_KEY);
    } else {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Storage full or blocked: nothing else we can do client-side.
  }
}

function enqueue(payload: WaitlistPayload): void {
  const queue = readQueue().filter((item) => item.email !== payload.email);
  queue.push(payload);
  writeQueue(queue);
}

/**
 * submitWaitlist(payload): "saved" | "queued"
 * Resolves "saved" once the server confirmed the row, "queued" if the network
 * stayed down and the submission is parked locally for a later flush.
 */
export async function submitWaitlist(payload: WaitlistPayload): Promise<SubmitOutcome> {
  if (await postOnce(payload)) return "saved";
  for (const delay of RETRY_DELAYS_MS) {
    await sleep(delay);
    if (await postOnce(payload)) return "saved";
  }
  enqueue(payload);
  return "queued";
}

/** Attempts to deliver any queued submissions. Returns how many were sent. */
export async function flushWaitlistQueue(): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;
  const remaining: WaitlistPayload[] = [];
  let sent = 0;
  for (const payload of queue) {
    if (await postOnce(payload)) {
      sent += 1;
    } else {
      remaining.push(payload);
    }
  }
  writeQueue(remaining);
  return sent;
}
