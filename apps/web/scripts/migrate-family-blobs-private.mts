import { del, get, head, list, put, type HeadBlobResult } from "@vercel/blob";

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

async function listPublicFamilyOriginals(token: string): Promise<string[]> {
  const urls: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "families/", token, limit: 1000, cursor });
    for (const blob of page.blobs) {
      const pathname = familyBlobPathname(blob.url);
      if (pathname && /^families\/[^/]+\/(?:chat|library)\//u.test(pathname)) {
        urls.push(blob.url);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return urls;
}

export async function migrateFamilyBlobsPrivate(write: boolean): Promise<void> {
  const sql = mapDb();
  const referencedRows = await sql<PublicFamilyBlobRow[]>`
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
  const sourceToken = publicBlobToken();
  const publicUrls = new Set(referencedRows.map((row) => row.url));
  for (const url of await listPublicFamilyOriginals(sourceToken)) {
    publicUrls.add(url);
  }
  const rows = [...publicUrls].sort().map((url) => ({ url }));

  console.log(
    `${write ? "write" : "dry-run"}: ${rows.length} public family objects or references`
  );
  if (!write) {
    await sql.end();
    return;
  }

  const targetToken = privateBlobToken();

  let migrated = 0;
  let prunedMissingSandboxObjects = 0;
  for (const row of rows) {
    const pathname = familyBlobPathname(row.url);
    if (!pathname || !/^families\/[^/]+\/(?:chat|library)\//u.test(pathname)) {
      throw new Error("refusing a public URL outside a family upload prefix");
    }

    const source = await optionalHead(row.url, sourceToken);
    let target = await optionalHead(pathname, targetToken);
    if (!target) {
      if (!source) {
        const [scope] = await sql<Array<{ real_families: number | string }>>`
          select count(distinct family_id) filter (where not sandbox) as real_families
          from (
            select fa.family_id, f.sandbox
            from public.family_assets fa
            join public.families f on f.id = fa.family_id
            where fa.url = ${row.url}
            union all
            select ca.family_id, f.sandbox
            from public.chat_attachments ca
            join public.families f on f.id = ca.family_id
            where ca.url = ${row.url}
          ) family_references
        `;
        if (Number(scope?.real_families ?? -1) !== 0) {
          throw new Error(
            "missing family file is still referenced by a real family"
          );
        }
        await sql.begin(async (transaction) => {
          await transaction`
            update public.conversation_messages cm
            set content = replace(content, ${row.url}, '[missing sandbox attachment]')
            where content like ${`%${row.url}%`}
              and exists (
                select 1
                from public.families f
                where f.id = cm.family_id
                  and f.sandbox
              )
          `;
          await transaction`
            delete from public.family_assets fa
            where fa.url = ${row.url}
              and exists (
                select 1
                from public.families f
                where f.id = fa.family_id
                  and f.sandbox
              )
          `;
          await transaction`
            delete from public.chat_attachments ca
            where ca.url = ${row.url}
              and exists (
                select 1
                from public.families f
                where f.id = ca.family_id
                  and f.sandbox
              )
          `;
        });
        prunedMissingSandboxObjects += 1;
        continue;
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
  console.log(
    `pruned missing sandbox objects: ${prunedMissingSandboxObjects}`
  );
  console.log(
    `remaining public family objects: ${(await listPublicFamilyOriginals(sourceToken)).length}`
  );
  await sql.end();
}

await migrateFamilyBlobsPrivate(process.argv.includes("--write"));
