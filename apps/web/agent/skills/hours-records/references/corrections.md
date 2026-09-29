# Corrections preserve the rest of the day

1. Read find_hours for the requested child and dates. Identify the exact entries,
   not every entry whose subject is co-op. Home learning remains untouched.
2. Inspect each exact entry with inspect_hours_entry. Use its fresh revision and
   fields. A child filter does not turn a shared activity into child-owned data.
3. Use child scope when correcting the selected child. It splits a shared Planner
   activity if needed and preserves the other participants. Use shared scope only
   when the parent requests the correction for every linked participant. For a
   whole-family entry with no explicit child, clarify the participants before
   promising a child-only correction; that split is not supported by this tool.
4. Preserve category, note and subject unless the parent requested a change. Use
   actual supplied minutes. Never substitute one minute for unknown duration.
5. Call correct_hours_entry with update or remove. Removal removes time, not the
   fact that the Planner activity happened. On conflict, inspect again and check
   whether the requested state already landed; never blindly retry or re-add.
6. Read back the affected child/date and confirm the actual result. If replacing
   an umbrella entry with classes, first review the complete replacement with the
   parent, remove only identified old time, then record the actual distinct classes
   through Planner. Report partial completion honestly if any step fails.
