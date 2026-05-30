"use client";

import { ImageIcon } from "lucide-react";
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
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.dataUrl}
          target="_blank"
          rel="noreferrer"
          className="group overflow-hidden rounded-lg border border-border bg-surface hover:border-primary/40 transition-colors"
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
        </a>
      ))}
    </div>
  );
}
