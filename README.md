# PlanMyDegree

Degree planner for IIT Mandi students. Tracks credits, timetable, MTP/ISTP eligibility, semester exchange courses and internship credits without juggling four portals and a spreadsheet.

Live at **[planmydegree.app](https://planmydegree.app)**

---

## Supported Batches

| Batch | Branches |
|---|---|
| B22 | CSE |
| B23 | All 11 BTech branches + BS Chemical Sciences |
| B24 | All 11 BTech branches + BS Chemical Sciences |
| B25 | All 11 BTech branches + BS Chemical Sciences |

Branches: CSE, DSE, EE, EP, GE, ME, CE, BioE, MSE, MNC, MEVLSI, BSCS.

Sign in with your institute Google account (`@students.iitmandi.ac.in`). Auto-approved if your roll number and branch are in the system.

---

## Features

**Credit tracking.** Auto-calculates IC, IC Basket, DC, DE, FE, HSS, IKS, MTP and ISTP credits from your enrollments. Tracks MTP and ISTP eligibility based on semester and credit thresholds. Shows P/F credit usage against the 9-credit cap. Internship courses (XX-399P onsite, XX-396P remote) are correctly classified as Free Electives. Real-time progress bars and credit breakdown charts per category.

**Courses.** Add courses semester-wise with grades, enrollment status and credit type overrides. Search and filter the full course catalog by department, semester or keyword. Smart recommendations suggest courses you still need based on your branch requirements. Semester exchange course equivalency mappings included for TU Munich, TU Darmstadt, Kyushu, RWTH Aachen and others.

**Import Courses.** Bulk-enroll courses by pasting your transcript or selecting from the catalog index. Detects already-enrolled courses and skips duplicates. Picks up your branch, batch and MTP settings automatically.

**Pre-registration.** Plan next semester's courses before official registration opens. View available slots, see which courses are offered and build your plan. Admins can create and manage pre-registration plans with course lists, seat caps and deadlines.

**Programs.** Tracks degree requirements per branch (Major, Minor, Double Major). Shows how far along you are in each credit category with progress indicators. Flags when you become eligible for MTP or ISTP based on completed credits.

**Timetable.** Weekly calendar view with day, time, venue and room for each class. Supports lecture, tutorial, lab and seminar class types. Conflict detection warns you before you finalize overlapping slots. Export your schedule as an ICS file for Google Calendar or Outlook. Admins can bulk-upload timetable entries and autofill venues.

**Academics.** Static reference page covering the full B.Tech/B.S. 2023 curriculum: credit distribution, discipline core/elective splits by branch, IC basket options, HSS+IKS requirements, ISTP and MTP details, pass/fail and audit rules, internship types (6-week mandatory, semester-long remote/onsite), semester exchange program with partner universities and grade conversion tables, honours degree requirements (Mode A and B) and all 15 minor programs with their course requirements.

**Documents.** Upload and organize academic documents by category (forms, procedures, guides, certificates, transcripts). Role-based access so admins can manage shared documents.

**Course mappings.** View how any course is classified across different branches (DC in one branch might be DE or FE in another). Useful for checking if a course counts toward your requirements before enrolling.

**Admin panel.** Manage approved users, view login attempt logs, post announcements, create and edit pre-registration plans and run bulk timetable operations. Admin-only routes with role-based access control.

**Inbox.** In-app announcements and notifications from admins. Read/unread tracking per user.

**Support.** Submit help requests and feedback directly from the app. Admins can view and respond to tickets.

**Settings.** Set your branch, batch, MTP/ISTP preferences (doing MTP, doing ISTP, skipping either) and theme. Choices feed into the credit calculator so your progress page stays accurate.

Works on mobile, installable as a PWA, offline fallback via service worker. Dark and light modes. Responsive across all pages.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes, server components with SSR data seeding |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Auth | NextAuth.js (Google OAuth, JWT sessions) |
| Data Fetching | TanStack React Query with optimistic updates |
| Charts | Recharts |
| Hosting | Vercel |

---

## Running Locally

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/degree_planner
NEXTAUTH_SECRET=          # generate with: openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

Then:

```bash
npx prisma generate
npx prisma db push
npx prisma db seed   # optional, seeds programs and course data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  api/                  route handlers (auth, courses, enrollments, timetable, documents, ...)
  auth/                 sign-in and error pages
  dashboard/
    courses/            semester-wise course management + catalog search
    import-courses/     bulk enrollment from transcript
    programs/           degree programs and credit requirements
    progress/           credit breakdown charts and progress bars
    timetable/          weekly schedule with conflict detection
    pre-registration/   next-semester course planning
    academics/          curriculum reference (lazy-loaded tab sections)
    documents/          forms, certificates and transcripts
    course-mappings/    DC/DE/PE/FE classification per branch
    inbox/              announcements and notifications
    support/            help requests and feedback
    admin/              user management, announcements, pre-reg plans, timetable ops
    settings/           branch, batch, MTP/ISTP preferences, theme

components/             25+ shared React components
lib/                    credit calculator, auth config, validation, rate limiting, utilities
prisma/                 schema (15+ models) and seed scripts
public/                 service worker, PWA manifest, offline fallback, static assets
```
