"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, ChevronRight, Loader2, Plus, Save, Settings2 } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

const BRANCHES = [
  ["CSE", "Computer Science & Engineering"], ["DSE", "Data Science & Engineering"],
  ["DSAI", "Data Science & Artificial Intelligence"], ["EE", "Electrical Engineering"],
  ["ME", "Mechanical Engineering"], ["CE", "Civil Engineering"], ["BE", "Bio Engineering"],
  ["EP", "Engineering Physics"], ["MSE", "Materials Science & Engineering"], ["MNC", "Mathematics & Computing"],
  ["MEVLSI", "Microelectronics & VLSI"], ["GE", "General Engineering"], ["GE-MECH", "GE - Mechatronics"],
  ["GE-COMM", "GE - Communication Tech"], ["GE-ROBO", "GE - AI & Robotics"], ["BSCS", "B.S. Chemical Sciences"],
  ["CHE", "B.Tech Chemical Engineering (B26)"], ["QS", "B.Tech Quantum Science & Engineering (B26)"],
  ["AG", "B.Tech Agricultural Engineering & Data Analytics (B26)"],
] as const;

const CATEGORIES = [
  ["IC", "IC — Institute Core"], ["IC_BASKET", "IC Basket"], ["DC", "DC — Discipline Core"],
  ["DE", "DE — Discipline Elective"], ["FE", "FE — Free Elective"], ["HSS", "HSS"],
  ["IKS", "IKS"], ["MTP", "MTP"], ["ISTP", "ISTP"], ["NA", "N/A"],
] as const;

const CATALOG_SECTIONS = [
  "SCEE (CSE, DSE/DSAI, EE, VL)", "SMSS (MNC)", "SMME (GE, MSE, ME)",
  "SPS / CQST / SQST (EP, QS, QT)", "SCENE (CE)", "SCS (BS CS)", "SBS (BE)",
  "SHSS (HS)", "Common (IC/IKS/DP)", "TU Munich (Semester Exchange)",
  "TU Darmstadt (Semester Exchange)", "TU Braunschweig (Semester Exchange)",
  "RWTH Aachen (Semester Exchange)", "Leibniz University Hannover (Semester Exchange)",
];

type CourseListItem = {
  id: string; code: string; name: string; credits: number; department: string;
  catalogSection: string | null; isActive: boolean; _count: { branchMappings: number; offerings: number };
};
type Mapping = { id: string; branch: string; batch: string; courseCategory: string; isRequired: boolean; semester: number | null };
type Offering = {
  id: string; offeringSemester: number; offeringYear: number; branches: string[]; eligibleSems: number[];
  slots: string | null; instructor: string | null; instructorEmail: string | null; school: string | null;
  categoryOverride: string | null; curriculumLink: string | null; compulsorySem: number | null; isActive: boolean;
};
type CourseDetails = CourseListItem & {
  level: number; description: string | null; ltpc: string | null; offeredInFall: boolean; offeredInSpring: boolean;
  offeredInSummer: boolean; isPassFailEligible: boolean; branchMappings: Mapping[]; offerings: Offering[];
};

type CourseForm = {
  code: string; name: string; credits: string; department: string; level: string; description: string; ltpc: string;
  offeredInFall: boolean; offeredInSpring: boolean; offeredInSummer: boolean; isPassFailEligible: boolean; isActive: boolean;
};
type MappingForm = { branch: string; batch: string; courseCategory: string; isRequired: boolean; semester: string };
type OfferingForm = {
  id?: string; offeringSemester: string; offeringYear: string; branches: string; eligibleSems: string; slots: string;
  instructor: string; instructorEmail: string; school: string; categoryOverride: string; curriculumLink: string;
  compulsorySem: string; isActive: boolean;
};

const emptyCourse = (): CourseForm => ({
  code: "", name: "", credits: "", department: "", level: "0", description: "", ltpc: "",
  offeredInFall: false, offeredInSpring: false, offeredInSummer: false, isPassFailEligible: false, isActive: true,
});
const emptyMapping = (): MappingForm => ({ branch: "CSE", batch: "", courseCategory: "FE", isRequired: false, semester: "" });
const emptyOffering = (): OfferingForm => ({
  offeringSemester: "7", offeringYear: "2026", branches: "ALL", eligibleSems: "3, 5, 7", slots: "TBD",
  instructor: "", instructorEmail: "", school: "", categoryOverride: "", curriculumLink: "", compulsorySem: "", isActive: true,
});

