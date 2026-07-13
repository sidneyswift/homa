import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getFamilyHeader, type FamilyHeader } from "../../../../lib/admin/family-deep-data";
import { FamilyTabs } from "./family-tabs";

/**
 * The slim header + tab strip every family-file chapter shares. The
 * Overview page keeps its own richer header (journey, pills) and only
 * mounts the tabs; the deep tabs mount this whole shell.
 */

export async function FamilyShell({
  familyId,
  title,
  sub,
  children,
}: {
  familyId: string;
  title: string;
  sub?: string;
  children: (header: FamilyHeader) => ReactNode;
}) {
  const header = await getFamilyHeader(familyId);
  if (!header) notFound();

  return (
    <div>
      <Link
        href="/admin/families"
        className="text-sm font-semibold text-[var(--clay-600)] hover:underline"
      >
        Back to families
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-2xl font-bold text-strong">{header.name}</h1>
        <span className="text-sm text-muted">{title}</span>
      </div>
      {sub ? <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p> : null}
      <FamilyTabs familyId={familyId} />
      <div className="mt-5">{children(header)}</div>
    </div>
  );
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}
