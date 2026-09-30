"use server";

import { correctHoursEntry } from "../../../lib/hours-corrections";
import { getAppShellData } from "../../../lib/app-data";
import {
  readHoursCategories,
  saveHoursCategory,
} from "../../../lib/hours-categories-server";
import type { SaveHoursCategory } from "../../../lib/hours-categories";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  hoursEditContextSchema,
  hoursMutationError,
  hoursNoteCharacterCount,
  type HoursEditContext,
} from "../../../lib/hours-edit";
import { isHoursSubject } from "../../../lib/hours-model";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export interface HoursActionState {
  error: string | null;
}

export async function getHoursEntryEditContextAction(
  entryId: string,
): Promise<
  { context: HoursEditContext; error: null } | { context: null; error: string }
> {
  if (!z.string().uuid().safeParse(entryId).success)
    return {
      context: null,
      error:
        "That time record couldn't be found. Close this editor and refresh the page.",
    };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_hours_entry_edit_context", {
      target_entry_id: entryId,
    });
    if (error)
      return {
        context: null,
        error: "That time record couldn't load. Try again.",
      };
    const parsed = hoursEditContextSchema.safeParse(data);
    return parsed.success && parsed.data.entry.id === entryId
      ? { context: parsed.data, error: null }
      : {
          context: null,
          error:
            hoursMutationError(data) ??
            "That time record couldn't load. Try again.",
        };
  } catch {
    return {
      context: null,
      error:
        "That time record couldn't load. Check your connection and try again.",
    };
  }
}

export async function updateHoursEntryAction(
  entryId: string,
  revision: string,
  formData: FormData,
): Promise<HoursActionState> {
  if (!z.string().uuid().safeParse(entryId).success)
    return {
      error:
        "That time record couldn't be found. Close this editor and refresh the page.",
    };
  const subject = String(formData.get("subject") ?? "");
  if (!isHoursSubject(subject))
    return { error: "Pick one of the listed subjects." };
  const minutes = Number(formData.get("minutes"));
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
    return { error: "Use a whole number of minutes between 1 and 600." };
  }
  const note = String(formData.get("note") ?? "").trim();
  const customLabel = String(formData.get("customLabel") ?? "").trim();
  if (hoursNoteCharacterCount(note) > 200)
    return { error: "Keep the note to 200 characters or fewer." };
  if (Array.from(customLabel).length > 40)
    return { error: "Keep the category name to 40 characters or fewer." };
  try {
    const supabase = await createSupabaseServerClient();
    const scope = formData.get("scope");
    if (scope === "child" || scope === "shared") {
      const shell = await getAppShellData();
      if (!shell) return { error: "Sign in to correct this record." };
      const result = await correctHoursEntry(
        { mode: "caller", familyId: shell.family.id, db: supabase },
        {
          entryId,
          revision,
          scope,
          operation: "update",
          subject,
          minutes,
          category: customLabel || null,
          note: note || null,
        },
      );
      revalidatePath("/app/planner");
      revalidatePath("/app/hours");
      return { error: hoursMutationError(result) };
    }
    const { data, error } = await supabase.rpc("update_hours_entry", {
      target_entry_id: entryId,
      target_revision: revision,
      target_subject: subject,
      target_minutes: minutes,
      target_custom_label: customLabel || null,
      target_note: note || null,
    });
    if (error)
      return {
        error:
          "The change couldn't be confirmed. Close this editor and reopen the time record to check before trying again.",
      };
    const failure = hoursMutationError(data);
    if (failure) return { error: failure };
    const receipt = z
      .object({ result: z.literal("applied"), entryId: z.string().uuid() })
      .safeParse(data);
    if (!receipt.success || receipt.data.entryId !== entryId)
      return {
        error:
          "The change couldn't be confirmed. Close this editor and reopen the time record to check.",
      };
    revalidatePath("/app/planner");
    revalidatePath("/app/hours");
    return { error: null };
  } catch {
    return {
      error:
        "The change couldn't be confirmed. Check your connection. Close this editor and reopen the time record.",
    };
  }
}

export async function deleteHoursEntryAction(
  entryId: string,
  revision: string,
  scope?: "child" | "shared",
): Promise<HoursActionState> {
  if (!z.string().uuid().safeParse(entryId).success)
    return {
      error:
        "That time record couldn't be found. Close this editor and refresh the page.",
    };
  try {
    const supabase = await createSupabaseServerClient();
    if (scope) {
      const shell = await getAppShellData();
      if (!shell) return { error: "Sign in to correct this record." };
      const result = await correctHoursEntry(
        { mode: "caller", familyId: shell.family.id, db: supabase },
        {
          entryId,
          revision,
          scope,
          operation: "remove",
          subject: null,
          minutes: null,
          category: null,
          note: null,
        },
      );
      revalidatePath("/app/planner");
      revalidatePath("/app/hours");
      return { error: hoursMutationError(result) };
    }
    const { data, error } = await supabase.rpc("delete_hours_entry", {
      target_entry_id: entryId,
      target_revision: revision,
    });
    if (error)
      return {
        error:
          "The deletion couldn't be confirmed. Close this editor and reopen the time record to check before trying again.",
      };
    const failure = hoursMutationError(data);
    if (failure) return { error: failure };
    const receipt = z
      .object({ result: z.literal("applied"), entryId: z.string().uuid() })
      .safeParse(data);
    if (!receipt.success || receipt.data.entryId !== entryId)
      return {
        error:
          "The change couldn't be confirmed. Close this editor and reopen the time record to check.",
      };
    revalidatePath("/app/planner");
    revalidatePath("/app/hours");
    return { error: null };
  } catch {
    return {
      error:
        "The deletion couldn't be confirmed. Check your connection. Close this editor and reopen the time record.",
    };
  }
}

export async function getHoursCategoriesAction() {
  try {
    const data = await getAppShellData();
    if (!data)
      return { categories: null, error: "Sign in to load your categories." };
    const db = await createSupabaseServerClient();
    return {
      categories: await readHoursCategories({
        mode: "caller",
        db,
        familyId: data.family.id,
      }),
      error: null,
    };
  } catch {
    return { categories: null, error: "Categories couldn't load. Try again." };
  }
}

export async function saveHoursCategoryAction(input: SaveHoursCategory) {
  try {
    const data = await getAppShellData();
    if (!data) return { error: "Sign in to save your category." };
    const db = await createSupabaseServerClient();
    const result = await saveHoursCategory(
      { mode: "caller", db, familyId: data.family.id },
      input,
    );
    if (result.status !== "saved")
      return {
        error:
          result.status === "duplicate"
            ? "That category already exists under this subject. Choose a different name."
            : result.status === "conflict"
              ? "This category changed. Reload it before renaming."
              : "The category couldn't save. Check its name and try again.",
      };
    revalidatePath("/app/planner");
    revalidatePath("/app/hours");
    return { error: null, category: result.category };
  } catch {
    return {
      error:
        "The change couldn't be confirmed. Reload categories to check before trying again.",
    };
  }
}
