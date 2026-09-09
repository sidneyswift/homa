export interface CurriculumOption {
  name: string;
  sourceUrl: string;
  aliases?: readonly string[];
}

// Research and inclusion policy: docs/homa-planning/plans/2026-09-09-onboarding-v2-curriculum-picker.md.
// Survey entries establish use by responding families, not national market share.
const favoritesGuide = "https://teachthemdiligently.net/2025-2026-hffg/";
const favorite = (name: string, aliases?: readonly string[]): CurriculumOption => ({ name, aliases, sourceUrl: favoritesGuide });
const publisher = (name: string, sourceUrl: string, aliases?: readonly string[]): CurriculumOption => ({ name, sourceUrl, aliases });

export const CURRICULUM_CATALOG: readonly CurriculumOption[] = [
  favorite("ABCJesusLovesMe"),
  favorite("Abeka"),
  favorite("Abeka Academy"),
  favorite("Accelerated Christian Education (ACE)", ["ACE", "School of Tomorrow", "PACE"]),
  favorite("Acellus Academy"),
  publisher("All About Reading", "https://www.allaboutlearningpress.com/", ["AAR"]),
  publisher("All About Spelling", "https://www.allaboutlearningpress.com/", ["AAS"]),
  favorite("AmblesideOnline", ["Ambleside Online"]),
  favorite("Analytical Grammar"),
  favorite("Answers in Genesis", ["God's Design"]),
  favorite("Apologia"),
  favorite("Apologia Academy"),
  favorite("A Reason for Spelling"),
  publisher("Art of Problem Solving", "https://artofproblemsolving.com/store", ["AoPS"]),
  favorite("Artistic Pursuits"),
  favorite("Atelier Art"),
  favorite("Beast Academy"),
  favorite("Beautiful Feet Books"),
  favorite("Before Five in a Row"),
  favorite("Berean Builders"),
  favorite("BiblioPlan"),
  favorite("BJU Press", ["Bob Jones"]),
  publisher("Blossom and Root", "https://www.blossomandroot.com/", ["Blossom & Root"]),
  publisher("BookShark", "https://www.bookshark.com/"),
  favorite("Brave Writer"),
  favorite("Brighter Day Press"),
  publisher("Build Your Library", "https://buildyourlibrary.com/overview/", ["BYL"]),
  publisher("Calvert Homeschool", "https://www.calverthomeschool.com/"),
  favorite("Campfire Curriculums"),
  favorite("Christian Liberty Press"),
  favorite("Christian Light Education", ["CLE"]),
  publisher("CK-12", "https://help.ck12.org/hc/en-us/articles/226913948-Using-CK-12-for-Homeschooling"),
  favorite("Classical Academic Press"),
  favorite("Classical Conversations", ["CC"]),
  favorite("Code.org"),
  favorite("CompuScholar"),
  favorite("Confessions of a Homeschooler"),
  publisher("Core Knowledge", "https://www.coreknowledge.org/homeschoolers/", ["CKLA", "CKHG", "CKSci"]),
  favorite("Creating a Masterpiece"),
  publisher("Curiosity Chronicles", "https://curiositychronicles.com/"),
  favorite("CTCMath", ["CTC Math"]),
  favorite("Denison Math", ["Denison Algebra", "Denison Geometry"]),
  favorite("Derek Owens"),
  favorite("DIVE Interactive Education", ["DIVE into Math"]),
  favorite("Draw and Write Through History"),
  favorite("Draw Write Now"),
  favorite("Easy Grammar"),
  favorite("Easy Peasy All-in-One Homeschool", ["Easy Peasy", "EP"]),
  favorite("Elemental Science", ["Sassafras Science"]),
  favorite("English from the Roots Up"),
  favorite("Essentials in Writing", ["EIW"]),
  favorite("Evan-Moor"),
  favorite("Excellence in Literature"),
  favorite("Explode The Code"),
  favorite("First Language Lessons"),
  favorite("Five in a Row", ["FIAR"]),
  favorite("Fix It! Grammar", ["IEW Fix It Grammar"]),
  favorite("Friendly Biology"),
  favorite("Friendly Chemistry"),
  favorite("Gather 'Round Homeschool", ["Gather Round"]),
  favorite("Generations Homeschool Curriculum"),
  publisher("Generation Genius", "https://www.generationgenius.com/"),
  favorite("Gentle + Classical", ["Gentle and Classical Press"]),
  favorite("Grammar for the Well-Trained Mind"),
  favorite("Guest Hollow"),
  publisher("Handwriting Without Tears", "https://www.lwtears.com/solutions/writing/handwriting-without-tears", ["HWT", "Learning Without Tears"]),
  favorite("Harbor and Sprout", ["Harbor & Sprout"]),
  favorite("Heart of Dakota", ["HOD"]),
  favorite("Here to Help Learning"),
  publisher("History Odyssey", "https://pandiapress.com/?weblink=history-odyssey-level-3-ancients", ["Pandia Press History Odyssey"]),
  publisher("History Quest", "https://pandiapress.com/?weblink=history-quest-united-states-student-guide", ["Pandia Press History Quest"]),
  favorite("History Revealed", ["Diana Waring"]),
  favorite("Hoffman Academy"),
  favorite("Home Art Studio"),
  favorite("Hooked on Phonics"),
  favorite("Horizons"),
  favorite("How Great Thou Art"),
  favorite("HSLDA Online Academy"),
  favorite("Institute for Excellence in Writing (IEW)", ["IEW"]),
  publisher("IXL", "https://blog.ixl.com/2020/09/29/how-to-use-ixl-in-your-homeschool-curriculum/"),
  favorite("Jacobs Math", ["Jacobs Algebra", "Jacobs Geometry"]),
  favorite("Journey Homeschool Academy"),
  favorite("Khan Academy"),
  favorite("Language Lessons for a Living Education"),
  favorite("Language Lessons for Today"),
  favorite("Learn Math Fast"),
  favorite("Learning Language Arts Through Literature", ["LLATL", "Common Sense Press"]),
  favorite("Life of Fred"),
  favorite("LIFEPAC"),
  favorite("Logic of English", ["LOE"]),
  favorite("Maestro Classics"),
  favorite("Master Books"),
  favorite("Master Books Academy"),
  favorite("Masterpiece Society"),
  favorite("Mathematical Reasoning", ["The Critical Thinking Company", "TCTC"]),
  favorite("Math Lessons for a Living Education"),
  favorite("Math Mammoth"),
  favorite("Math-U-See", ["MUS"]),
  favorite("Math with Confidence", ["Kate Snow"]),
  publisher("Mathseeds", "https://readingeggs.com/homeschool-curriculum/"),
  favorite("Meet the Masters"),
  favorite("Memoria Press"),
  publisher("Miacademy", "https://miacademy.co/"),
  publisher("MiaPrep", "https://miaprep.com/"),
  favorite("Monarch"),
  favorite("Mosdos Press Literature"),
  publisher("Moving Beyond the Page", "https://www.beyondthepage.com/", ["Beyond the Page"]),
  favorite("Mr. D Math"),
  favorite("Music in Our Homeschool"),
  favorite("My Father's World", ["MFW"]),
  publisher("Mystery Science", "https://mysteryscience.com/"),
  favorite("New American Cursive"),
  favorite("Noeo Science"),
  favorite("Not Consumed"),
  favorite("Notgrass History"),
  publisher("Oak Meadow", "https://www.oakmeadow.com/about-us/our-complete-curriculum/", ["Oak Meadow Homeschool"]),
  favorite("One Year Adventure Novel"),
  favorite("Our Mother Tongue"),
  favorite("Paradigm Accelerated Curriculum", ["PAC"]),
  favorite("Phonetic Zoo", ["IEW Phonetic Zoo"]),
  publisher("Power Homeschool", "https://www.powerhomeschool.org/"),
  favorite("Progeny Press"),
  favorite("Rabbit Trails"),
  publisher("Reading Eggs", "https://readingeggs.com/homeschool-curriculum/"),
  favorite("Real Science-4-Kids", ["Real Science for Kids"]),
  favorite("REAL Science Odyssey", ["RSO", "Pandia Press Science"]),
  favorite("RightStart Mathematics", ["Right Start Math"]),
  favorite("Rod and Staff", ["Rod & Staff"]),
  favorite("Rosetta Stone"),
  favorite("Saxon Math"),
  favorite("SchoolhouseTeachers.com", ["Schoolhouse Teachers"]),
  favorite("Science Shepherd"),
  favorite("Sequential Spelling"),
  publisher("Seton Home Study School", "https://www.setonhome.org/"),
  favorite("Shurley English"),
  favorite("Simply Charlotte Mason", ["SCM"]),
  favorite("Singapore Math"),
  favorite("Singapore Dimensions Math"),
  favorite("Singapore Primary Mathematics"),
  publisher("Sonlight", "https://www.sonlight.com/"),
  favorite("Spelling Power"),
  favorite("Spelling Wisdom"),
  favorite("Spelling Workout"),
  favorite("Spelling You See"),
  favorite("Switched-On Schoolhouse"),
  favorite("TalkBox.Mom"),
  favorite("Teach Your Child to Read in 100 Easy Lessons", ["100 Easy Lessons"]),
  favorite("Teaching Textbooks", ["TT"]),
  publisher("The Good and the Beautiful", "https://www.goodandbeautiful.com/", ["TGATB", "TGTB", "Good and Beautiful"]),
  favorite("The Lost Tools of Writing", ["CiRCE Institute"]),
  favorite("The Mystery of History", ["MOH"]),
  favorite("The Ordinary Parent's Guide to Teaching Reading", ["OPGTR"]),
  favorite("The Peaceful Press"),
  favorite("The Potter's School"),
  favorite("The Story of the World", ["SOTW"]),
  favorite("The Waldock Way"),
  favorite("Thinkwell"),
  publisher("Time4Learning", "https://www.time4learning.com/", ["T4L"]),
  publisher("Timberdoodle", "https://timberdoodle.com/"),
  publisher("Torchlight", "https://torchlightcurriculum.com/torchlight/"),
  favorite("Total Language Plus"),
  favorite("Treehouse Schoolhouse"),
  favorite("TruthQuest History"),
  favorite("Using Language Well"),
  favorite("Veritas Press"),
  favorite("VideoText Interactive"),
  favorite("Winston Grammar"),
  favorite("Wordly Wise 3000"),
  favorite("Wordsmith"),
  favorite("WriteShop"),
  favorite("Writing & Rhetoric", ["Writing and Rhetoric", "Classical Academic Press Writing and Rhetoric"]),
  favorite("Writing Strands"),
  favorite("Writing with Ease"),
  favorite("Writing with Sharon Watson"),
].sort((a, b) => a.name.localeCompare(b.name, "en"));

