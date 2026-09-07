"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HOURS_SUBJECTS, type HoursSubject } from "../../../lib/hours-model";
import { SUBJECT_LABELS } from "../../../lib/hours-view";
import type { HoursCategory } from "../../../lib/hours-categories";
import { QuietAction } from "../../../components/design/QuietAction";
import { getHoursCategoriesAction, saveHoursCategoryAction } from "./actions";

export const CATEGORY_FIELD = "min-h-11 w-full min-w-0 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-3 py-2 text-sm text-[color:var(--homa-ink)]";

export function useHoursCategories() {
  const [categories, setCategories] = useState<HoursCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [, startTransition] = useTransition();
  useEffect(() => {
    let active = true;
    startTransition(async () => {
      try {
        const result = await getHoursCategoriesAction();
        if (!active) return;
        setCategories(result.categories ?? []); setError(result.error); setLoaded(true);
      } catch { if (active) { setError("Categories couldn't load. Try again."); setLoaded(true); } }
    });
    return () => { active = false; };
  }, [revision]);
  return { categories, error, loaded, reload: () => { setRevision(value => value + 1); } };
}

export function HoursCategoryManager({ categories, onSaved }: { categories: HoursCategory[]; onSaved: (category: HoursCategory) => void }) {
  const router = useRouter();
  const [subject, setSubject] = useState<HoursSubject>("reading");
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = categories.find(category => category.id === selectedId);
  return <details className="mt-4 border-y border-[var(--homa-control-boundary)]">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Manage categories</summary>
    <p className="mb-3 text-sm">Save categories for your family to reuse, even before you log time. Renaming a category updates its existing entries.</p>
    <form className="flex flex-col gap-3 pb-4" onSubmit={event => {
      event.preventDefault(); setMessage(null);
      startTransition(async () => {
        try {
          const result = await saveHoursCategoryAction({ subject, name, ...(selected ? { categoryId: selected.id, expectedName: selected.name } : {}) });
          if (result.error || !result.category) setMessage(result.error ?? "Category couldn't save.");
          else { onSaved(result.category); setSelectedId(""); setName(""); setMessage("Category saved."); router.refresh(); }
        } catch { setMessage("The change couldn't be confirmed. Reload categories to check."); }
      });
    }}>
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-3">
        <label className="text-sm font-semibold">Parent subject<select aria-label="Parent subject" className={CATEGORY_FIELD} value={subject} onChange={event => { setSubject(event.target.value as HoursSubject); setSelectedId(""); setName(""); }}>
          {HOURS_SUBJECTS.map(value => <option key={value} value={value}>{SUBJECT_LABELS[value]}</option>)}
        </select></label>
        <label className="text-sm font-semibold">Category to manage<select aria-label="Category to manage" className={CATEGORY_FIELD} value={selectedId} onChange={event => {
          const category = categories.find(row => row.id === event.target.value); setSelectedId(event.target.value); setName(category?.name ?? "");
        }}><option value="">Create a category</option>{categories.filter(row => row.subject === subject).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="text-sm font-semibold">{selected ? "New category name" : "Category name"}<input required value={name} className={CATEGORY_FIELD} onChange={event => setName(event.target.value)} aria-describedby="category-name-limit" /></label>
        <p id="category-name-limit" className="text-sm">Up to 40 characters.</p>
        <QuietAction kind="secondary" type="submit" disabled={pending || !name.trim() || Array.from(name.trim()).length > 40}>{pending ? "Saving…" : selected ? "Rename category" : "Save category"}</QuietAction>
      </fieldset>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </form>
  </details>;
}
