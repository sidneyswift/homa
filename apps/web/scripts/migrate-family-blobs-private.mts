import { del, get, head, put, type HeadBlobResult } from "@vercel/blob";

import { FAMILY_BLOB_ACCESS, familyBlobToken } from "../lib/family-blob";
import { familyBlobPathname } from "../lib/family-blob-url";
import { mapDb } from "../lib/map/db";

interface PublicFamilyBlobRow {
  url: string;
}

function publicBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is required");
  return token;
}

function privateBlobToken(): string {
  const token = familyBlobToken();
  if (!token) throw new Error("a private family Blob token is required");
  return token;
}

async function optionalHead(
  urlOrPathname: string,
  token: string
): Promise<HeadBlobResult | null> {
  try {
    return await head(urlOrPathname, { token });
  } catch {
    return null;
  }
}

function sameBlob(source: HeadBlobResult, target: HeadBlobResult): boolean {
  return (
    source.size === target.size &&
    source.contentType.toLowerCase().split(";", 1)[0] ===
      target.contentType.toLowerCase().split(";", 1)[0]
  );
}

export async function migrateFamilyBlobsPrivate(write: boolean): Promise<void> {
  const sql = mapDb();
  const rows = await sql<PublicFamilyBlobRow[]>`
    select distinct url
    from (
      select url
      from public.family_assets
      where url like 'https://%.public.blob.vercel-storage.com/%'
      union all
      select url
      from public.chat_attachments
      where url like 'https://%.public.blob.vercel-storage.com/%'
    ) public_family_blobs
    order by url
  `;

  console.log(
    `${write ? "write" : "dry-run"}: ${rows.length} public family objects`
  );
  if (!write) {
    await sql.end();
    return;
  }

  const sourceToken = publicBlobToken();
  const targetToken = privateBlobToken();

  let migrated = 0;
  for (const row of rows) {
    const pathname = familyBlobPathname(row.url);
    if (!pathname || !/^families\/[^/]+\/(?:chat|library)\//u.test(pathname)) {
      throw new Error("refusing a public URL outside a family upload prefix");
    }

    const source = await optionalHead(row.url, sourceToken);
    let target = await optionalHead(pathname, targetToken);
    if (!target) {
      if (!source) {
        throw new Error(
          `source and private copy are both missing for ${pathname}`
        );
      }
      const sourceBytes = await get(row.url, {
        access: "public",
        token: sourceToken,
        useCache: false,
      });
      if (!sourceBytes?.stream || sourceBytes.statusCode !== 200) {
        throw new Error(`public source could not be read for ${pathname}`);
      }
      await put(pathname, sourceBytes.stream, {
        access: FAMILY_BLOB_ACCESS,
        token: targetToken,
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: source.contentType,
      });
      target = await optionalHead(pathname, targetToken);
      if (!target)
        throw new Error(`private copy was not readable for ${pathname}`);
    }
    if (source && !sameBlob(source, target)) {
      throw new Error(`private copy did not match ${pathname}`);
    }

    if (source) {
      await del(row.url, { token: sourceToken });
    }

    await sql.begin(async (transaction) => {
      await transaction`
        update public.family_assets
        set url = ${target.url},
            download_url = ${target.downloadUrl},
            updated_at = now()
        where url = ${row.url}
      `;
      await transaction`
        update public.chat_attachments
        set url = ${target.url}
        where url = ${row.url}
      `;
      await transaction`
        update public.conversation_messages
        set content = replace(content, ${row.url}, ${target.url})
        where content like ${`%${row.url}%`}
      `;
    });
    migrated += 1;
    if (migrated % 25 === 0 || migrated === rows.length) {
      console.log(`migrated ${migrated}/${rows.length}`);
    }
  }

  const [remaining] = await sql<Array<{ count: number | string }>>`
    select (
      select count(*) from public.family_assets
      where url like 'https://%.public.blob.vercel-storage.com/%'
    ) + (
      select count(*) from public.chat_attachments
      where url like 'https://%.public.blob.vercel-storage.com/%'
    ) as count
  `;
  console.log(
    `remaining public family rows: ${Number(remaining?.count ?? -1)}`
  );
  await sql.end();
}

await migrateFamilyBlobsPrivate(process.argv.includes("--write"));
