import React from "react";

import type { LibraryOriginalFile } from "../../../lib/materials/library-shelf";

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

export function OriginalFileLinks({ files }: { files: LibraryOriginalFile[] }) {
  if (files.length === 0) return null;

  return (
    <div className="mt-3">
      <p
        id="library-original-files-heading"
        className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-subtle"
      >
        {files.length === 1 ? "Original file" : `Original files · ${files.length}`}
      </p>
      <ul aria-labelledby="library-original-files-heading" className="mt-1.5 space-y-2">
        {files.map((file, index) => {
          const position = files.length === 1 ? "" : ` ${index + 1} of ${files.length}`;
          return (
            <li key={file.url}>
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open original file${position}: ${file.name}`}
                className="block min-h-11 rounded-md border border-border-subtle bg-card px-3 py-2 text-[var(--clay-600)] hover:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-500)]"
              >
                <span className="block text-[0.76rem] font-bold">
                  {files.length === 1 ? "Open the original" : `Open file ${index + 1}`}
                </span>
                <span className="mt-0.5 block break-words text-[0.66rem] font-medium text-muted">
                  {file.name}
                </span>
                <span aria-hidden="true" className="mt-0.5 block text-[0.64rem] text-subtle">
                  {formatBytes(file.size)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
