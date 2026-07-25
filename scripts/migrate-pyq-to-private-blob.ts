import { loadEnvConfig } from "@next/env";
import { del, put } from "@vercel/blob";
import prisma from "../lib/prisma";

loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");
const oldStoreToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
const privateStoreToken = process.env.PYQ_BLOB_READ_WRITE_TOKEN?.trim();
const privateStoreId = process.env.PYQ_BLOB_STORE_ID?.trim();
const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();

const privateStoreAuth = privateStoreToken
  ? { token: privateStoreToken }
  : privateStoreId && oidcToken
    ? { storeId: privateStoreId, oidcToken }
    : null;

function isPublicBlobUrl(url: string): boolean {
  return url.includes(".public.blob.vercel-storage.com/");
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9.-]/g, "_") || "question-paper";
}

async function main() {
  if (!oldStoreToken || !privateStoreAuth) {
    throw new Error("BLOB_READ_WRITE_TOKEN (old public store) and either PYQ_BLOB_READ_WRITE_TOKEN or PYQ_BLOB_STORE_ID with VERCEL_OIDC_TOKEN are required.");
  }

  const rows = await prisma.previousYearPaper.findMany({
    where: { blobPathname: { not: null } },
    select: {
      id: true,
      fileUrl: true,
      blobPathname: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
    },
  });
  const candidates = rows.filter((row) => isPublicBlobUrl(row.fileUrl));

  console.log(`${candidates.length} public PYQ blob(s) found.`);
  if (!apply) {
    console.log("Dry run only. After creating and connecting the private store, run: npm run pyq:migrate-private -- --apply");
    return;
  }

  let migrated = 0;
  const deleteFailures: string[] = [];

  for (const row of candidates) {
    const source = await fetch(row.fileUrl);
    if (!source.ok) {
      throw new Error(`Could not read public source for paper ${row.id} (${source.status}). No database changes were made for it.`);
    }

    const bytes = Buffer.from(await source.arrayBuffer());
    const contentType = row.mimeType || source.headers.get("content-type") || "application/octet-stream";
    const privateBlob = await put(`pyq/${row.id}/${safeName(row.fileName || "question-paper")}`, bytes, {
      access: "private",
      ...privateStoreAuth,
      addRandomSuffix: true,
      contentType,
    });

    // Temporarily switch the application to private storage, then delete the
    // old public object. If deletion fails, roll the row back and discard the
    // new private copy so a later rerun still knows the exact public source.
    await prisma.previousYearPaper.update({
      where: { id: row.id },
      data: {
        fileUrl: privateBlob.url,
        blobPathname: privateBlob.pathname,
        mimeType: contentType,
        fileSize: bytes.length,
      },
    });

    try {
      await del(row.fileUrl, { token: oldStoreToken });
    } catch {
      await prisma.previousYearPaper.update({
        where: { id: row.id },
        data: {
          fileUrl: row.fileUrl,
          blobPathname: row.blobPathname,
          mimeType: row.mimeType,
          fileSize: row.fileSize,
        },
      });
      await del(privateBlob.url, privateStoreAuth).catch(() => undefined);
      deleteFailures.push(row.id);
      continue;
    }
    migrated += 1;
    console.log(`Migrated paper ${row.id}.`);
  }

  console.log(`Migrated ${migrated} paper(s) to private storage.`);
  if (deleteFailures.length > 0) {
    console.error(`The old public object could not be deleted for ${deleteFailures.length} paper(s): ${deleteFailures.join(", ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
