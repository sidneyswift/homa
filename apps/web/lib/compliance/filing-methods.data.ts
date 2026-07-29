import type { FilingMethodEntry } from "./filing-method";

/**
 * What each state's own site says about HOW to file (gh#420).
 *
 * Hand-researched and hand-reviewed, deliberately not generated: this is
 * the table that decides whether Homa puts a document in a family's
 * envelope, and the founder ruling behind it (2026-07-29) is that
 * nothing Homa sends may get a family rejected. A state is absent until
 * a person has read that state's page and written down what it said.
 *
 * Absence is a safe answer, not a gap. An unlisted state gets the
 * filled-in copy-from sheet, which is correct everywhere.
 *
 * Add a state by reading its own site, not a summary of it, and record
 * the URL, the date, and what the page actually said.
 */
export const FILING_METHODS_BY_STATE: Record<string, FilingMethodEntry> = {
  // Researched 2026-07-29. Arizona was the case that justified the whole
  // ruling: a generated letter would have been wrong three ways at once,
  // addressed to the state instead of the county, unnotarized, and
  // missing the birth certificate the county requires with it.
  AZ: {
    method: "state_form",
    sourceUrl:
      "http://www.schools.pima.gov/?ACT=25&fid=5&d=16&f=affidavit_of_intent_to_homeschool_pcsso.pdf",
    checkedOn: "2026-07-29",
    evidence:
      "The affidavit of intent is filed with the COUNTY school superintendent, not the state. The county provides the form, the signed original must be notarized, and a certified copy of the child's birth certificate goes with it. Procedure is published per county, so the form itself varies by where the family lives.",
    submitTo: "the county school superintendent",
  },

  DC: {
    method: "portal",
    sourceUrl: "https://osse.dc.gov/service/homeschooling-district-columbia",
    checkedOn: "2026-07-29",
    evidence:
      "OSSE requires a Notification of Intent to Homeschool completed at homeschool.dc.gov at least 15 business days before instruction starts, and the same portal carries the annual continuation, which is due by August 15. There is no mailed-letter path.",
    submitTo: "homeschool.dc.gov",
  },

  // The clearest letter state found so far, and safe for an unusual
  // reason: the statute both says what the notice must contain and bars
  // the district from demanding anything beyond it.
  FL: {
    method: "letter",
    sourceUrl: "https://m.flsenate.gov/statutes/1002.41",
    checkedOn: "2026-07-29",
    evidence:
      "Section 1002.41 requires written notice signed by the parent, carrying the full legal names, addresses and birthdates of the children, filed with the district school superintendent within 30 days. The district may not require any additional information or verification from the parent.",
    submitTo: "the district school superintendent of the county of residence",
  },

  VA: {
    method: "letter",
    sourceUrl:
      "https://law.lis.virginia.gov/vacode/title22.1/chapter14/section22.1-254.1/",
    checkedOn: "2026-07-29",
    evidence:
      "Section 22.1-254.1 requires annual notice to the division superintendent no later than August 15, carrying a description of the curriculum limited to a list of subjects for the coming year plus evidence of meeting one of the criteria to provide home instruction. The statute names no state form.",
    submitTo: "the division superintendent",
  },
};
