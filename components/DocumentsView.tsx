"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  FileText, 
  Download, 
  Upload, 
  Search, 
  Filter,
  Eye,
  Trash2,
  FolderOpen
} from "lucide-react";

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

export function DocumentsView({ userId, role }: DocumentsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredDocs = documents?.filter((doc: any) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <button className="px-4 py-2 bg-primary text-white rounded-md font-medium hover:bg-primary-hover flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
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
            <DocumentCard key={doc.id} document={doc} isAdmin={role === "ADMIN"} />
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
    </div>
  );
}

function DocumentCard({ document, isAdmin }: { document: any; isAdmin: boolean }) {
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
          <button className="text-red-500 hover:text-red-600 p-1">
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
        <button className="flex-1 px-3 py-2 bg-background-secondary dark:bg-background text-foreground rounded-md text-sm font-medium hover:bg-surface dark:hover:bg-surface flex items-center justify-center gap-2">
          <Eye className="w-4 h-4" />
          View
        </button>
        {document.fileUrl && (
          <button className="px-3 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover flex items-center gap-2">
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
