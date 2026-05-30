"use client";

import { useEffect, useState } from "react";
import { Download, ImageIcon, X } from "lucide-react";
import Image from "next/image";

export type SupportTicketAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  dataUrl: string;
  createdAt?: string;
};

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupportTicketAttachments({
  attachments,
}: {
  attachments?: SupportTicketAttachment[] | null;
}) {
  const [preview, setPreview] = useState<SupportTicketAttachment | null>(null);

  useEffect(() => {
    if (!preview) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [preview]);

  if (!attachments || attachments.length === 0) return null;

  return (
    <>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {attachments.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() => setPreview(attachment)}
            className="group overflow-hidden rounded-lg border border-border bg-surface text-left hover:border-primary/40 transition-colors"
            title={attachment.fileName}
          >
            <div className="relative aspect-video bg-background-secondary overflow-hidden">
              {attachment.dataUrl ? (
                <Image
                  src={attachment.dataUrl}
                  alt={attachment.fileName}
                  fill
                  sizes="(max-width: 640px) 50vw, 240px"
                  unoptimized
                  className="object-cover transition-transform group-hover:scale-[1.02]"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-foreground-secondary" />
                </div>
              )}
            </div>
            <div className="px-2 py-1.5">
              <p className="truncate text-[11px] font-semibold text-foreground">{attachment.fileName}</p>
              <p className="text-[10px] text-foreground-secondary">{formatFileSize(attachment.fileSize)}</p>
            </div>
          </button>
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setPreview(null)}
            aria-label="Close preview"
          />
          <div className="relative z-10 flex h-full max-h-[92vh] w-full max-w-6xl flex-col rounded-lg border border-white/10 bg-background shadow-2xl">
            <div className="flex min-h-0 items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{preview.fileName}</p>
                <p className="text-xs text-foreground-secondary">
                  {preview.mimeType} {formatFileSize(preview.fileSize) ? `• ${formatFileSize(preview.fileSize)}` : ""}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <a
                  href={preview.dataUrl}
                  download={preview.fileName}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground-secondary hover:text-foreground"
                  title="Download image"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground-secondary hover:text-foreground"
                  title="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 bg-black">
              <Image
                src={preview.dataUrl}
                alt={preview.fileName}
                fill
                sizes="100vw"
                unoptimized
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
