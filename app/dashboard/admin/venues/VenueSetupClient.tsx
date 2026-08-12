"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Building2, Loader2, MapPinned, Pencil, Plus, Save, Trash2, X } from "lucide-react";

const venueTypes = [
  "CLASSROOM",
  "LAB",
  "LECTURE_HALL",
  "TUTORIAL_ROOM",
  "SEMINAR_ROOM",
  "LIBRARY",
  "AUDITORIUM",
  "ONLINE",
  "OTHER",
] as const;

type VenueType = (typeof venueTypes)[number];

type Venue = {
  id: string;
  name: string;
  code: string | null;
  building: string | null;
  floor: string | null;
  capacity: number | null;
  type: VenueType;
  facilities: string[];
  isActive: boolean;
  isPublic: boolean;
  isCustom: boolean;
};

type VenueDraft = {
  name: string;
  code: string;
  building: string;
  floor: string;
  capacity: string;
  type: VenueType;
  facilities: string;
  isPublic: boolean;
  isActive: boolean;
};

const emptyDraft = (): VenueDraft => ({
  name: "",
  code: "",
  building: "",
  floor: "",
  capacity: "",
  type: "CLASSROOM",
  facilities: "",
  isPublic: true,
  isActive: true,
});

function toDraft(venue: Venue): VenueDraft {
  return {
    name: venue.name,
    code: venue.code ?? "",
    building: venue.building ?? "",
    floor: venue.floor ?? "",
    capacity: venue.capacity?.toString() ?? "",
    type: venue.type,
    facilities: venue.facilities.join(", "),
    isPublic: venue.isPublic,
    isActive: venue.isActive,
  };
}

function toPayload(draft: VenueDraft) {
  const capacity = Number(draft.capacity);
  return {
    name: draft.name.trim(),
    code: draft.code.trim().toUpperCase() || undefined,
    building: draft.building.trim() || undefined,
    floor: draft.floor.trim() || undefined,
    capacity: draft.capacity.trim() && Number.isInteger(capacity) && capacity > 0 ? capacity : undefined,
    type: draft.type,
    facilities: draft.facilities.split(",").map((item) => item.trim()).filter(Boolean),
    isPublic: draft.isPublic,
    isActive: draft.isActive,
  };
}

