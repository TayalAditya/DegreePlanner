# PlanMyDegree

A degree planning tool built for IIT Mandi students. One place for credits, timetable, academic progress, MTP/ISTP eligibility, and everything else that usually requires four portals and a spreadsheet.

Live at **[planmydegree.app](https://planmydegree.app)**

Currently available for UG Batch 23 and select branches of Batch 22 and Batch 24.

---

## Features

**Credit Tracking**
- Auto-calculates credits across IC, IC Basket, DC, DE, FE, HSS, IKS, MTP, and ISTP
- Real-time MTP and ISTP eligibility based on your enrollment history
- Visual progress breakdown by category

**Timetable**
- Weekly timetable with venue and timing
- Conflict detection before it becomes a problem
- Share your timetable with batchmates
- Export to calendar

**Courses**
- Semester-wise course management
- Smart recommendations based on pending requirements
- Tracks enrollment status, grades, and credit types

**Other**
- Document management (forms, certificates, transcripts)
- Mobile-responsive and PWA-ready — works offline
- Dark and light modes, 4 colour themes
- Google OAuth with institute email validation

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (Google Provider) |
| Data Fetching | TanStack React Query |
| Charts | Recharts |

---

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

Fill in `.env` with your database URL and Google OAuth credentials, then:

```bash
# Generate Prisma client and push schema
npx prisma generate
npx prisma db push

# Seed initial data (optional)
npx prisma db seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
app/
├── api/               # API routes (auth, courses, timetable, documents, etc.)
├── auth/              # Sign-in and error pages
├── dashboard/         # Protected pages (courses, progress, timetable, settings)
└── layout.tsx

components/            # Reusable React components
lib/                   # Business logic, credit calculator, validation, utils
prisma/                # Schema and seed data
public/                # Static assets, service worker, PWA manifest
```

---

## License

MIT
