"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  FileText, 
  Download, 
  Upload, 
  Search, 
  ExternalLink,
  Link2,
  Eye,
  Trash2,
  FolderOpen,
  X
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useToast } from "./ToastProvider";
import { useConfirmDialog } from "./ConfirmDialog";

interface DocumentsViewProps {
  userId: string;
  role: string;
}

const CATEGORIES = [
  { value: "FORMS", label: "Forms & Applications", icon: FileText },
  { value: "PROCEDURES", label: "Procedures & Guidelines", icon: FolderOpen },
  { value: "GUIDES", label: "Academic Guides", icon: FileText },
  { value: "CERTIFICATES", label: "Certificates", icon: FileText },
  { value: "TRANSCRIPTS", label: "Transcripts", icon: FileText },
  { value: "OTHER", label: "Other Documents", icon: FileText },
];

type DocumentRecord = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  isPublic?: boolean;
  createdAt: string;
};

type PreviewConfig =
  | { kind: "iframe"; src: string; allowFullScreen?: boolean; referrerPolicy?: React.HTMLAttributeReferrerPolicy; title: string }
  | { kind: "image"; src: string; alt: string }
  | { kind: "none"; reason: string };

function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function getDriveFolderId(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const foldersIndex = parts.findIndex((p) => p === "folders");
    if (foldersIndex >= 0 && parts[foldersIndex + 1]) return parts[foldersIndex + 1];

    const id = u.searchParams.get("id");
    if (id) return id;
  } catch {
    // fall through
  }

  const idMatch = url.match(/[?&]id=([^&#]+)/i);
  if (idMatch?.[1]) return decodeURIComponent(idMatch[1]);

  const pathMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
  if (pathMatch?.[1]) return pathMatch[1];

  return null;
}

function getPreviewConfig(fileUrl: string | null | undefined): PreviewConfig {
  if (!fileUrl) return { kind: "none", reason: "No URL available for preview." };

  const raw = fileUrl.trim();
  if (!raw) return { kind: "none", reason: "No URL available for preview." };

  const url = normalizeUrlInput(raw);
  const lowerNoQuery = url.split("#")[0]?.split("?")[0]?.toLowerCase() || "";

  const isImage = /\.(png|jpe?g|gif|webp|svg)$/.test(lowerNoQuery);
  if (isImage) return { kind: "image", src: url, alt: "Document preview" };

  const isPdf = lowerNoQuery.endsWith(".pdf");
  if (isPdf || url.startsWith("/")) {
    // PDFs and same-origin uploads generally work in an iframe.
    return { kind: "iframe", src: url, title: "Document preview" };
  }

  if (url.includes("drive.google.com")) {
    const folderId = getDriveFolderId(url);
    if (folderId) {
      return {
        kind: "iframe",
        src: `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#grid`,
        title: "Google Drive folder",
      };
    }
  }

  if (url.includes("canva.com")) {
    const embedUrl = url.includes("embed")
      ? url
      : url.includes("?")
        ? `${url}&embed`
        : `${url}?embed`;

    return {
      kind: "iframe",
      src: embedUrl,
      allowFullScreen: true,
      referrerPolicy: "no-referrer-when-downgrade",
      title: "Canva presentation",
    };
  }

  // Default: open in a new tab (many sites block iframe embedding).
  return { kind: "none", reason: "Preview not available. Open the link instead." };
}

export function DocumentsView({ userId, role }: DocumentsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);

  const reducedMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", userId, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      const res = await fetch(`/api/documents?${params}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const filteredDocs: DocumentRecord[] = useMemo(() => {
    const list: DocumentRecord[] = Array.isArray(documents) ? documents : [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((doc) => {
      const title = (doc.title || "").toLowerCase();
      const desc = (doc.description || "").toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [documents, searchQuery]);

  const previewConfig = useMemo(() => getPreviewConfig(previewDoc?.fileUrl), [previewDoc?.fileUrl]);

  useEffect(() => {
    if (!previewDoc && !isAddLinkOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPreviewDoc(null);
      setIsAddLinkOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewDoc, isAddLinkOpen]);

  const handleCreateLinkDoc = async (payload: {
    title: string;
    description?: string;
    category: string;
    url: string;
    isPublic: boolean;
  }) => {
    const url = normalizeUrlInput(payload.url);
    if (!payload.title.trim()) {
      showToast("warning", "Title is required");
      return;
    }
    if (!url.trim()) {
      showToast("warning", "URL is required");
      return;
    }

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title.trim(),
          description: payload.description?.trim() || undefined,
          category: payload.category,
          fileUrl: url,
          fileName: payload.title.trim(),
          isPublic: payload.isPublic,
          mimeType: "text/html",
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to add link");
      }

      showToast("success", "Link added");
      setIsAddLinkOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["documents", userId, selectedCategory] });
    } catch (error: any) {
      showToast("error", error?.message || "Failed to add link");
    }
  };

  const handleDeleteDocument = async (document: DocumentRecord) => {
    const ok = await confirm({
      title: "Delete document?",
      message: `This will permanently delete "${document.title}".`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    });

    if (!ok) return;

    try {
      const res = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to delete document");
      }

      showToast("success", "Document deleted");
      await queryClient.invalidateQueries({ queryKey: ["documents", userId, selectedCategory] });
    } catch (error: any) {
      showToast("error", error?.message || "Failed to delete document");
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground-secondary" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-surface text-foreground focus:ring-2 focus:ring-primary"
          />
        </div>
        {role === "ADMIN" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddLinkOpen(true)}
              className="px-4 py-2 bg-surface border border-border rounded-md font-medium hover:bg-surface-hover flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <Link2 className="w-4 h-4" />
              Add Link / Embed
            </button>
            <button className="px-4 py-2 bg-primary text-white rounded-md font-medium hover:bg-primary-hover flex items-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          </div>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            selectedCategory === null
              ? "bg-primary text-white"
              : "bg-background-secondary dark:bg-surface text-foreground-secondary hover:bg-surface dark:hover:bg-background"
          }`}
        >
          All Categories
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedCategory === cat.value
                ? "bg-primary text-white"
                : "bg-background-secondary dark:bg-surface text-foreground-secondary hover:bg-surface dark:hover:bg-background"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Documents Grid/List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-background-secondary dark:bg-surface rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : filteredDocs && filteredDocs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc: any) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              isAdmin={role === "ADMIN"}
              onView={() => setPreviewDoc(doc)}
              onDelete={() => handleDeleteDocument(doc)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-surface dark:bg-surface rounded-lg border border-border">
          <FileText className="w-16 h-16 text-foreground-secondary mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No documents found</h3>
          <p className="text-foreground-secondary">
            {searchQuery ? "Try a different search term" : "No documents available in this category"}
          </p>
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div
            key="doc-preview"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
            onClick={() => setPreviewDoc(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Document preview"
          >
            <motion.div
              initial={reducedMotion ? { opacity: 1 } : { scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { scale: 0.98, opacity: 0 }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 35 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface rounded-2xl shadow-2xl w-full max-w-5xl border border-border overflow-hidden"
            >
              <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-1 bg-primary/10 dark:bg-primary/20 text-primary rounded border border-primary/20">
                      {previewDoc.category}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">{previewDoc.title}</h2>
                  {previewDoc.description && (
                    <p className="text-sm text-foreground-secondary mt-1 line-clamp-2">{previewDoc.description}</p>
                  )}
                </div>

                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-lg hover:bg-surface-hover text-foreground-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6">
                {previewConfig.kind === "iframe" ? (
                  <iframe
                    src={previewConfig.src}
                    title={previewConfig.title}
                    className="w-full h-[70vh] rounded-xl border border-border bg-background-secondary"
                    allowFullScreen={previewConfig.allowFullScreen}
                    referrerPolicy={previewConfig.referrerPolicy}
                    loading="lazy"
                  />
                ) : previewConfig.kind === "image" ? (
                  <div className="flex items-center justify-center bg-background-secondary rounded-xl border border-border p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewConfig.src} alt={previewConfig.alt} className="max-h-[70vh] w-auto rounded-lg" />
                  </div>
                ) : (
                  <div className="bg-background-secondary rounded-xl border border-border p-6 text-center">
                    <p className="text-foreground-secondary">{previewConfig.reason}</p>
                    <p className="text-xs text-foreground-muted mt-2">
                      If you expected an embed (Drive folder / Canva), make sure link sharing allows viewing.
                    </p>
                  </div>
                )}

                {previewDoc.fileUrl && (
                  <div className="mt-4 flex items-center justify-end">
                    <a
                      href={normalizeUrlInput(previewDoc.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in new tab
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Link / Embed Modal */}
      <AnimatePresence>
        {isAddLinkOpen && (
          <AddLinkModal
            reducedMotion={reducedMotion}
            onClose={() => setIsAddLinkOpen(false)}
            onSubmit={handleCreateLinkDoc}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DocumentCard({
  document,
  isAdmin,
  onView,
  onDelete,
}: {
  document: DocumentRecord;
  isAdmin: boolean;
  onView: () => void;
  onDelete: () => void;
}) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="bg-surface dark:bg-surface border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <span className="text-xs px-2 py-1 bg-primary bg-opacity-10 dark:bg-opacity-20 text-primary rounded">
            {document.category}
          </span>
        </div>
        {isAdmin && (
          <button onClick={onDelete} className="text-red-500 hover:text-red-600 p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <h3 className="font-medium text-foreground mb-2 line-clamp-2">{document.title}</h3>
      
      {document.description && (
        <p className="text-sm text-foreground-secondary mb-3 line-clamp-2">
          {document.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-foreground-secondary mb-3">
        <span>{new Date(document.createdAt).toLocaleDateString()}</span>
        {document.fileSize && <span>{formatFileSize(document.fileSize)}</span>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onView}
          disabled={!document.fileUrl}
          className="flex-1 px-3 py-2 bg-background-secondary dark:bg-background text-foreground rounded-md text-sm font-medium hover:bg-surface dark:hover:bg-surface flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
        {document.fileUrl && (
          <a
            href={normalizeUrlInput(document.fileUrl)}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover flex items-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            aria-label="Open document"
            title="Open"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function AddLinkModal({
  reducedMotion,
  onClose,
  onSubmit,
}: {
  reducedMotion: boolean;
  onClose: () => void;
  onSubmit: (payload: { title: string; description?: string; category: string; url: string; isPublic: boolean }) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]?.value || "FORMS");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <motion.div
      key="add-link-modal"
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Add link or embed"
    >
      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { scale: 0.98, opacity: 0 }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-xl border border-border overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4 p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">Add Link / Embed</h2>
            <p className="text-sm text-foreground-secondary mt-1">
              Paste a Google Drive folder link or a Canva presentation link. We'll try to embed it automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover text-foreground-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Academic Forms Drive Folder"
              className="w-full px-4 py-2 border border-border rounded-lg bg-surface text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/...  or  https://www.canva.com/design/..."
              className="w-full px-4 py-2 border border-border rounded-lg bg-surface text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-surface text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-foreground-secondary select-none">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus-visible:ring-4 focus-visible:ring-primary/20"
                />
                Visible to everyone
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note for students..."
              rows={3}
              className="w-full px-4 py-2 border border-border rounded-lg bg-surface text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 resize-none"
            />
          </div>
        </div>

        <div className="p-5 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border bg-surface text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (isSubmitting) return;
              setIsSubmitting(true);
              try {
                await onSubmit({
                  title,
                  description,
                  category,
                  url,
                  isPublic,
                });
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Adding..." : "Add"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
