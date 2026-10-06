"use client";

/** Page failures stay inside the persistent conversation layout. */
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <div role="alert"><p>This page couldn’t load. Your conversation is still here.</p><button onClick={reset}>Try again</button></div>;
}
