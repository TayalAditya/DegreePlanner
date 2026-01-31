# PlanMyDegree

A degree planning tool built for IIT Mandi students. Tracks credits, timetable, academic progress, MTP/ISTP eligibility, and more — all in one place.

Live at planmydegree.app

Currently available for UG Batch 23 and select branches of Batch 22 and Batch 24.

## Features

- Google OAuth authentication
- Semester-wise course management across all credit categories (IC, IC Basket, DC, DE, FE, HSS, IKS)
- Real-time credit calculation and progress tracking
- MTP and ISTP eligibility checking
- Weekly timetable with conflict detection and calendar export
- Shared timetables with batch
- Document management
- Mobile-responsive, PWA-ready, works offline
- Dark and light modes, 4 colour themes

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js with Google Provider
- **Data Fetching**: TanStack React Query
- **Visualizations**: Recharts

## Getting Started

1. Install dependencies:

npm install

2. Set up environment variables:

cp .env.example .env

3. Configure .env with your database URL and Google OAuth credentials

4. Set up the database:

npx prisma generate
npx prisma db push

5. Run the development server:

npm run dev

6. Open http://localhost:3000

## Project Structure

app/                    # Next.js App Router
├── api/               # API routes
├── auth/              # Authentication pages
├── dashboard/         # Main dashboard pages
└── layout.tsx
components/            # React components
lib/                   # Utility functions and business logic
prisma/                # Database schema and seed

## License

MIT
