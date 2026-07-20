import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { PageColumn } from "../../../components/dashboard/page-column";
import { getShelfBooks } from "./actions";
import { ShelfView } from "./shelf-view";

/**
 * /app/shelf (Carolyng ask, 2026-07-19): the family's bookshelf — a
 * place to upload photos of homeschool books and reference texts so
 * Homa can reference them when building lessons and unit studies.
 * Auth enforced by the app layout; data scoped by RLS.
 */

export const metadata: Metadata = {
  title: "Shelf",
  robots: { index: false },
};

export default async function ShelfPage() {
  const data = await getAppData();
  if (!data) redirect("/onboarding");

  const books = await getShelfBooks();

  return (
    <PageColumn>
      <ShelfView books={books} familyId={data.family.id} />
    </PageColumn>
  );
}
