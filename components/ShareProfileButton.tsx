"use client";

import Link from "next/link";
import { Share2, Settings } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { copyToClipboard } from "@/lib/utils";

type ShareProfileButtonProps = {
  isShared: boolean;
  shareToken: string | null;
};

export function ShareProfileButton({ isShared, shareToken }: ShareProfileButtonProps) {
  const { showToast } = useToast();

  const handleCopy = async () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    const copied = await copyToClipboard(url);
    showToast(copied ? "success" : "error", copied ? "Link copied!" : "Could not copy link");
  };

  if (!isShared || !shareToken) {
    return (
      <Link
        href="/dashboard/settings"
        title="Enable in Settings"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background-secondary/70 text-sm font-medium text-foreground-secondary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      >
        <Settings className="w-4 h-4" />
        Share profile
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-sm font-medium text-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
    >
      <Share2 className="w-4 h-4" />
      Share profile
    </button>
  );
}
