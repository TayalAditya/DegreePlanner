# Degree Planner

A robust, mobile-responsive degree planning application with Google Sign-In authentication, semester-wise course tracking, credit calculations, minor management, and MTP/ISTP eligibility tracking.

## Features

- 🔐 Google OAuth authentication with user validation
- 📚 Semester-wise course management (core, DE, PE, free electives)
- 📊 Real-time credit calculation for major and minor
- 🎯 MTP/ISTP eligibility checking
- 📈 Visual progress dashboards
- 📱 Mobile-responsive design
- 🖨️ Print-friendly layouts
- 💾 Auto-save and offline resilience
- ⚡ Optimized for slow internet connections

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js with Google Provider
- **Data Fetching**: TanStack React Query
- **Visualizations**: Recharts
- **Form Handling**: React Hook Form with Zod validation

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file with database and Google OAuth credentials

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
degree-planner/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Main dashboard
│   └── layout.tsx         # Root layout
├── components/            # React components
├── lib/                   # Utility functions
├── prisma/               # Database schema
└── types/                # TypeScript types
```

## License

MIT
