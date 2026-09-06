import type { MaterialSummary } from "./library";
import type { ResolvedActiveMaterial } from "../voice/active-material";
export const PRINT_FIXTURE_ID = "11111111-1111-4111-8111-111111111111";
export const PRINT_FIXTURE_FAMILY = "22222222-2222-4222-8222-222222222222";
export const printFixtureActive: ResolvedActiveMaterial = {
  id: PRINT_FIXTURE_ID, title: "Synthetic three-page worksheet", status: "final", revisesId: null,
  pageCount: 3, pageRoles: ["child", "answer_key", "parent_guide"],
};
export const printFixtureMaterial: MaterialSummary = {
  id: PRINT_FIXTURE_ID, title: printFixtureActive.title, status: "final", kind: "worksheet", source: "html",
  skill: null, subject: null, curriculum: null, theme: null, characters: [], childId: null,
  previewUrl: "https://fixture.public.blob.vercel-storage.com/unused.jpg",
  pdfUrl: `https://fixture.public.blob.vercel-storage.com/families/${PRINT_FIXTURE_FAMILY}/materials/synthetic.pdf`,
  createdAt: "2026-09-06T00:00:00Z", pageCount: 3, pagePreviewUrls: null, sources: [],
};
export const printFixtureRequest = {
  materialId: PRINT_FIXTURE_ID, title: printFixtureActive.title, authorizedPdfPath: `/api/materials/${PRINT_FIXTURE_ID}/pdf`,
  pageCount: 3, pageIndexes: [0,2], copies: 2, includeAnswerKey: false, answerKeyExcluded: true,
};