function nameKey(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]/gu, "");
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function matchesName(option: CurriculumOption, key: string): boolean {
  return [option.name, ...(option.aliases ?? [])].some((name) => nameKey(name) === key);
}

export function canonicalCurriculumName(value: string): string {
  const key = nameKey(value);
  return CURRICULUM_CATALOG.find((option) => matchesName(option, key))?.name ?? cleanName(value);
}

export function searchCurricula(query: string, selected: readonly string[] = []): CurriculumOption[] {
  const key = nameKey(query);
  const custom: CurriculumOption[] = selected.filter((name) => !CURRICULUM_CATALOG.some((option) => matchesName(option, nameKey(name))))
    .map((name) => ({ name, sourceUrl: "" }));
  return [...CURRICULUM_CATALOG, ...custom]
    .filter((option) => [option.name, ...(option.aliases ?? [])].some((name) => nameKey(name).includes(key)))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export function customCurriculumName(query: string, selected: readonly string[]): string | null {
  const key = nameKey(query);
  if (!key || CURRICULUM_CATALOG.some((option) => matchesName(option, key)) || selected.some((name) => nameKey(name) === key)) return null;
  return cleanName(query);
}

export function toggleCurriculum(selected: readonly string[], value: string): string[] {
  const name = canonicalCurriculumName(value);
  if (!nameKey(name)) return [...selected];
  const key = nameKey(name);
  const exists = selected.some((item) => nameKey(canonicalCurriculumName(item)) === key);
  return exists ? selected.filter((item) => nameKey(canonicalCurriculumName(item)) !== key) : [...selected, name];
}
