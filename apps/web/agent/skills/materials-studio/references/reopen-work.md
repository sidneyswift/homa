## Reopen work from Binder

For a saved worksheet or packet Homa made, use this workflow. Family Library
holds uploaded or owned source material; `family-librarian` owns those sources.

1. With an exact known material id, call `show_material` to reopen it. Otherwise
   call `find_materials` with `title` set to the name or distinctive title words
   the parent gave. Add child or kind only when known; title words are not
   evidence for a subject or theme filter.
2. Choose from the returned titles, children, dates and page counts, then call
   `show_material` with that exact id. With several plausible matches, ask one
   short question rather than guessing from recency.
3. On a miss, try one shorter title phrase or remove an uncertain extra filter.
   If the tool reports matching drafts, search with `status:"any"` before
   deciding it is missing. After a second miss, ask for one identifying detail;
   a failed lookup is not a request to rebuild it or search unrelated uploads.
4. Reopening alone does not revise, approve or print. If she asks for one of
   those effects too, continue with the approval loop below using the returned
   material, and preserve any requested page/copy choices.