function toCourseForm(course: CourseDetails): CourseForm {
  return {
    code: course.code, name: course.name, credits: String(course.credits), department: course.department, level: String(course.level),
    description: course.description ?? "", ltpc: course.ltpc ?? "", offeredInFall: course.offeredInFall,
    offeredInSpring: course.offeredInSpring, offeredInSummer: course.offeredInSummer,
    isPassFailEligible: course.isPassFailEligible, isActive: course.isActive,
  };
}

function toOfferingForm(offering: Offering): OfferingForm {
  return {
    id: offering.id, offeringSemester: String(offering.offeringSemester), offeringYear: String(offering.offeringYear),
    branches: offering.branches.join(", "), eligibleSems: offering.eligibleSems.join(", "), slots: offering.slots ?? "",
    instructor: offering.instructor ?? "", instructorEmail: offering.instructorEmail ?? "", school: offering.school ?? "",
    categoryOverride: offering.categoryOverride ?? "", curriculumLink: offering.curriculumLink ?? "",
    compulsorySem: offering.compulsorySem ? String(offering.compulsorySem) : "", isActive: offering.isActive,
  };
}

function parseNumberList(value: string) {
  return value.split(",").map((part) => Number(part.trim())).filter((item) => Number.isInteger(item));
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block text-sm font-medium text-foreground"><span>{label}</span>{children}{hint && <span className="mt-1 block text-xs font-normal text-foreground-secondary">{hint}</span>}</label>;
}