function typeLabel(type: VenueType) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function VenueSetupClient() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<VenueDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: venues = [], isLoading } = useQuery<Venue[]>({
    queryKey: ["admin-venues"],
    queryFn: async () => {
      const response = await fetch("/api/venues?includeCustom=true");
      if (!response.ok) throw new Error("Could not load venues");
      return response.json();
    },
    staleTime: 30_000,
  });

  const saveVenue = useMutation({
    mutationFn: async () => {
      const response = await fetch(editingId ? `/api/venues/${editingId}` : "/api/venues", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(draft)),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save venue");
      return data as Venue;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-venues"] });
      setDraft(emptyDraft());
      setEditingId(null);
      setShowForm(false);
      setError(null);
    },
    onError: (saveError) => setError(saveError instanceof Error ? saveError.message : "Could not save venue"),
  });

  const deleteVenue = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/venues/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete venue");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-venues"] }),
    onError: (deleteError) => setError(deleteError instanceof Error ? deleteError.message : "Could not delete venue"),
  });

  const filteredVenues = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    if (!normalizedFilter) return venues;
    return venues.filter((venue) =>
      [venue.name, venue.code, venue.building, venue.type].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedFilter))
    );
  }, [filter, venues]);

  const startNew = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setError(null);
    setShowForm(true);
  };

  const startEdit = (venue: Venue) => {
    setDraft(toDraft(venue));
    setEditingId(venue.id);
    setError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setError(null);
    setShowForm(false);
  };

  const field = (key: keyof VenueDraft, value: VenueDraft[keyof VenueDraft]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/admin" className="mb-2 inline-flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Admin control centre
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <MapPinned className="h-6 w-6 text-primary" /> Venue catalogue
          </h1>
          <p className="mt-1 text-sm text-foreground-secondary">Set the shared rooms, labs and online locations offered in the timetable.</p>
        </div>
        <button onClick={startNew} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" /> Add venue
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            saveVenue.mutate();
          }}
          className="rounded-2xl border border-primary/25 bg-surface p-4 sm:p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">{editingId ? "Edit venue" : "New shared venue"}</h2>
              <p className="mt-0.5 text-xs text-foreground-secondary">Public venues appear as suggestions in the timetable editor.</p>
            </div>
            <button type="button" onClick={closeForm} className="rounded-lg p-2 text-foreground-secondary hover:bg-surface-hover hover:text-foreground" aria-label="Close venue form">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium text-foreground">
              Name
              <input required value={draft.name} onChange={(event) => field("name", event.target.value)} placeholder="Lecture Hall 101" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
            <label className="text-sm font-medium text-foreground">
              Code
              <input value={draft.code} onChange={(event) => field("code", event.target.value)} placeholder="LH101" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
            <label className="text-sm font-medium text-foreground">
              Type
              <select value={draft.type} onChange={(event) => field("type", event.target.value as VenueType)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/30">
                {venueTypes.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-foreground">
              Building
              <input value={draft.building} onChange={(event) => field("building", event.target.value)} placeholder="Main Building" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
            <label className="text-sm font-medium text-foreground">
              Floor
              <input value={draft.floor} onChange={(event) => field("floor", event.target.value)} placeholder="1" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
            <label className="text-sm font-medium text-foreground">
              Capacity
              <input inputMode="numeric" value={draft.capacity} onChange={(event) => field("capacity", event.target.value)} placeholder="60" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
            <label className="text-sm font-medium text-foreground sm:col-span-2 lg:col-span-3">
              Facilities <span className="font-normal text-foreground-secondary">(comma-separated)</span>
              <input value={draft.facilities} onChange={(event) => field("facilities", event.target.value)} placeholder="Projector, AC, Whiteboard" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
              <input type="checkbox" checked={draft.isPublic} onChange={(event) => field("isPublic", event.target.checked)} className="h-4 w-4 accent-primary" />
              Available to students
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
              <input type="checkbox" checked={draft.isActive} onChange={(event) => field("isActive", event.target.checked)} className="h-4 w-4 accent-primary" />
              Active
            </label>
          </div>

          {error && <p className="mt-3 text-sm text-error">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground-secondary hover:bg-surface-hover">Cancel</button>
            <button type="submit" disabled={saveVenue.isPending || !draft.name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {saveVenue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingId ? "Save changes" : "Create venue"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-border bg-surface">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Configured venues</h2>
              <p className="text-xs text-foreground-secondary">{venues.length} total · inactive or private venues remain manageable here</p>
            </div>
          </div>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter name, code or building" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 sm:w-64" />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-background" />)}</div>
        ) : filteredVenues.length === 0 ? (
          <div className="p-10 text-center text-sm text-foreground-secondary">No venues match this filter.</div>
        ) : (
          <div className="divide-y divide-border/70">
            {filteredVenues.map((venue) => (
              <div key={venue.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{venue.name}</p>
                    {venue.code && <span className="rounded-md bg-surface-hover px-1.5 py-0.5 font-mono text-xs text-foreground-secondary">{venue.code}</span>}
                    {!venue.isActive && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">Inactive</span>}
                    {!venue.isPublic && <span className="rounded-full bg-border/70 px-2 py-0.5 text-xs font-medium text-foreground-secondary">Private</span>}
                  </div>
                  <p className="mt-1 text-xs text-foreground-secondary">
                    {typeLabel(venue.type)}{venue.building ? ` · ${venue.building}` : ""}{venue.floor ? `, floor ${venue.floor}` : ""}{venue.capacity ? ` · ${venue.capacity} seats` : ""}
                  </p>
                  {venue.facilities.length > 0 && <p className="mt-1 text-xs text-foreground-secondary/80">{venue.facilities.join(" · ")}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => startEdit(venue)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete ${venue.name}? This cannot be undone.`)) deleteVenue.mutate(venue.id);
                    }}
                    disabled={deleteVenue.isPending}
                    className="rounded-lg border border-error/30 p-2 text-error hover:bg-error/10 disabled:opacity-50"
                    aria-label={`Delete ${venue.name}`}
                  >
                    {deleteVenue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
