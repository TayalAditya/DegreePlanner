import { del, get, put } from "@vercel/blob";

/** QPs are intentionally limited to formats the protected viewer can rasterize. */
export const PYQ_ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const PYQ_ALLOWED_FILE_EXTENSIONS_HINT = ".pdf,.jpg,.jpeg,.png";
export const PYQ_MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface ProtectedPyqBlob {
  url: string;
  pathname: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

function getPyqBlobToken(): string | null {
  return process.env.PYQ_BLOB_READ_WRITE_TOKEN?.trim() || null;
}

type PyqBlobAuth =
  | { token: string }
  | { storeId: string; oidcToken?: string };

function getPyqBlobAuth(): PyqBlobAuth | null {
  const token = getPyqBlobToken();
  if (token) return { token };

  const storeId = process.env.PYQ_BLOB_STORE_ID?.trim();
  if (!storeId) return null;

  // @vercel/blob obtains and refreshes Vercel's OIDC token inside deployed
  // functions. Passing only the private store ID is intentional: checking
  // VERCEL_OIDC_TOKEN here prevents that automatic credential path from being
  // used when the token is supplied at runtime rather than as a plain env var.
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
  return oidcToken ? { oidcToken, storeId } : { storeId };
}

export function isPrivatePyqBlobConfigured(): boolean {
  return Boolean(getPyqBlobAuth());
}

export function isPrivatePyqBlobUrl(url: string | null | undefined): boolean {
  return Boolean(url?.includes(".private.blob.vercel-storage.com/"));
}

export function isPreviewablePyqMimeType(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType && PYQ_ALLOWED_FILE_TYPES.includes(mimeType as (typeof PYQ_ALLOWED_FILE_TYPES)[number]));
}

export function validatePyqUploadFile(file: File): string | null {
  if (file.size > PYQ_MAX_FILE_SIZE) {
    return "File too large. Maximum size is 10MB";
  }
  if (!PYQ_ALLOWED_FILE_TYPES.includes(file.type as (typeof PYQ_ALLOWED_FILE_TYPES)[number])) {
    return "Invalid file type. Question papers must be PDF, JPG, or PNG files.";
  }
  return null;
}

/**
 * Stores raw QP files in a dedicated private Vercel Blob store. The token is
 * deliberately separate from the project's public documents store, so QPs can
 * never accidentally fall back to publicly readable storage.
 */
export async function uploadPyqToPrivateBlob(file: File): Promise<ProtectedPyqBlob> {
  const auth = getPyqBlobAuth();
  if (!auth) {
    throw new Error("PYQ private Blob storage is not configured");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const blob = await put(`pyq/${safeName}`, file, {
    access: "private",
    ...auth,
    addRandomSuffix: true,
    contentType: file.type,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
}

/** Reads a raw QP only inside a server route; never pass this stream to the browser. */
export async function getPrivatePyqBlob(url: string) {
  const auth = getPyqBlobAuth();
  if (!auth) {
    throw new Error("PYQ private Blob storage is not configured");
  }
  if (!isPrivatePyqBlobUrl(url)) {
    throw new Error("Question paper has not been migrated to protected storage");
  }
  return get(url, { access: "private", ...auth });
}

export async function deletePrivatePyqBlob(url: string | null | undefined): Promise<void> {
  if (!url || !isPrivatePyqBlobUrl(url)) return;

  const auth = getPyqBlobAuth();
  if (!auth) return;
  await del(url, auth);
}
