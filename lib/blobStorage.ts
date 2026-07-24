import { put, del } from "@vercel/blob";

/** Maximum upload size (10MB) — shared by PYQ + Documents. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types for uploads — shared by PYQ + Documents. */
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/gif",
];

export const ALLOWED_FILE_EXTENSIONS_HINT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif";

export interface StoredBlob {
  url: string;
  pathname: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/** True when Vercel Blob is configured (token present). */
export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Validate a file's size and type. Returns an error message, or null if valid. */
export function validateUploadFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return "File too large. Maximum size is 10MB";
  }
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return "Invalid file type. Allowed: PDF, DOC, DOCX, JPG, PNG, GIF";
  }
  return null;
}

/**
 * Upload a file to Vercel Blob under a feature prefix (e.g. "pyq", "documents").
 * Blobs are created with a random suffix so the URL is unguessable; we never
 * expose the raw blob URL to clients — access is gated through a proxy route.
 */
export async function uploadToBlob(
  file: File,
  opts: { prefix: string }
): Promise<StoredBlob> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `${opts.prefix}/${safeName}`;

  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type || "application/octet-stream",
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
  };
}

/**
 * Delete a blob by its stored URL. No-ops for empty / non-blob (legacy external
 * link) values so callers can invoke it unconditionally.
 */
export async function deleteFromBlob(fileUrl: string | null | undefined): Promise<void> {
  if (!fileUrl) return;
  // Legacy rows store external links (Google Drive, etc.) — skip those.
  if (!fileUrl.includes(".public.blob.vercel-storage.com")) return;
  if (!isBlobConfigured()) return;
  try {
    await del(fileUrl);
  } catch {
    // Swallow: a missing/already-deleted blob shouldn't block the DB delete.
  }
}
