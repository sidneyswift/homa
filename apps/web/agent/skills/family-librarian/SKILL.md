---
description: Use to save, find, open, edit, delete, cite, or teach from family-owned or uploaded resources. Retrieve required family sources before another skill uses them. Homa-made Binder materials belong to materials-studio; curriculum decomposition to curriculum-mapping.
metadata:
  homa-related-skills: materials-studio, curriculum-studio, curriculum-mapping, planner
---

# Family librarian

The Family Library is the shelf for resources a family brings to Homa. Binder
is the shelf for work Homa creates. Keep that ownership line visible in every
decision: originals stay in Library, and later Homa outputs stay in Binder.
For a named Binder worksheet or packet, load `materials-studio` and follow its
reopening workflow; do not substitute Library source searches.

## Decide the Library action first

Choose one action from what the parent actually asked:

- Save something she already shared in chat.
- Find or list what the family already has.
- Open one exact source and cite it.
- Correct its title, resource type, child assignment, or subjects.
- Delete one exact original after confirmation.
- Retrieve a family source before handing off to planning or creation.

Do not turn a find request into a new upload, or an upload request into a
curriculum build. One honest Library action is better than a guessed workflow.

## Save a chat attachment

1. Call `find_attachments`. Pick by attachment id, caption, kind, and date. If
   more than one could be the target, ask one short question instead of guessing.
2. Call `save_family_asset` with that attachment id. Never pass or invent an
   arbitrary URL. The tool copies the original into Library and verifies family
   ownership again.
3. Trust the tool result. If it says the original is saved but its details need
   attention, say exactly that. Do not describe a metadata failure as a lost
   file.
4. If the parent supplied a correction, call `update_family_asset` only after
   save returns the asset id.

If she attached a file directly through the Library screen, it is already
saved. Search for it instead of saving the chat copy again.

## Find the family's source

1. Call `find_family_assets` with the parent's meaning in plain words. Add exact
   child, subject, kind, or status filters only when they narrow the actual request.
   For useful resources for a child, leave childId off so shared family resources
   remain candidates; judge returned assignments before choosing. An explicit
   request to list only that child's assigned files may use the strict filter.
2. Search results are candidates. Choose the best supported match, then call
   `get_family_asset` on that exact id before you use it or cite it.
3. When the parent requires a particular source, on a miss try one meaningfully different query once. A miss does not prove
   the family never uploaded it. After the second miss, ask for one identifying
   detail instead of substituting a public source or denying it exists.
4. When several results remain plausible, show a short choice using titles and
   dates. Never blend two sources into one imaginary resource.

## Use and cite one source

`get_family_asset` returns the selected original, an authenticated citation
link, and bounded evidence with its recorded provenance. Model evidence quotes
were verified against the source during processing. Parent evidence records a
parent's explicit correction and should be described that way.

- State the source as `Family Library: <title>` and link that title with
  `citationUrl` when the channel supports links.
- Include a page, sheet, or other `sourceLocator` when the relevant evidence has
  one.
- Claim only what the returned metadata and quotes support. The original URL is
  a reference input, not permission to invent unread sections.
- A processing or attention state does not erase the original. Tell the parent
  what is usable and what Homa could not organize.

Use the authenticated citation link. Current storage supports private originals
and legacy public originals; do not infer a file's privacy from Library membership.

## Hand off after retrieval

For a named owned lesson, a next-lessons packet, or a relevant owned teaching
resource, read `references/owned-lessons.md` before handing off. Targeted reading
is separate from saving units or mapping a whole curriculum.

When the output will use a family source, retrieval happens before creation:

1. Find the source.
2. Get the exact source and citation.
3. Then load the sibling that owns the requested effect:
   - `materials-studio` for a worksheet, page, packet, or printable.
   - `curriculum-studio` for a whole multi-week program Homa will author.
   - `planner` for adding or replacing a grounded activity in an existing plan.
4. Carry the exact asset id into the downstream write, not just into your prose:
   - On the first `create_printable` call, include it in
     `sourceFamilyAssetIds`, with exact `sourceFamilyEvidence` when using pages
     or a recorded source quote. On a revision, omit both fields to inherit the
     prior sources. Pass an empty array only when the parent deliberately asks
     to remove the source connection.
   - On an `edit_plan` add or replace, include it in
     `sourceFamilyAssetIds`. A remove has no source input.
5. Give the sibling the exact Library title, original URL when useful, and
   evidence with its provenance. The result shows the parent which Library
   source was used. Generated work still lands in Binder, and the original
   stays in Library.

Do not decompose an uploaded curriculum into weeks or write it to the planner in
this skill. Load `curriculum-mapping` for that separate Homa Plus workflow.
Here, retrieve the real source and stop honestly if its bounded evidence cannot
support the requested step.

## Edit or delete

- For a correction, identify one exact asset through search and get, then call
  `update_family_asset` with only the fields the parent changed. Omitted fields
  stay untouched.
- Before deletion, name the exact title and say the consequence: the Library
  original and its details go away, while anything already in Binder stays.
  Call `delete_family_asset` only after she clearly confirms that exact resource
  in the current conversation.
- If deletion cannot be confirmed, say it remains in Library with a retryable
  attention state. Never claim it is gone.

## Stop conditions

- No exact match for a required attachment or source: ask one short identifying question.
- A foreign, arbitrary, or unverified URL: refuse to save it through these
  tools. Ask her to attach or upload it through Homa.
- Metadata does not support a lesson claim: use the bounded curriculum reader
  first. Ask for a missing page only after the original cannot supply it.
- Optional theme lookup finds no useful source: continue the fresh request;
  do not ask the parent to inventory her shelf or claim an exhaustive search.
- A quick fresh page gains nothing from owned-source context: let materials-studio
  build it without a Library detour.
- The request is curriculum decomposition or approved automatic Planner
  mapping: load curriculum-mapping. Training export remains a separate
  workflow, never hidden work here.

The tool result is the only truth about whether a save, update, retrieval, or
deletion happened. Family identity always comes from authenticated context, and
no tool accepts it from you.