const inputClass = "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function CourseSetupClient() {
  const { showToast } = useToast();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [selected, setSelected] = useState<CourseDetails | null>(null);
  const [courseForm, setCourseForm] = useState<CourseForm>(emptyCourse);
  const [mappingForm, setMappingForm] = useState<MappingForm>(emptyMapping);
  const [offeringForm, setOfferingForm] = useState<OfferingForm>(emptyOffering);
  const [initialBasket, setInitialBasket] = useState(false);
  const [catalogPreset, setCatalogPreset] = useState("");
  const [customCatalogSection, setCustomCatalogSection] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"course" | "mapping" | "offering" | null>(null);

  const visibleCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) => `${course.code} ${course.name} ${course.department}`.toLowerCase().includes(query));
  }, [courses, search]);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/courses", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCourses(data.courses);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Could not load courses");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void loadCourses(); }, [loadCourses]);

  const selectCourse = async (courseId: string) => {
    try {
      const response = await fetch(`/api/admin/courses?courseId=${encodeURIComponent(courseId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const course = data.course as CourseDetails;
      setSelected(course); setCourseForm(toCourseForm(course)); setInitialBasket(false); setMappingForm(emptyMapping()); setOfferingForm(emptyOffering());
      if (course.catalogSection && CATALOG_SECTIONS.includes(course.catalogSection)) {
        setCatalogPreset(course.catalogSection); setCustomCatalogSection("");
      } else if (course.catalogSection) {
        setCatalogPreset("__custom__"); setCustomCatalogSection(course.catalogSection);
      } else {
        setCatalogPreset(""); setCustomCatalogSection("");
      }
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Could not open course");
    }
  };

  const startNew = () => {
    setSelected(null); setCourseForm(emptyCourse()); setMappingForm(emptyMapping()); setOfferingForm(emptyOffering());
    setInitialBasket(false); setCatalogPreset(""); setCustomCatalogSection("");
  };

  const catalogSection = catalogPreset === "__custom__" ? customCatalogSection.trim() || null : catalogPreset || null;
  const coursePayload = {
    ...courseForm, credits: Number(courseForm.credits), level: Number(courseForm.level),
    catalogSection,
  };

  const saveCourse = async () => {
    setSaving("course");
    try {
      const response = await fetch("/api/admin/courses", {
        method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected
          ? { action: "course", courseId: selected.id, course: coursePayload }
          : { course: coursePayload, ...(initialBasket ? { mapping: { ...mappingForm, semester: mappingForm.semester ? Number(mappingForm.semester) : null } } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const course = data.course as CourseDetails;
      setSelected(course); setCourseForm(toCourseForm(course)); setInitialBasket(false);
      await loadCourses();
      showToast("success", selected ? "Course details updated across catalogue and offerings" : "Course added to the catalogue");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Could not save course");
    } finally { setSaving(null); }
  };

  const saveMapping = async () => {
    if (!selected) return;
    setSaving("mapping");
    try {
      const response = await fetch("/api/admin/courses", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mapping", courseId: selected.id, mapping: { ...mappingForm, semester: mappingForm.semester ? Number(mappingForm.semester) : null } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await selectCourse(selected.id); await loadCourses();
      showToast("success", "Basket rule saved");
    } catch (error) { showToast("error", error instanceof Error ? error.message : "Could not save basket rule"); }
    finally { setSaving(null); }
  };

  const saveOffering = async () => {
    if (!selected) return;
    setSaving("offering");
    try {
      const response = await fetch("/api/admin/courses", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "offering",
          offering: {
            ...offeringForm, courseId: selected.id, offeringSemester: Number(offeringForm.offeringSemester),
            offeringYear: Number(offeringForm.offeringYear), branches: offeringForm.branches.split(",").map((item) => item.trim()).filter(Boolean),
            eligibleSems: parseNumberList(offeringForm.eligibleSems), categoryOverride: offeringForm.categoryOverride || null,
            compulsorySem: offeringForm.compulsorySem ? Number(offeringForm.compulsorySem) : null,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await selectCourse(selected.id); await loadCourses();
      showToast("success", "Registration offering saved");
    } catch (error) { showToast("error", error instanceof Error ? error.message : "Could not save offering"); }
    finally { setSaving(null); }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/admin" className="mb-2 inline-flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-primary"><ArrowLeft className="h-4 w-4" />Admin control centre</Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Settings2 className="h-6 w-6 text-primary" />Course setup</h1>
          <p className="mt-1 max-w-3xl text-sm text-foreground-secondary">Create catalogue courses, assign branch or batch baskets and publish the exact offering students see during course registration.</p>
        </div>
        <button onClick={startNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />New course</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(250px,0.75fr)_minmax(0,1.8fr)]">
        <aside className="rounded-2xl border border-border bg-surface p-3 sm:p-4 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto">
          <div className="mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /><h2 className="font-semibold text-foreground">Course catalogue</h2></div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find code or name" className={inputClass + " mt-0"} />
          <div className="mt-3 space-y-1.5">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : visibleCourses.map((course) => (
              <button key={course.id} onClick={() => void selectCourse(course.id)} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === course.id ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-surface-hover"}`}>
                <div className="flex gap-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{course.code}</span><ChevronRight className="h-4 w-4 shrink-0 text-foreground-secondary" /></div>
                <p className="mt-0.5 line-clamp-2 text-xs text-foreground-secondary">{course.name}</p>
                <p className="mt-1 text-[11px] text-foreground-muted">{course.credits} Cr · {course._count.offerings} offering{course._count.offerings === 1 ? "" : "s"}</p>
              </button>
            ))}
            {!loading && visibleCourses.length === 0 && <p className="px-2 py-8 text-center text-sm text-foreground-secondary">No matching courses</p>}
          </div>
        </aside>

        <section className="space-y-5">
          <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-foreground">{selected ? `Edit ${selected.code}` : "Catalogue course"}</h2><p className="mt-1 text-sm text-foreground-secondary">This is the canonical course record used by the catalogue, mappings and offerings.</p></div>{selected && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selected.isActive ? "bg-success/10 text-success" : "bg-foreground-muted/10 text-foreground-muted"}`}>{selected.isActive ? "Active" : "Hidden"}</span>}</div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Course code"><input value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="CS-305" className={inputClass} /></Field>
              <Field label="Course name"><input value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="Course title" className={inputClass} /></Field>
              <Field label="Credits"><input type="number" step="0.01" min="0" value={courseForm.credits} onChange={(e) => setCourseForm({ ...courseForm, credits: e.target.value })} placeholder="3" className={inputClass} /></Field>
              <Field label="L-T-P-C"><input value={courseForm.ltpc} onChange={(e) => setCourseForm({ ...courseForm, ltpc: e.target.value })} placeholder="3-0-0-3" className={inputClass} /></Field>
              <Field label="Course level" hint="Use the catalogue level, e.g. 100, 200, 300 or 500."><input type="number" min="0" max="999" value={courseForm.level} onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })} placeholder="300" className={inputClass} /></Field>
              <Field label="Department / source school"><input value={courseForm.department} onChange={(e) => setCourseForm({ ...courseForm, department: e.target.value })} placeholder="School of Computing..." className={inputClass} /></Field>
              <Field label="Catalogue section" hint="Choose an existing section or create a named one that will group this course in the catalogue."><select value={catalogPreset} onChange={(e) => setCatalogPreset(e.target.value)} className={inputClass}><option value="">Automatic from code / department</option>{CATALOG_SECTIONS.map((section) => <option key={section} value={section}>{section}</option>)}<option value="__custom__">Create a new section…</option></select></Field>
              {catalogPreset === "__custom__" && <Field label="New catalogue section"><input value={customCatalogSection} onChange={(e) => setCustomCatalogSection(e.target.value)} placeholder="e.g. School of Design" className={inputClass} /></Field>}
              <Field label="Description"><input value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} placeholder="Optional" className={inputClass} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm text-foreground"><Check label="Fall" checked={courseForm.offeredInFall} onChange={(value) => setCourseForm({ ...courseForm, offeredInFall: value })} /><Check label="Spring" checked={courseForm.offeredInSpring} onChange={(value) => setCourseForm({ ...courseForm, offeredInSpring: value })} /><Check label="Summer" checked={courseForm.offeredInSummer} onChange={(value) => setCourseForm({ ...courseForm, offeredInSummer: value })} /><Check label="P/F eligible" checked={courseForm.isPassFailEligible} onChange={(value) => setCourseForm({ ...courseForm, isPassFailEligible: value })} /><Check label="Visible in catalogue" checked={courseForm.isActive} onChange={(value) => setCourseForm({ ...courseForm, isActive: value })} /></div>
            {!selected && <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4"><Check label="Set a branch or batch basket now" checked={initialBasket} onChange={setInitialBasket} /><p className="mt-1 text-xs text-foreground-secondary">Every new course is FE by default for all other branches. A selected branch or batch rule overrides that default.</p>{initialBasket && <MappingFields form={mappingForm} setForm={setMappingForm} />}</div>}
            <button disabled={saving !== null} onClick={() => void saveCourse()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Save className="h-4 w-4" />{saving === "course" ? "Saving…" : selected ? "Save course details" : "Create course"}</button>
          </section>

          {selected && <>
            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6"><div><h2 className="text-lg font-semibold text-foreground">Basket and mapping rule</h2><p className="mt-1 text-sm text-foreground-secondary">A specific branch and batch wins over the built-in <b>COMMON · FE</b> fallback for all other students.</p></div><MappingFields form={mappingForm} setForm={setMappingForm} /><button disabled={saving !== null} onClick={() => void saveMapping()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-60"><Save className="h-4 w-4" />{saving === "mapping" ? "Saving…" : "Save basket rule"}</button><MappingList mappings={selected.branchMappings} /></section>

            <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-semibold text-foreground">Course registration offering</h2><p className="mt-1 text-sm text-foreground-secondary">An active offering makes this course available in the registration page for its term, branches and eligible semesters.</p></div><select value={offeringForm.id ?? ""} onChange={(e) => { const offering = selected.offerings.find((item) => item.id === e.target.value); setOfferingForm(offering ? toOfferingForm(offering) : emptyOffering()); }} className={inputClass + " mt-0 sm:w-64"}><option value="">New offering</option>{selected.offerings.map((offering) => <option key={offering.id} value={offering.id}>Sem {offering.offeringSemester}, {offering.offeringYear} · {offering.slots || "No slot"}</option>)}</select></div><OfferingFields form={offeringForm} setForm={setOfferingForm} /><button disabled={saving !== null} onClick={() => void saveOffering()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Save className="h-4 w-4" />{saving === "offering" ? "Saving…" : offeringForm.id ? "Update offering" : "Publish offering"}</button></section>
          </>}
        </section>
      </div>
    </main>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />{label}</label>;
}

function MappingFields({ form, setForm }: { form: MappingForm; setForm: (form: MappingForm) => void }) {
  return <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Field label="Branch"><select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} className={inputClass}>{BRANCHES.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}</select></Field><Field label="Batch" hint="Leave empty for all batches."><input type="number" min="2000" max="2099" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} placeholder="e.g. 2026" className={inputClass} /></Field><Field label="Basket / category"><select value={form.courseCategory} onChange={(e) => setForm({ ...form, courseCategory: e.target.value })} className={inputClass}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Curriculum semester"><input type="number" min="1" max="12" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="Optional" className={inputClass} /></Field><div className="sm:col-span-2 xl:col-span-4"><Check label="Required course for this branch / batch" checked={form.isRequired} onChange={(value) => setForm({ ...form, isRequired: value })} /></div></div>;
}

