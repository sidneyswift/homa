import type { FilingMethodEntry } from "./filing-method";

/**
 * What each state's own site says about HOW to file (gh#420).
 *
 * Hand-reviewed, evidence-backed, deliberately conservative: this is the
 * table that decides whether Homa puts a document in a family's
 * envelope, and the founder ruling behind it (2026-07-29) is that
 * nothing Homa sends may get a family rejected.
 *
 * Researched 2026-07-29 by one agent per state reading that state's own
 * pages, then every "letter" verdict challenged by a second agent whose
 * job was to refute it. That challenge changed 7 of 13 letter verdicts,
 * which is the whole reason it exists: Arkansas, Kentucky, Minnesota,
 * New York, Oregon, Pennsylvania and Utah all looked like letter states
 * on the statute and are not safe ones in practice.
 *
 * Absence is a safe answer, not a gap. These states are deliberately
 * absent because the official sources did not settle it, and they get
 * the copy-from sheet, which is correct everywhere: KY, MA, MT, NY, RI, UT.
 *
 * Add a state by reading its own site, not a summary of it, and record
 * the URL, the date, and what the page actually said.
 */
export const FILING_METHODS_BY_STATE: Record<string, FilingMethodEntry> = {
  // Researched by hand 2026-07-29, before the fan-out. Arizona is the
  // case that justified the whole research ruling: a generated letter
  // would have been wrong three ways at once, addressed to the state
  // instead of the county, unnotarized, and missing the birth
  // certificate the county files it with.
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

  FL: {
    method: "letter",
    sourceUrl: "https://m.flsenate.gov/statutes/1002.41",
    checkedOn: "2026-07-29",
    evidence:
      "Section 1002.41 requires written notice signed by the parent, carrying the full legal names, addresses and birthdates of the children, filed with the district school superintendent within 30 days. The district may not require any additional information or verification from the parent.",
    submitTo: "the district school superintendent of the county of residence",
    letterMustContain: [
      "the full legal name, address and date of birth of each child in the program",
    ],
  },

  VA: {
    method: "letter",
    sourceUrl:
      "https://law.lis.virginia.gov/vacode/title22.1/chapter14/section22.1-254.1/",
    checkedOn: "2026-07-29",
    evidence:
      "Section 22.1-254.1 requires annual notice to the division superintendent no later than August 15, carrying a description of the curriculum limited to a list of subjects for the coming year plus evidence of meeting one of the criteria to provide home instruction. The statute names no state form.",
    submitTo: "the division superintendent",
    letterMustContain: [
      "a description of the curriculum, limited to a list of subjects to be studied in the coming year",
      "evidence that the parent meets one of the statutory criteria to provide home instruction",
    ],
  },

  AL: {
    method: "state_form",
    sourceUrl: "https://alison.legislature.state.al.us/code-of-alabama?section=16-28-7",
    checkedOn: "2026-07-29",
    evidence: "Ala. Code 16-28-7 (Report of Enrollment), on the Alabama Legislature's own site, states: \"The enrollment and attendance of a child in a church school shall be filed with the local public school superintendent by the parent, guardian, or other person in charge or control of the child on a form provided by the superintendent or his or her agent which shall be countersigned by the administrator of the church school and returned to the public school superintendent by the parent.\" Alabama has no standalone homeschool statute, and the only other lawful route, Ala. Code 16-28-5, covers instruction by \"a person who holds a certificate issued by the State Superintendent of Education,\" who must \"file with the county superintendent of education ... a statement showing the child or children to be instructed, the subjects to be taught and the period of time such instruction is proposed to be...",
    submitTo: "the local public school superintendent, meaning the county superintendent of education or the city superintendent of schools for the territory where the family lives",
  },

  // Downgraded from letter by an independent challenge: Half right on law, wrong as a product decision. I re-read the rule cleanly (the researcher hit TLS errors and fell back to plain HTTP; curl works fine) and their reading of 6 CAR 33-104 holds: (a)(2)(B) allows the notice to be completed "By submitting a written notice of intent to the superintendent
  AR: {
    method: "state_form",
    sourceUrl: "https://codeofarrules.arkansas.gov/Rules/Rule?levelType=section&titleID=6&chapterID=47&subChapterID=58&partID=237&subPartID=3853&sectionID=23641",
    checkedOn: "2026-07-29",
    evidence: "Ark. Code 6-15-503(a)(1) (text as amended by HB1429, arkleg.state.ar.us) requires that parents \"shall give written notice to the superintendent of their local school district of their intent to provide a home school for their children,\" and the currently codified agency rule 6 CAR 33-104(a)(2) says the notice \"may be completed: (A) Through the Division of Elementary and Secondary Education's online process; or (B) By submitting a written notice of intent to the superintendent of the student's resident school district,\" which may be sent \"Electronically, including without limitation... By email; (2) By mail; (3) By fax; or (4) In person.\" That same rule states at (g), \"No additional criteria or information shall be required for a student to attend a home school beyond what the law requires.\" Caveat worth carrying into the product: DESE's own parent-facing page offers only two routes,...",
    submitTo: "the superintendent of the student's resident school district (the local district superintendent, not a state agency)",
  },

  CA: {
    method: "portal",
    sourceUrl: "https://www.cde.ca.gov/sp/ps/affidavit.asp",
    checkedOn: "2026-07-29",
    evidence: "Education Code 33190 says every person \"offering or conducting private school instruction on the elementary or high school level shall between the first and 15th day of October of each year ... file with the Superintendent of Public Instruction an affidavit or statement, under penalty of perjury\" (leginfo.legislature.ca.gov, read directly), and a parent homeschooling under EC 48222 files that Private School Affidavit as a home-based private school. The CDE affidavit page routes filers to the \"Online system used by anyone wishing to file a PSA for the current school year\" at www3.cde.ca.gov/psa, open August 1 through June 30, and CDE's PSA FAQ states \"The online PSA Filing System is the established mechanism for filing a PSA\" and \"If you are unable to file the PSA online, please contact our office for additional filing options.\" Several cde.ca.gov pages (homeschool.asp, psafaq.asp,...",
    submitTo: "the Superintendent of Public Instruction, filed with the California Department of Education through its online Private School Affidavit system at www3.cde.ca.gov/psa; the family's local school district afterward verifies the filing under EC 48222 and commonly asks for a copy",
  },

  CO: {
    method: "letter",
    sourceUrl: "https://ed.cde.state.co.us/choice/homeschool",
    checkedOn: "2026-07-29",
    evidence: "C.R.S. 22-33-104.5(3)(e), in the General Assembly's official 2024 printout of Title 22 (content.leg.colorado.gov, page 862), says a parent \"shall provide written notification of the establishment of said program to a school district within the state fourteen days prior to the establishment of said program and each year thereafter if the program is maintained\" and \"shall certify, in writing, only a statement containing the name, age, place of residence, and number of hours of attendance of each child enrolled in said program.\" CDE calls this a letter and publishes no state form and no portal: \"A letter of intent must be submitted 14 days before beginning the homeschool program to a Colorado school district of a family's choosing. The family does not submit the letter of intent to CDE,\" and its FAQ adds \"Notification can be given to any Colorado public school district office.\" The...",
    submitTo: "A school district, specifically any Colorado public school district office of the family's choosing, and explicitly not the Colorado Department of Education",
    letterMustContain: [
      "the name, age, place of residence and number of hours of attendance of each child enrolled",
    ],
  },

  DE: {
    method: "portal",
    sourceUrl: "https://education.delaware.gov/families/k12/homeschools-and-private-schools/opening-a-nonpublic-school/",
    checkedOn: "2026-07-29",
    evidence: "The DDOE registration page states \"If you plan to homeschool children in Delaware, you must open a nonpublic school (NPS) with the Delaware Department of Education (DDOE) and enroll your children,\" then gives three steps: \"Step One: Apply for an EdAccess Account and select Nonpublic School Account from the dropdown\" and \"Step Two: Log into the Nonpublic School Application via EdAccess. Select the Nonpublic School Application icon, select the +School blue button at the top of the page.\" The statute, 14 Del. C. section 2704, requires nonpublic school reports \"on such forms as shall be prescribed by the Department of Education,\" and the Department has prescribed the online Nonpublic School Application, with the annual reporting page confirming reports go \"to Delaware Department of Education via the Nonpublic School Application.\" No official page offers a mail-in letter or a downloadable...",
    submitTo: "the Delaware Department of Education (DDOE), through the online Nonpublic School Application accessed via the EdAccess portal",
  },

  GA: {
    method: "portal",
    sourceUrl: "https://gov.georgia.gov/document/signed-legislation/hb-530pdf/download",
    checkedOn: "2026-07-29",
    evidence: "Georgia's operative statute, O.C.G.A. 20-2-690(c)(1) as revised by HB 530 (2019, signed legislation on gov.georgia.gov), reads: \"The parent, parents, or guardian must submit within 30 days after the establishment of a home study program and by September 1 annually thereafter a declaration of intent to utilize a home study program to the Department of Education, which shall provide for written or electronic submittal of such declaration of intent. The Department of Education shall provide a copy of such declarations to the local school systems in which the home study programs are located.\" The Department runs that filing as its own online Declaration of Intent system at apps.gadoe.org/Pages/Home-Study-DOI.aspx, and its current guidance document (Georgia Home School Supporting Information, dated October 10, 2024, at lor2.gadoe.org) says \"The Declaration of Intent is the only official...",
    submitTo: "the Georgia Department of Education (Homeschool Division), which then provides a copy to the local school system where the program is located",
  },

  HI: {
    method: "letter",
    sourceUrl: "https://boe.hawaii.gov/wp-content/uploads/2024/07/12-Compulsory-Attendance-Exceptions.pdf",
    checkedOn: "2026-07-29",
    evidence: "Hawaii Administrative Rules Title 8 Chapter 12, §8-12-13(a) Notification of intent to home school: \"The parent shall provide the local public school principal with a notice of intent to home educate the child before initiating home schooling... The notice of intent may be submitted on a department developed form (Form 4140) or in a letter containing the following items: (1) Name, address, and telephone number of the child; (2) Birthdate and grade level of the child; and (3) Signature of the parent.\" The Department of Education's own Homeschooling FAQ (Revised 2/2026) repeats this, offering \"Submit the Exceptions to Compulsory Education Form (Form 4140); or A letter of intent to the school,\" and stating \"You do not need to enroll your child or provide: Birth certificate, Proof of residency, or Health records.\" §8-12-17 further provides that \"Reasonable cause for educational neglect...",
    submitTo: "the principal of the local public school the child would otherwise attend (the geographic school for the child's age-appropriate grade level)",
  },

  IA: {
    method: "state_form",
    sourceUrl: "https://educate.iowa.gov/pk-12/educational-choice/homeschooling",
    checkedOn: "2026-07-29",
    evidence: "Iowa Code 299.4(1) requires a parent placing a child under competent private instruction to \"furnish a report in duplicate on forms provided by the public school district, to the district by September 1 of the school year,\" and the Department of Education's August 2025 Private Instruction Handbook says such a family \"must file Form A (Iowa Code 299.4; Iowa Administrative Code 281-31.3(2)) with the district of residence,\" with the state-published form headed \"Form A: CPI Report\" and instructing \"Complete and return to the district office.\" The handbook also warns that the Iowa Supreme Court has upheld truancy convictions \"for both failing to file Form A at all\" and \"not filing Form A fully or accurately,\" so a parent-composed letter is not a safe substitute where a filing is required. The flip side matters just as much: \"Families who are homeschooling using IPI or CPI option #2 and...",
    submitTo: "the resident public school district, returned to the district office; the Department states \"Do not send a copy of Form A with the Iowa Department of Education\"",
  },

  KS: {
    method: "portal",
    sourceUrl: "https://www.ksde.gov/student-success/learning-alternatives/nonaccredited-private-schools",
    checkedOn: "2026-07-29",
    evidence: "K.S.A. 72-4346(a) states \"The official custodian of every private elementary or secondary school shall register the name and address of the private elementary or secondary school with the state board of education,\" and KSDE's homeschool fact sheet (rev. 2/12/2024) says \"Registration consists of completing a form provided by the state showing the name and address of the school and the name and address of the official custodian of the school's records.\" KSDE's current homeschool page offers exactly one route, a \"link to online form for registration, updating information, or to mark your school as non-active,\" and that form at apps.ksde.gov/naps_form says \"To comply with the provisions of K.S.A. 72-4345 through 72-4347, please provide the information on the form below concerning your school (elementary or secondary).\" No paper path is currently published (the former...",
    submitTo: "the State Board of Education, filed through the Kansas State Department of Education's online Nonaccredited Private Schools registration at apps.ksde.gov/naps_form",
  },

  LA: {
    method: "portal",
    sourceUrl: "https://doe.louisiana.gov/topic-pages/louisiana-school-choice/home-study",
    checkedOn: "2026-07-29",
    evidence: "R.S. 17:236.1 says \"A parent or legal guardian shall apply to the Board of Elementary and Secondary Education for approval of a home study program,\" that \"An initial application must be made within fifteen days after commencement of the program,\" and that the initial application \"shall be accompanied by a certified copy of the birth certificate of the child.\" The LDOE's BESE-Approved Home Study Program Guidelines (doe.louisiana.gov, dated 8/12/2024) state \"Families must submit a home study application through the online system,\" and the LDOE online-system FAQ states \"The home study application process is completed online. However, in certain limited circumstances and/or cases of hardship, families may submit a paper application via postal mail for the home study program.\" That paper fallback is the state's own printed BESE \"HOME STUDY PROGRAM APPLICATION\" reproduced as Appendix A of...",
    submitTo: "the Louisiana Board of Elementary and Secondary Education (BESE), with applications submitted to and reviewed by the Louisiana Department of Education (LDOE) through its online home study system at ldoe.edlink.la.gov",
  },

  MD: {
    method: "state_form",
    sourceUrl: "https://regs.maryland.gov/us/md/exec/comar/13A.10.01.01",
    checkedOn: "2026-07-29",
    evidence: "COMAR 13A.10.01.01B(1) requires that a parent or guardian who chooses to provide a home instruction program \"shall initially sign a statement on a form prescribed by the State Department of Education,\" and that the statement \"shall be submitted to the local superintendent at least 15 days before the beginning of a home instruction program.\" The statute, Education Article 7-301(a)(3), only exempts a child \"receiving regular, thorough instruction during the school year in the studies usually taught in the public schools to children of the same age\" and prescribes no notice method at all, so the prescribed form is the operative requirement and a parent-composed letter does not satisfy it. MSDE's own pages at marylandpublicschools.org return HTTP 403 to automated fetching, so the detail that each county school system publishes and receives its own copy of the MSDE-prescribed form comes...",
    submitTo: "the local school superintendent, in practice through the county school system's home instruction coordinator",
  },

  ME: {
    method: "letter",
    sourceUrl: "https://www.maine.gov/doe/schools/schoolops/homeinstruction/faq",
    checkedOn: "2026-07-29",
    evidence: "The statute, 20-A M.R.S. 5001-A(3)(A)(4)(a), prescribes no form: it says only that \"The student's parent or guardian shall provide a written notice of intent to provide home instruction simultaneously to the school officials of the administrative unit in which the student resides and to the commissioner within 10 calendar days of the beginning of home instruction,\" then lists the five items the notice \"must contain.\" The Maine DOE FAQ answers the form question outright under the heading \"Must I use the Home Instruction Portal or the official Notice of Intent form?\": \"Using the Home Instruction Portal is not mandatory. You may provide notice to the superintendent's office in a different format, provided it contains all required information,\" followed by the exact list of required content. The DOE's Requirements page routes paper filings locally: \"Complete the paper form and mail or...",
    submitTo: "The superintendent's office of the resident school administrative unit (SAU). The statute also names the commissioner, but Maine DOE instructs paper filers to send to the resident superintendent only and treats that single submission as notice to both the SAU and the Department.",
    letterMustContain: [
      "an assurance of at least 175 days of instruction annually",
      "an assurance that instruction covers English and language arts, mathematics, science, social studies, physical education, health education, library skills, fine arts, and Maine studies",
      "an assurance that the program includes an annual assessment of the child's academic progress",
    ],
    letterAttachments: [
      "in renewal years only, a copy of the previous year's annual assessment result",
    ],
  },

  // Downgraded from letter by an independent challenge: The researcher's LEGAL reading is correct and I could not refute it. I verified every quote against the state's own current documents: Minn. Stat. 120A.24 subd. 1(a) lists content and names no form; subd. 1(b) calls the annual filing "a letter of intent"; subd. 1(c) bars a superintendent from requir
  MN: {
    method: "state_form",
    sourceUrl: "https://education.mn.gov/MDE/fam/nphs/home/index.htm",
    checkedOn: "2026-07-29",
    evidence: "Minn. Stat. 120A.24, subd. 1(a) requires the person in charge of instruction to \"submit to the superintendent of the district in which the child resides the name, birth date, and address of the child; the annual tests intended to be used under section 120A.22, subdivision 11, if required; the name of each instructor; and evidence of compliance with one of the requirements specified in section 120A.22, subdivision 10,\" and names no form. MDE publishes two forms on this page, and both disclaim exclusivity: the Initial Registration Form for Unaccredited Nonpublic Schools says \"Complete the information using this form or a written or electronic format of your choice,\" and MDE's Home-School Questions and Answers (Q6, 6/10/24) says \"You may use the form titled Initial Registration Form ... developed by MDE, or you may report the same information in another manner.\" Subd. 1(c) further...",
    submitTo: "the superintendent of the school district where the child resides",
  },

  MS: {
    method: "state_form",
    sourceUrl: "https://www.sos.ms.gov/adminsearch/ACCode/00000382c.pdf",
    checkedOn: "2026-07-29",
    evidence: "Mississippi Administrative Code Title 7 Part 3, Rule 30.7 Home School Guidelines (adopted under Miss. Code Ann. 37-13-91) says the parent of a child enrolled in home school \"must complete a certificate of enrollment,\" that \"The certificate of enrollment shall be prepared and maintained by the Mississippi Department of Education, Office of Compulsory School Attendance Enforcement,\" and that this office \"shall be the only authorized entity to disseminate and collect the certificates of enrollment.\" The statute adds that the form \"shall be designed to obtain the following information only\" (child name, address, phone, date of birth; parent name, address, phone; a simple description of the type of education; the signature and date) and \"shall be returned to the school attendance officer where the child resides on or before September 15 of each year.\" MDE's own home school page tells...",
    submitTo: "the local School Attendance Officer (SAO) where the child resides, who is a State Department of Education employee in the Office of Compulsory School Attendance Enforcement; MDE also accepts the completed form by email at homeschool@mdek12.org",
  },

  NC: {
    method: "portal",
    sourceUrl: "https://www.doa.nc.gov/divisions/non-public-education/home-schools/file-notice-intent",
    checkedOn: "2026-07-29",
    evidence: "DNPE's official filing page states \"After clicking the button above, you will be directed to the online system. After you establish a username and password you will be able to complete the Notice of Intent.\" DNPE's guidance PDF makes the portal primary (\"It is preferable that each Chief Administrator use the online data base to establish and manage their home school account\") and confines the mail route to a state form rather than a parent letter: \"This is NOT a preferred method. Those without access to a computer should complete the paper Notice of Intent form located on the website and mail it with a copy of the diploma evidence to the Division office.\" That paper form (https://www.dnpesys.nc.gov/NPEPublic/documents/NOI_Manual_Registration_Form.pdf) is a fixed DNPE form requiring an election of \"Part 1 Religious\" or \"Part 2 Non-religious (Independent)\" plus enrollment counts by age...",
    submitTo: "the North Carolina Division of Non-Public Education (DNPE), a state agency within the NC Department of Administration; the statute names it \"a duly authorized representative of the State of North Carolina\"",
  },

  ND: {
    method: "state_form",
    sourceUrl: "https://www.nd.gov/dpi/familiescommunity/families/home-education/home-education-frequently-asked-questions",
    checkedOn: "2026-07-29",
    evidence: "NDCC 15.1-23-02 requires a parent to \"file a statement, reflecting that intent or fact, with the superintendent of the child's school district of residence or if no superintendent is employed, with the county superintendent of schools for the child's county of residence.\" North Dakota DPI publishes that statement as a numbered state form, SFN 16909 \"Statement of Intent to Supervise Home Education\", and the DPI FAQ answers the question of what must be submitted with \"The statement of intent form (SFN 16909) with supporting documents as indicated on the form, and the standardized achievement test results.\" The form's own footer reads \"A separate Statement of Intent to Supervise Home Education Form must be completed annually for each child in home education,\" it carries a superintendent countersignature block, and Minot Public Schools tells parents to \"Submit your completed Statement of...",
    submitTo: "the superintendent of the child's school district of residence, or if no superintendent is employed, the county superintendent of schools for the child's county of residence",
  },

  NE: {
    method: "state_form",
    sourceUrl: "https://www.education.ne.gov/fos/exempt-schools/",
    checkedOn: "2026-07-29",
    evidence: "The Nebraska Department of Education 2026/27 Instructions and Forms packet, published on that page and current as of June 3, 2026, answers \"What Do I Submit to NDE?\" with the \"Statement of Election and Assurances [2-page form]\", the \"Authorized Parent Representative form (different from the Statement of Election & Assurances)\", and \"Birth Certificate(s) if not previously provided to NDE\". Rule 13 (92 NAC 13), the implementing regulation, states \"Form A is required by Chapter 13, therefore, an altered Form A will not be accepted\" and repeats the same for Form B, so a parent-composed letter is not an accepted substitute. The packet further directs \"Sign & date the Form. Do not use 'fill & sign' applications such as Adobe to replace the actual (wet) signature\", and the program page warns that filings are accepted \"either via the online submission OR via paper submission by mail\", making...",
    submitTo: "The Commissioner of Education, filed through the Exempt School Program Office at the Nebraska Department of Education (PO Box 94987, Lincoln, NE 68509-4987), by July 15 each year",
  },

  NH: {
    method: "letter",
    sourceUrl: "https://gc.nh.gov/bill_status/legacy/bs2016/billText.aspx?id=1715&txtFormat=html&sy=2026",
    checkedOn: "2026-07-29",
    evidence: "RSA 193-A:1-5 was repealed and reenacted by 2026 Chapter 297 (HB 1268, the \"Home Education Freedom Act\", docket status \"SIGNED BY GOVERNOR\", approved July 10, 2026, home education sections effective July 1, 2026), and new RSA 193-A:3 reads \"A declaration of home education shall not be required, except to obtain access to public school programs pursuant to RSA 193:1-c or upon withdrawal from a public school,\" with that declaration defined at 193-A:1, III as \"an optional written statement that the student is home educated and meets the New Hampshire compulsory attendance requirements, signed by a parent which identifies a home educated student by name, date of birth, and current address.\" No form, format, or filing system is prescribed anywhere in the act, and new RSA 193-A:4, II provides that \"No superintendent, school board, school principal, other school district official, local...",
    submitTo: "Nothing is filed with any state agency. In the only two situations where a declaration is required, withdrawal from a public school or seeking access to public school programs under RSA 193:1-c, it goes to the local public school or resident district; the statute names no recipient explicitly.",
  },

  NM: {
    method: "state_form",
    sourceUrl: "https://web.ped.nm.gov/bureaus/options-for-parents-and-families/home-schooling/",
    checkedOn: "2026-07-29",
    evidence: "NMSA 1978 Section 22-1-2.1(A), reprinted verbatim on NMPED's own \"Notification of a Home School\" form (https://web.ped.nm.gov/wp-content/uploads/2025/01/Homeschool-Notification-Form-with-Statutes-2024-1.pdf), requires a parent to \"submit a home school registration form made available by the department and posted on the department's web site to notify the department within thirty days of the establishment of the home school and to notify the department on or before August 1 of each subsequent year of operation of the home school.\" The NMPED Home Schooling page offers exactly two routes, \"Register through our online database, the NMPED Home School System\" or \"Send a paper Notification of a Home School form to the NMPED,\" and nowhere treats a parent-composed letter as acceptable. The paper form itself instructs, \"Use this form only if you are unable or if you choose not to register...",
    submitTo: "the New Mexico Public Education Department (the form is submitted to the Secretary of Public Education, Attention: Home School Notification, 300 Don Gaspar Avenue, Santa Fe, NM 87501, or filed in the NMPED Home School System online)",
  },

  NV: {
    method: "state_form",
    sourceUrl: "https://doe.nv.gov/offices/craleo/nevada-homeschooling",
    checkedOn: "2026-07-29",
    evidence: "NRS 388D.020(1) requires the parent to \"file with the superintendent of schools of the school district in which the child resides a written notice of intent to homeschool the child,\" and directs that \"The Department shall develop a standard form for the notice of intent to homeschool,\" which each district \"shall, in a timely manner, make only the form developed by the Department available to parents who wish to homeschool their child.\" The Department's published form, titled \"STATE OF NEVADA NOTICE OF INTENT TO HOMESCHOOL\" (NDE January 3, 2024), instructs \"Please complete a separate Notice of Intent form for each child and submit it to the school district where you live,\" and its item 4 requires the parent to \"Attach a statement of the educational plan for the child\" in English, mathematics, science, and social studies. NRS 388D.020(6) does cap the district, since the superintendent...",
    submitTo: "the superintendent of schools of the school district in which the child resides (in practice the district homeschool office or the child's zoned school)",
  },

  OH: {
    method: "letter",
    sourceUrl: "https://education.ohio.gov/Topics/Ohio-Education-Options/Home-Schooling",
    checkedOn: "2026-07-29",
    evidence: "ORC 3321.042(C) requires only that the parent \"transmit a notice to the superintendent of the child's school district of residence,\" and that \"The notice shall provide the parent's name and address, the child's name, and an assurance that the child will receive education in the subject areas required under this section,\" prescribing no form. The state's own Ohio Home Education Notification Form settles it on its face: \"The use of this form is optional, and parents may choose another format so long as all required information is included,\" and the department's Home Schooling page calls it the \"Recommended Notification Form.\" The department's District Superintendent Responsibilities for Home-Educated Students document adds, \"Districts are prohibited from requesting or requiring information not listed in ORC 3321.042,\" though that bar sits in agency guidance rather than statutory text,...",
    submitTo: "the superintendent of the child's school district of residence",
  },

  // Downgraded from letter by an independent challenge: The statute and rule are quoted correctly, but they do not describe the path Oregon families actually use, and the letter is unsafe in a large share of the state. Notification in Oregon goes to one of 19 independent ESDs, not to the state, and nine of them (Northwest Regional, Willamette, Multnomah,
  OR: {
    method: "portal",
    sourceUrl: "https://secure.sos.state.or.us/oard/view.action?ruleNumber=581-021-0026",
    checkedOn: "2026-07-29",
    evidence: "ORS 339.035(2) says that when a child is withdrawn to be taught by a parent, \"the parent, legal guardian or private teacher must notify the education service district in writing,\" and OAR 581-021-0026(1)(f) defines \"Notification\" as nothing more than \"written notice containing\" (A) the child's and parent's name and address (phone and email optional), (B) \"The child's birth date,\" and (C) \"The name of the school the child is presently attending, or last attended, or if child has not attended school, the name of the public school district in which the child resides.\" No state form is prescribed, and the ESDs confirm a parent's own letter works: Multnomah ESD states \"MESD also accepts written notification of intent to home school,\" Douglas ESD lists \"mailing a written letter\" among its notification options, and Northwest Regional ESD accepts an emailed letter of intent instead of its...",
    submitTo: "the education service district (ESD) that contains the school district in which the child is a resident, addressed to that ESD's superintendent or homeschool registry",
  },

  // Downgraded from letter by an independent challenge: The researcher's quotes are accurate but the inference is wrong, and PDE's own pages refute it on five independent grounds.
  PA: {
    method: "state_form",
    sourceUrl: "https://www.pa.gov/agencies/education/resources/policies-acts-and-laws/basic-education-circulars-becs/purdons-statutes/home-education-program",
    checkedOn: "2026-07-29",
    evidence: "PDE's Home Education Program Basic Education Circular states that \"Prior to the commencement of a home education program and annually thereafter by no later than August 1, the supervisor must submit a notarized affidavit or unsworn declaration to the Superintendent of the school district of residence in accordance with Section 1327.1(b)(1) and 1327(d),\" and says of its sample affidavits that \"These samples are not exclusive, and the use of other forms is permissible if all required information is provided.\" PDE's Home Education and Private Tutoring Guide (revised May 2026) is more explicit still: \"you may use an unsworn declaration, a form provided by your school district or you may create your own affidavit, following the requirements in the home education law.\" The same guide, however, tells supervisors to \"review the board policy of their local school district to determine which...",
    submitTo: "The superintendent of the school district of residence, delivered to the superintendent's office in the student's district of residence",
  },

  SC: {
    method: "state_form",
    sourceUrl: "https://www.scstatehouse.gov/code/t59c065.php",
    checkedOn: "2026-07-29",
    evidence: "S.C. Code 59-65-40(A) provides that \"Parents or guardians may teach their children at home if the instruction is approved by the district board of trustees of the district in which the children reside,\" and 59-65-40(B) provides that \"The district board of trustees shall provide for an application process which elicits the information necessary for processing the home schooling request, including a description of the program, the texts and materials to be used, the methods of program evaluation, and the place of instruction,\" with parents \"notified in advance of the date, place, and time of the meeting at which the application is considered by the board.\" Nothing in Chapter 65 says a parent shall notify in writing, so no self-written letter path exists: each district authors its own application form and the board votes to approve or deny, appealable under 59-65-40(E). The other two...",
    submitTo: "Option 1: the district board of trustees of the district in which the children reside, using that district's own application form. Options 2 and 3: nothing is submitted to any government body by the parent; the parent enrolls in a private home school association (SCAIHS or an association of no fewer than fifty members), which reports to the district.",
  },

  SD: {
    method: "state_form",
    sourceUrl: "https://doe.sd.gov/oatq/homeschooling.aspx",
    checkedOn: "2026-07-29",
    evidence: "SDCL 13-27-7 reads: \"Each notification of alternative instruction pursuant to § 13-27-3 shall be on a standard form that declares that the child will be provided with alternative instruction per § 13-27-3,\" and \"The form shall be provided by the secretary of the Department of Education but may not require more details than set forth by this section.\" The Department of Education's own FAQ, read directly from doe.sd.gov/oatq/documents/HS-SDAltInst-FAQ.pdf, answers 1.1 with \"Notification must be made on the standard form provided by the department,\" notes the department also provides an online system with \"a paper notification form\" available if the family cannot file online, and states at 1.3 that parents \"are not required to submit a copy of a birth certificate or affidavit in lieu of a birth certificate as part of the notification.\" A parent-composed letter therefore does not satisfy...",
    submitTo: "Either the South Dakota Department of Education or the local resident school district; the statute says notification is filed \"with either the Department of Education or the local district,\" and whichever body receives it signs or stamps a proof copy back to the parent and forwards a copy to the other",
  },

  TN: {
    method: "state_form",
    sourceUrl: "https://www.tn.gov/content/dam/tn/education/nonpublic/Independent_Home_School_Requirements.pdf",
    checkedOn: "2026-07-29",
    evidence: "The Tennessee Department of Education's \"Independent Home School Requirements: Grades K-12\" (Revised June 2026) answers \"How do I register my child for independent home school?\" with \"File an Intent to Home School Form with the local school district where your family resides. The form is on the Tennessee Department of Education's Home School webpage. Some districts may opt to use an electronic form,\" and for continued registration, \"A new Intent to Home School Form or district specific electronic form must be submitted prior to the start of each school year.\" The department's Home School FAQ (August 2025) is mandatory in wording: \"Parents or legal guardians must file an intent to home school form with their local school district each year.\" The state PDF form itself hedges with \"This form may be utilized as notice of your intent to conduct an independent home school,\" and the statute...",
    submitTo: "the local school district where the family resides, addressed to the district's designated home school coordinator or the director of schools",
  },

  VT: {
    method: "state_form",
    sourceUrl: "https://legislature.vermont.gov/statutes/section/16/003/00166b",
    checkedOn: "2026-07-29",
    evidence: "16 V.S.A. 166b(a) requires a parent to \"send the Secretary notice of intent to enroll\" the child at least 10 business days before starting, then states flatly: \"Such notice shall be submitted via a form developed by the Agency of Education.\" Subsection (k) imposes the same rule every following year, requiring the continuation notice \"via a form provided by the Agency of Education.\" The Agency's own Home Study page matches this, offering a \"Notice of Intent Form (online)\" and a paper version of that same form that families print, sign, and then scan and email, fax, or mail, so a parent-composed letter is not an accepted filing.",
    submitTo: "The Secretary of Education, processed by the Vermont Agency of Education Home Study Office in Montpelier",
  },

  WA: {
    method: "state_form",
    sourceUrl: "https://ospi.k12.wa.us/sites/default/files/2023-08/pinkbook.pdf",
    checkedOn: "2026-07-29",
    evidence: "RCW 28A.200.010(1)(a) requires the parent to \"File annually a signed declaration of intent\" which \"shall include the name and age of the child, shall specify whether a certificated person will be supervising the instruction, and shall be written in a format prescribed by the superintendent of public instruction.\" OSPI's own legal guide (the \"Pink Book,\" Q9) resolves where that format comes from: \"The format prescribed by the Superintendent of Public Instruction must be requested from the local school district superintendent's office,\" and \"The declaration of intent, which is printed on a local school district's form, stationery, or letterhead, must be filed with the local school district superintendent by September 15.\" OSPI's Appendix A-2 is headed \"(sample format only),\" and real districts publish their own versions with added fields and their own routing (Everett's board-adopted...",
    submitTo: "the superintendent of the public school district within which the parent resides, or the superintendent of a nonresident district that accepts the transfer",
  },

  WI: {
    method: "portal",
    sourceUrl: "https://dpi.wi.gov/parental-education-options/home-based",
    checkedOn: "2026-07-29",
    evidence: "The DPI homeschool page states \"Parents must complete the PI-1206 form every school year\" and links only to the HOMER login at sms.dpi.wi.gov/HomeSchoolParent, and DPI's homeschool FAQ (dpi.wi.gov/sites/default/files/imce/parental-education-options/pdf/home-faq-2020-12-final.pdf) says \"Wis. Stat. sec. 115.30(3) requires the child's parent or guardian to file the online PI-1206 Homeschool Enrollment Report\" and that \"Your child will be considered officially enrolled in the home-based program on the date you complete and electronically 'submit' the online PI-1206 Homeschool Enrollment Report by pressing the 'Submit Enrollment Data' button,\" adding that if that button is not clicked \"the state and your child's resident district will not receive notification.\" DPI's own downloadable PI-1206 PDF is titled \"For PARENT records only - DO NOT MAIL to DPI,\" so there is no paper or letter...",
    submitTo: "the Wisconsin Department of Public Instruction, through its online HOMER system; the resident school district then gets read access to the submitted report",
  },

  WV: {
    method: "letter",
    sourceUrl: "https://code.wvlegislature.gov/18-8-1/",
    checkedOn: "2026-07-29",
    evidence: "W. Va. Code 18-8-1(c)(2) says the parent \"shall present to the county superintendent or county board a notice of intent to provide home instruction\" that \"includes the name, address, and age of any child of compulsory school age to be instructed and assurance that the child shall receive instruction in reading, language, mathematics, science, and social studies\", with no form, no state-prescribed format, and no online portal named anywhere in the section. The state education department's own artifact confirms the letter path: a fill-in page titled \"HOMESCHOOL NOTICE OF INTENT\", published at wvde.us as Homeschool-Letter-of-Intent-v2.pdf and linked as \"Homeschool Letter of Intent\", which reads \"This letter is to inform you that I will homeschool my child(ren) under West Virginia Code 18-8-1, subsection (c), subdivision 2\" and ends with a parent signature line. Two cautions: paragraph...",
    submitTo: "the county superintendent or county board (the statute says \"the county superintendent or county board\"; the state education department page says \"the county superintendent or his/her designee\")",
    letterMustContain: [
      "an assurance that the child will be instructed in reading, language, mathematics, science and social studies",
      "an assurance that the child will be assessed annually",
    ],
    letterAttachments: [
      "evidence of the instructing parent's high school diploma or equivalent, or a post-secondary degree",
    ],
  },
};
