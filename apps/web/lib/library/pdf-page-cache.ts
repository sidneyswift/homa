import { randomUUID } from "node:crypto";

import { mapDb } from "../map/db";
import { FAMILY_PDF_EXTRACTION_VERSION, type PdfPageRead } from "./family-asset-read-contract";

export interface PdfSourceIdentity {
  id: string; familyId: string; url: string; sha256: string;
}
export interface PdfPageCache {
  bind(source: PdfSourceIdentity): Promise<boolean>;
  get(source: PdfSourceIdentity, ordinal: number): Promise<PdfPageRead | null>;
  claim(source: PdfSourceIdentity, ordinal: number): Promise<string | null>;
  complete(source: PdfSourceIdentity, page: PdfPageRead, lease: string): Promise<boolean>;
  release(source: PdfSourceIdentity, ordinal: number, lease: string): Promise<void>;
}

export const pdfPageCache: PdfPageCache = {
  async bind(source) {
    const sql = mapDb();
    const rows = await sql`
      update public.family_assets set content_sha256 = ${source.sha256}
      where id = ${source.id} and family_id = ${source.familyId}
        and url = ${source.url} and deleted_at is null
        and processing_note is distinct from 'Removing original file'
      returning id
    `;
    return rows.length === 1;
  },
  async get(source, ordinal) {
    const sql = mapDb();
    const rows = await sql<{ page_state: PdfPageRead["state"]; extraction_method: PdfPageRead["method"]; model: string | null; text_content: string; gaps: string[] }[]>`
      select page.page_state, page.extraction_method, page.model, page.text_content, page.gaps
      from public.family_pdf_page_reads page
      join public.family_assets asset on asset.id = page.asset_id and asset.family_id = page.family_id
      where page.family_id = ${source.familyId} and page.asset_id = ${source.id}
        and page.content_sha256 = ${source.sha256} and page.extraction_version = ${FAMILY_PDF_EXTRACTION_VERSION}
        and page.page_ordinal = ${ordinal} and page.completed_at is not null
        and asset.content_sha256 = ${source.sha256} and asset.url = ${source.url}
        and asset.deleted_at is null and asset.processing_note is distinct from 'Removing original file'
    `;
    const row = rows[0];
    return row ? { ordinal, locator: `Page ${ordinal}`, text: row.text_content, state: row.page_state,
      method: row.extraction_method, model: row.model, gaps: row.gaps } : null;
  },
  async claim(source, ordinal) {
    const sql = mapDb();
    const lease = randomUUID();
    const rows = await sql`
      insert into public.family_pdf_page_reads
        (family_id, asset_id, content_sha256, extraction_version, page_ordinal, lease_id, lease_until)
      select ${source.familyId}, ${source.id}, ${source.sha256}, ${FAMILY_PDF_EXTRACTION_VERSION},
        ${ordinal}, ${lease}, now() + interval '90 seconds'
      from public.family_assets asset
      where asset.id = ${source.id} and asset.family_id = ${source.familyId}
        and asset.content_sha256 = ${source.sha256} and asset.url = ${source.url}
        and asset.deleted_at is null and asset.processing_note is distinct from 'Removing original file'
      on conflict (family_id, asset_id, content_sha256, extraction_version, page_ordinal)
      do update set lease_id = excluded.lease_id, lease_until = excluded.lease_until
      where family_pdf_page_reads.completed_at is null
        and (family_pdf_page_reads.lease_until is null or family_pdf_page_reads.lease_until < now())
      returning lease_id
    `;
    return rows.length ? lease : null;
  },
  async complete(source, page, lease) {
    const sql = mapDb();
    const rows = await sql`
      update public.family_pdf_page_reads page
      set page_state = ${page.state}, extraction_method = ${page.method}, model = ${page.model},
        text_content = ${page.text}, gaps = ${sql.json(page.gaps)}, completed_at = now(), lease_id = null, lease_until = null
      where page.family_id = ${source.familyId} and page.asset_id = ${source.id}
        and page.content_sha256 = ${source.sha256} and page.extraction_version = ${FAMILY_PDF_EXTRACTION_VERSION}
        and page.page_ordinal = ${page.ordinal} and page.lease_id = ${lease} and page.completed_at is null
        and exists (select 1 from public.family_assets asset where asset.id = page.asset_id
          and asset.family_id = page.family_id and asset.deleted_at is null
          and asset.url = ${source.url} and asset.content_sha256 = ${source.sha256}
          and asset.processing_note is distinct from 'Removing original file')
      returning page_ordinal
    `;
    return rows.length === 1;
  },
  async release(source, ordinal, lease) {
    const sql = mapDb();
    await sql`
      update public.family_pdf_page_reads set lease_id = null, lease_until = null
      where family_id = ${source.familyId} and asset_id = ${source.id}
        and content_sha256 = ${source.sha256} and extraction_version = ${FAMILY_PDF_EXTRACTION_VERSION}
        and page_ordinal = ${ordinal} and lease_id = ${lease} and completed_at is null
    `;
  },
};
