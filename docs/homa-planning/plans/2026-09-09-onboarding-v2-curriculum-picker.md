# Onboarding v2 curriculum picker

Owner: [#1141](https://github.com/sidneyswift/homa/issues/1141). Local mobile prototype. Research checked September 9, 2026.

The founder requested an extensive dropdown of curricula parents already use, with multiple selection and a way to add an unlisted name. The picker now contains 174 catalog choices. It records names in the existing `curriculumTags` array. It does not import curriculum content, purchase anything, or write to a database.

## Research and inclusion

The [2025-2026 Homeschool Family Favorites Guide](https://teachthemdiligently.net/2025-2026-hffg/) reports votes from thousands of families across 39 categories. Its [public guide](https://heyzine.com/flip-book/b8917fea1f.html) names programs families report using, from preschool to high school. The guide was inspected directly, including its math, language arts, science, history, art, online academy, music, computer, and unit-study sections. Its publisher serves a Christian homeschool audience, so this is evidence about respondents, not a representative national market-share study.

[Practical Homeschooling explains](https://www.practicalhomeschooling.com/awards/) that its reader awards are based on satisfaction ratings among people who used a program, rather than the number of votes alone. Award status therefore should not be presented as an adoption ranking. The picker uses alphabetical order and makes no “most popular” or “best” claims.

The family-voted guide supplies the broad initial set, including established names such as Math-U-See, Teaching Textbooks, Apologia, Abeka, Master Books, BJU Press, Singapore Math, Simply Charlotte Mason, and Institute for Excellence in Writing. Publisher sources extend the catalog beyond that survey's audience and confirm names for online programs, secular programs, subject curricula, and supplementary learning resources.

| Publisher source | Catalog coverage |
| --- | --- |
| [The Good and the Beautiful](https://www.goodandbeautiful.com/) | Curriculum brand; searchable as TGATB, TGTB, and Good and Beautiful |
| [All About Learning Press](https://www.allaboutlearningpress.com/) | All About Reading and All About Spelling kept separate |
| [Sonlight](https://www.sonlight.com/) and [BookShark](https://www.bookshark.com/) | Separate literature-based providers |
| [Build Your Library](https://buildyourlibrary.com/overview/), [Torchlight](https://torchlightcurriculum.com/torchlight/), [Blossom and Root](https://www.blossomandroot.com/) | Additional literature and nature-centered choices |
| [Oak Meadow](https://www.oakmeadow.com/about-us/our-complete-curriculum/) and [Beyond the Page](https://www.beyondthepage.com/) | Broad curriculum options; Moving Beyond the Page is searchable under both names |
| [Pandia Press history](https://pandiapress.com/?weblink=history-odyssey-level-3-ancients) and [History Quest](https://pandiapress.com/?weblink=history-quest-united-states-student-guide) | Distinct history series; REAL Science Odyssey also appears in the family guide |
| [Time4Learning](https://www.time4learning.com/), [Power Homeschool](https://www.powerhomeschool.org/), [Miacademy](https://miacademy.co/), [MiaPrep](https://miaprep.com/) | Online programs; Acellus Academy and Power Homeschool remain separate |
| [Calvert](https://www.calverthomeschool.com/) and [Seton](https://www.setonhome.org/) | Additional complete programs |
| [Art of Problem Solving](https://artofproblemsolving.com/store) and [Beast Academy](https://beastacademy.com/faq/books) | Separate secondary and elementary math programs |
| [Learning Without Tears](https://www.lwtears.com/solutions/writing/handwriting-without-tears) | Handwriting Without Tears |
| [Core Knowledge](https://www.coreknowledge.org/homeschoolers/) and [CK-12](https://help.ck12.org/hc/en-us/articles/226913948-Using-CK-12-for-Homeschooling) | Open curriculum and textbook resources |
| [Reading Eggs](https://readingeggs.com/homeschool-curriculum/) | Reading Eggs and Mathseeds as separate choices |
| [IXL](https://blog.ixl.com/2020/09/29/how-to-use-ixl-in-your-homeschool-curriculum/) | Supplemental subject practice |
| [Mystery Science](https://mysteryscience.com/) and [Generation Genius](https://www.generationgenius.com/) | Science lessons and resources |
| [Curiosity Chronicles](https://curiositychronicles.com/) | Additional history curriculum |
| [Timberdoodle](https://timberdoodle.com/) | Curriculum kits |

The exact options, aliases, and provenance live together in [curriculum-catalog.ts](../../../apps/mobile/src/features/onboarding-v2/curriculum-catalog.ts). Each catalog entry has a source URL. This is an identification catalog for materials already in use, not a recommendation engine, availability guarantee, licensing statement, or claim that every item is a complete curriculum. Recognizable publisher-level answers and distinct named series are both accepted. Grade levels and editions do not each get a duplicate row. Custom entries provide coverage for co-op programs, parent-created curricula, regional options, and anything missing.

## Interaction

- The screen asks “Which curriculum are you using?” and immediately shows “Search or add curriculum.” Selecting a program supplies the answer, without a separate Yes step. Opening the picker presents a searchable selection sheet with independent checkboxes and “Choose all you use.”
- Results stay alphabetical. Selecting an item keeps the sheet open and does not clear or reorder the search results.
- Search ignores case, spacing, and punctuation and recognizes explicit familiar aliases. Selected canonical names remain readable on the main screen.
- A nonempty query without an exact catalog or selected-name match changes the primary footer action to `Add “[name]”`. The keyboard's submit action also adds it. Adding trims whitespace, selects the name, keeps it visible, dismisses the keyboard, and restores Done. It never modifies the bundled catalog.
- Done closes the picker. Search text alone is not silently saved as a curriculum. Every selected name can be removed individually on the main screen or unchecked inside the picker.
- Continue is enabled after at least one choice and records the existing `have-it` status. With no selections, Still choosing and Making my own appear as secondary text actions above Continue. Each records its status and advances directly. The links disappear once a curriculum is selected, removing a competing answer and preventing accidental replacement of that selection. Continue and Back retain selected curricula within the in-memory onboarding session. Returning from either alternate path still allows selecting a program and continuing.
- The local catalog works without a request. The list is virtualized; no new dependency or native build is needed.

## Verification

- Mobile typecheck and lint passed.
- `check:mobile-chat`: 124 tests passed, including seven new catalog/search/custom-selection tests wired into the root command. They cover source presence, unique names/aliases, case and punctuation handling, independent toggling, empty input, custom-name deduplication, and search reset.
- `check:mobile-accessibility`: passed source policy and contrast checks plus 36 shared primitive/journey tests. The picker uses `AccessibleModal` for modal isolation, focus entry/return, escape behavior, and reduced motion; selected counts use the shared announcement hook.
- Simulator: multiple checked rows; search with the keyboard open; no duplicate Add action for “math u see”; custom-name addition; individual removal; reachable Done and Continue; Continue/Back retention.
- A modal-local safe-area provider fixes the initial title overlap with the iPhone notch.
- Copy reader and editor completed. Replaced the less familiar plural “curricula” with “curriculum” in interface copy. Custom addition remains a local answer, with no public catalog submission.
- Independent visual reader completed the four-screen flow. Accepted its primary finding: a typed custom name must not be lost by tapping the dominant action. Moved Add into the primary footer position while a custom name is pending and made keyboard submit add it too; verified the final state in the simulator.
- Founder follow-up: selected names looked too similar to buttons. Replaced filled, fully tappable rows with regular text on the page background. Only each separate remove control is tappable, with a 44-by-44-point minimum target and a curriculum-specific accessibility label. A fresh visual reader confirmed the names now read as selected information. Simulator checks confirmed tapping a name does nothing, removal affects only that choice, and the original two selections were restored. Typecheck, lint, and accessibility checks passed again. Evidence: `curriculum-06-selected-text.png`.
- Founder follow-up: the Yes answer and three matching cards made the picker look like a fourth answer. Removed the status cards and exposed the picker directly. A fresh copy reader informed hiding alternate paths after selection; the subsequent editor returned no must-fix notes or suggestions. A fresh visual reader immediately identified the question, picker, selected names, and Continue. Its remaining questions concern household versus per-child and mixed purchased/parent-created preferences, which require a broader answer model and remain part of the prototype discussion in #1141. Remove controls retain their existing 44-by-44-point hit areas.
- Direct-picker verification: empty Continue is disabled; both secondary links advance without selection; Back returns; selecting two programs after returning from an alternate path enables Continue; Continue/Back retains both names. Verified in the iPhone simulator with All About Reading and Math-U-See restored. Mobile typecheck, lint, 124 behavior tests, and the accessibility guard passed. Evidence: `curriculum-07-direct-empty.png` and `curriculum-08-direct-selected.png` supersede the earlier main-screen layouts.

Screenshots are under `/Users/sidneyswift/.codex/visualizations/2026/09/09/01a08407-0a8a-7070-ba55-c36c8dc9f58a/`: `curriculum-01-dropdown.png`, `curriculum-02-custom.png`, `curriculum-03-selected.png`, and `curriculum-04-final.png`. The accepted custom-add refinement is shown in `curriculum-05-custom-final.png`; it supersedes the Add placement in screenshot 02.

This evidence is for the local iOS prototype at the simulator's existing text size. It is not physical-device VoiceOver certification, Android rendered verification, or production release evidence. Curriculum-aware lesson generation and durable account persistence remain outside this change.