function MappingList({ mappings }: { mappings: Mapping[] }) {
  return <div className="mt-5 border-t border-border pt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-secondary">Saved rules</p><div className="flex flex-wrap gap-2">{mappings.map((mapping) => <span key={mapping.id} className="rounded-lg bg-surface-hover px-2.5 py-1.5 text-xs text-foreground"><b>{mapping.branch}</b>{mapping.batch ? ` · B${mapping.batch.slice(2)}` : " · all batches"} → {mapping.courseCategory}{mapping.semester ? ` · Sem ${mapping.semester}` : ""}{mapping.isRequired ? " · Required" : ""}</span>)}</div></div>;
}

function OfferingFields({ form, setForm }: { form: OfferingForm; setForm: (form: OfferingForm) => void }) {
  const update = (patch: Partial<OfferingForm>) => setForm({ ...form, ...patch });
  return <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Field label="Offering semester"><input type="number" min="1" max="12" value={form.offeringSemester} onChange={(e) => update({ offeringSemester: e.target.value })} className={inputClass} /></Field><Field label="Offering year"><input type="number" min="2020" max="2100" value={form.offeringYear} onChange={(e) => update({ offeringYear: e.target.value })} className={inputClass} /></Field><Field label="Slot" hint="Use TBD or NS when a fixed time is not published yet."><input value={form.slots} onChange={(e) => update({ slots: e.target.value })} placeholder="A, B or TBD" className={inputClass} /></Field><Field label="Branches" hint="Comma-separated or ALL"><input value={form.branches} onChange={(e) => update({ branches: e.target.value })} placeholder="ALL" className={inputClass} /></Field><Field label="Eligible student semesters" hint="Comma-separated, e.g. 3, 5, 7"><input value={form.eligibleSems} onChange={(e) => update({ eligibleSems: e.target.value })} placeholder="3, 5, 7" className={inputClass} /></Field><Field label="Fallback category" hint="Mapping rules take priority."><select value={form.categoryOverride} onChange={(e) => update({ categoryOverride: e.target.value })} className={inputClass}><option value="">Use mapping / FE default</option>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Instructor"><input value={form.instructor} onChange={(e) => update({ instructor: e.target.value })} placeholder="Optional" className={inputClass} /></Field><Field label="Instructor email"><input type="email" value={form.instructorEmail} onChange={(e) => update({ instructorEmail: e.target.value })} placeholder="Optional" className={inputClass} /></Field><Field label="School"><input value={form.school} onChange={(e) => update({ school: e.target.value })} placeholder="Defaults to course department" className={inputClass} /></Field><Field label="Compulsory semester"><input type="number" min="1" max="12" value={form.compulsorySem} onChange={(e) => update({ compulsorySem: e.target.value })} placeholder="Optional" className={inputClass} /></Field><Field label="Curriculum link"><input type="url" value={form.curriculumLink} onChange={(e) => update({ curriculumLink: e.target.value })} placeholder="Optional URL" className={inputClass} /></Field><div className="flex items-end pb-2"><Check label="Active for registration" checked={form.isActive} onChange={(value) => update({ isActive: value })} /></div></div>;
}
