"use client";

import { useEffect } from "react";

import { flushWaitlistQueue } from "../lib/waitlist-client";

export function WaitlistQueueFlusher() {
  useEffect(() => {
    let flushing = false;

    async function flushQueuedSubmissions() {
      if (flushing || navigator.onLine === false) return;
      flushing = true;
      try {
        await flushWaitlistQueue();
      } finally {
        flushing = false;
      }
    }

    void flushQueuedSubmissions();
    window.addEventListener("online", flushQueuedSubmissions);
    return () => window.removeEventListener("online", flushQueuedSubmissions);
  }, []);

  return null;
}
