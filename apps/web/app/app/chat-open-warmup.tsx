"use client";

import { useEffect } from "react";

import { startChatOpenWarmup } from "../../lib/chat-open-warmup";

/** Mounted only for the server-selected preview fixture. No Send dependency. */
export function ChatOpenWarmup() {
  useEffect(() => startChatOpenWarmup().cancel, []);
  return null;
}
