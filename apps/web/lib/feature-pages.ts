export type FeatureStep = {
  title: string;
  body: string;
};

export type FeaturePage = {
  slug: string;
  path: string;
  eyebrow: string;
  metadataTitle: string;
  metadataDescription: string;
  title: string;
  intro: string;
  heroNote?: string;
  answerTitle: string;
  answer: string;
  howHeading: string;
  howIntro: string;
  steps: readonly FeatureStep[];
  proofTitle: string;
  proof: readonly string[];
  noteLabel: string;
  note: string;
  finalHeading: string;
  finalBody: string;
  relatedHeading: string;
  related: readonly string[];
};

const DEFINITIONS = [
  {
    slug: "homeschool-planner",
    eyebrow: "Homeschool planner",
    metadataTitle: "Homeschool planner app for changing weeks",
    metadataDescription:
      "Plan the homeschool week, then revise it when a day changes. Homa keeps plans, practice pages, and records together.",
    title: "A homeschool plan you can keep using when the week changes.",
    intro:
      "Homa plans the week with you. When a sick day, field trip, or lighter morning changes the plan, Homa can revise the rest of the week.",
    answerTitle: "What a homeschool planner should do",
    answer:
      "A homeschool planner should help you choose what to do next without asking you to rebuild the whole week. Homa can revise the remaining plan when a day changes, while you choose what work to keep.",
    howHeading: "Revise the weekly plan when a day changes.",
    howIntro: "Start with the subjects and work for the week. When a day changes, revise the remaining plan.",
    steps: [
      { title: "Set up the weekly plan", body: "Tell Homa which subjects and work your family plans to cover." },
      { title: "Move the remaining work", body: "When a day changes, Homa can revise the remaining plan. You choose which work moves." },
      { title: "Save the plan with the work", body: "The weekly plan, practice pages, and homeschool record use the same week." },
    ],
    proofTitle: "What the planner includes",
    proof: ["A weekly plan with subjects and work", "A revised plan for remaining days", "Practice pages and homeschool records for the week"],
    noteLabel: "Your choice",
    note: "You choose which work moves when a day changes.",
    finalHeading: "Plan and revise the homeschool week.",
    finalBody: "Start with your family's subjects and work. When the week changes, revise the remaining plan.",
    relatedHeading: "More ways to plan the homeschool week",
    related: ["homeschool-hours-tracker", "homeschool-progress-tracker", "personalized-practice-pages"],
  },
  {
    slug: "homeschool-hours-tracker",
    eyebrow: "Homeschool hours tracker",
    metadataTitle: "Homeschool hours tracker for state records",
    metadataDescription:
      "Record homeschool time by subject and keep state-source context nearby. Homa helps make the record easier to keep.",
    title: "Track homeschool hours while you teach.",
    intro:
      "Tell Homa how long you taught each subject. Homa records the hours by subject. The state-rules section lists each source and its last-checked date.",
    heroNote:
      "State-rules reference: Homa lists sources and last-checked dates. It does not decide which requirement applies to your family. Check your local requirements.",
    answerTitle: "What a homeschool hours tracker should do",
    answer:
      "A homeschool hours tracker should make the record easier to keep while you teach. Tell Homa how long you taught each subject, and she records those hours by subject. The state-rules reference lists sources and dates. It does not decide which requirement applies to your family.",
    howHeading: "Record hours by subject.",
    howIntro: "Tell Homa how long you taught each subject. Review the saved hours when you need them.",
    steps: [
      { title: "Tell Homa the hours", body: "Say how long you taught each subject." },
      { title: "Review hours by subject", body: "Open the hours record to see the duration for each subject." },
      { title: "Check the state-rules reference", body: "Read the listed source and its last-checked date. Check your local requirements." },
    ],
    proofTitle: "What the hours record includes",
    proof: ["Hours recorded by subject", "Duration for each subject", "A state-rules reference with its last-checked date"],
    noteLabel: "State-information boundary",
    note: "The state-rules reference lists sources and dates. It does not decide which requirement applies to your family.",
    finalHeading: "Record the hours by subject.",
    finalBody: "Tell Homa how long you taught each subject, then review the saved hours by subject.",
    relatedHeading: "More ways to keep the homeschool record",
    related: ["homeschool-record-keeping", "homeschool-planner", "homeschool-progress-tracker"],
  },
  {
    slug: "homeschool-progress-tracker",
    eyebrow: "Homeschool progress tracker",
    metadataTitle: "Homeschool progress tracker and report",
    metadataDescription:
      "See what looks solid and what to try next. Homa builds a homeschool progress report from your answers.",
    title: "Use a parent-informed report to choose a next step.",
    intro:
      "Homa's progress report uses what you tell her about your child's work. It groups your answers by subject and suggests a next step for the areas you want to work on.",
    answerTitle: "What a homeschool progress tracker should show",
    answer:
      "Homa's progress report is a planning aid built only from your answers. It groups those answers by subject. It starts with strengths and suggests a next step for an area you choose to work on. The report organizes what you tell Homa, and you decide what to try next.",
    howHeading: "Use the report to choose a next step.",
    howIntro: "Answer the questionnaire. Read the report by subject. Choose the next step that fits your family.",
    steps: [
      { title: "Answer a short questionnaire", body: "Share what you have seen in your child's work." },
      { title: "Read the report by subject", body: "Review the strengths and areas you want to work on." },
      { title: "Choose one next step", body: "Use one suggestion in the next lesson." },
    ],
    proofTitle: "What the report contains",
    proof: ["Answers grouped by subject", "Strengths from your responses", "One suggested next step for a chosen area"],
    noteLabel: "What the report can do",
    note: "The report organizes what you tell Homa. You decide what to try next.",
    finalHeading: "Choose a next step from your report.",
    finalBody: "Answer the questionnaire, review the report by subject, and choose one suggestion for the next lesson.",
    relatedHeading: "More ways to choose the next lesson",
    related: ["homeschool-planner", "homeschool-record-keeping", "personalized-practice-pages"],
  },
  {
    slug: "homeschool-record-keeping",
    eyebrow: "Homeschool record keeping",
    metadataTitle: "Homeschool record keeping app",
    metadataDescription:
      "Keep worksheets, photos, and progress reports together. Homa's binder helps you browse the record or print a page again.",
    title: "Keep the homeschool record in one place.",
    intro:
      "Homa's digital binder stores worksheets, photos, and reports together. Browse the record or print a saved page again.",
    answerTitle: "What a homeschool record-keeping app should do",
    answer:
      "A homeschool record-keeping app should make it easy to find work, photos, and reports later. Homa's digital binder stores them in one record so you can browse or print a saved page.",
    howHeading: "Save and print homeschool records.",
    howIntro: "Add worksheets, photos, and reports to Homa's digital binder. Open a saved page when you need to print it.",
    steps: [
      { title: "Save a worksheet", body: "Add the worksheet to the week it documents." },
      { title: "Add photos and reports", body: "Store photos and reports with the related worksheet." },
      { title: "Print a saved page", body: "Open a page from the digital binder and print it again." },
    ],
    proofTitle: "What the digital binder holds",
    proof: ["Worksheets saved in Homa", "Photos and reports linked to the related work", "Saved pages available to print"],
    noteLabel: "Digital binder",
    note: "The binder stores worksheets, photos, and reports in Homa. You can browse them or print a saved page.",
    finalHeading: "Save the record you will need later.",
    finalBody: "Add worksheets, photos, and reports to Homa's digital binder. Open a saved page when you need to print it.",
    relatedHeading: "More ways to save the homeschool record",
    related: ["homeschool-hours-tracker", "homeschool-progress-tracker", "homeschool-planner"],
  },
  {
    slug: "personalized-practice-pages",
    eyebrow: "Personalized homeschool practice",
    metadataTitle: "Personalized homeschool practice pages",
    metadataDescription:
      "Make practice pages for the lesson your child is working on, then keep each page in the printable homeschool record.",
    title: "Practice pages made for the lesson at hand.",
    intro:
      "Homa makes a practice page from the lesson your child is working on. Tell Homa what your child loves or ask for a change, then keep the page in the digital binder for printing.",
    answerTitle: "What makes practice useful",
    answer:
      "A useful practice page starts with the lesson your child is working on. Tell Homa what to include or change, then keep the generated page in the digital binder for printing.",
    howHeading: "Make and print a practice page.",
    howIntro: "Tell Homa which lesson to use. Add the detail or change you want on the page. Print the page from the digital binder.",
    steps: [
      { title: "Name the lesson", body: "Tell Homa which lesson your child is working on." },
      { title: "Request the practice page", body: "Ask for the detail or change you want, such as a familiar interest or larger numbers." },
      { title: "Print the page", body: "Open the generated page in the digital binder and print it." },
    ],
    proofTitle: "What the practice page gives you",
    proof: ["A page for the lesson you named", "A requested detail or change", "A saved page to print"],
    noteLabel: "Your choice",
    note: "You choose the lesson, detail, and page to print.",
    finalHeading: "Make a practice page for the next lesson.",
    finalBody: "Tell Homa which lesson to use and what to change. Print the generated page from the digital binder.",
    relatedHeading: "More ways to prepare the next lesson",
    related: ["homeschool-planner", "homeschool-progress-tracker", "homeschool-record-keeping"],
  },
] as const;

export const FEATURE_PAGES: readonly FeaturePage[] = DEFINITIONS.map((definition) => ({
  ...definition,
  path: "/features/" + definition.slug,
}));

export const FEATURE_PAGE_SLUGS = FEATURE_PAGES.map((page) => page.slug);

export function getFeaturePage(slug: string): FeaturePage | undefined {
  return FEATURE_PAGES.find((page) => page.slug === slug);
}
