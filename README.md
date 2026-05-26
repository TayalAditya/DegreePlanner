# PlanMyDegree

Degree planner for IIT Mandi students. Tracks credits, timetable, MTP/ISTP eligibility, semester exchange courses, and internship credits without juggling four portals and a spreadsheet.

Live at **[planmydegree.app](https://planmydegree.app)**

---

## Supported Batches

| Batch | Branches |
|---|---|
| B22 | CSE |
| B23 | All branches |
| B24 | CSE, DSE, EE, MEVLSI, MSE, BioE, CE |
| B25 | All branches |

Sign in with your institute Google account (`@students.iitmandi.ac.in`).

---

## Features

**Credit tracking:** auto-calculates IC, IC Basket, DC, DE, FE, HSS, IKS, MTP, and ISTP credits from your enrollments. Shows real-time MTP and ISTP eligibility, P/F credit usage against the 9-credit cap, and internship credits (XX-399P / XX-396P) correctly routed as FE.

**Courses:** add courses semester-wise, set grades and enrollment status, and get recommendations based on what's still pending. Includes semester exchange courses for TU Munich, TU Darmstadt, and others. Bulk enrollment via the Import Courses page.

**Programs:** tracks degree requirements per branch, shows how far along you are in each credit category, and flags when you hit ISTP or MTP eligibility. Pre-registration banner shows up when registration is approaching.

**Timetable:** weekly schedule with venue and timing. Detects conflicts before you finalize.

**Academics:** reference page covering the credits policy, exchange programs, internships, honours, and minors. Saves the back-and-forth with the academic section.

**Documents:** upload and organize forms, certificates, and transcripts.

Works on mobile, installable as a PWA, and has offline support. Dark and light modes with 4 colour themes.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (Google OAuth) |
| Data Fetching | TanStack React Query |
| Charts | Recharts |

---

## Running Locally

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```
DATABASE_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

Then:

```bash
npx prisma generate
npx prisma db push
npx prisma db seed   # optional — seeds programs and course data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  api/                route handlers (auth, courses, timetable, documents, ...)
  auth/               sign-in and error pages
  dashboard/
    courses/          semester-wise course management
    programs/         degree programs and credit requirements
    progress/         credit breakdown and charts
    timetable/        weekly schedule
    import-courses/   bulk enrollment
    academics/        exchange, internships, honours info
    documents/        forms and transcripts
    settings/         user preferences

components/           shared React components
lib/                  credit calculator, auth config, validation, utilities
prisma/               schema and seed scripts
public/               service worker, PWA manifest, static assets
```
