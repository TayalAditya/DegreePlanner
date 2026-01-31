# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install tsx for running TypeScript scripts
```powershell
npm install
```

### 2. Set up your environment
```powershell
# Copy the example environment file
cp .env.example .env
```

**Edit `.env` and add your credentials:**
- PostgreSQL connection string
- Google OAuth Client ID & Secret
- NextAuth secret (generate with: `openssl rand -base64 32` or use any random string)

### 3. Initialize the database
```powershell
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Seed with sample data
npm run db:seed

# (Optional) Add approved users
npm run add-users
```

### 4. Start the development server
```powershell
npm run dev
```

Visit **http://localhost:3000** 🎉

---

## 📋 What You Get

### ✅ Features Implemented

**Authentication & Authorization**
- ✅ Google OAuth Sign-In
- ✅ User validation against approved list
- ✅ Email domain restrictions (optional)
- ✅ Protected routes and API endpoints

**Course Management**
- ✅ Semester-wise course tracking
- ✅ Core, DE, PE, and Free Elective categorization
- ✅ Course prerequisites validation
- ✅ Automatic course recommendations

**Program Tracking**
- ✅ Major program management
- ✅ Minor program support
- ✅ Credit overlap calculation
- ✅ Real-time progress tracking

**Credit Calculations**
- ✅ Per-category credit breakdown (Core, DE, PE)
- ✅ Automatic totals and remaining credits
- ✅ Percentage completion tracking
- ✅ MTP/ISTP eligibility checking

**Visualizations**
- ✅ Progress pie charts
- ✅ Credit breakdown cards
- ✅ MTP/ISTP status indicators
- ✅ Available DE courses list

**User Experience**
- ✅ Mobile-responsive design
- ✅ Print-friendly layouts (press Ctrl+P)
- ✅ Offline indicator
- ✅ Auto-retry on network errors
- ✅ Loading states and skeletons
- ✅ Error boundaries

---

## 🗂️ Project Structure

```
degree-planner/
├── app/
│   ├── api/              # Backend API routes
│   │   ├── auth/         # NextAuth endpoints
│   │   ├── enrollments/  # Course enrollments CRUD
│   │   ├── programs/     # Program management
│   │   └── progress/     # Credit calculations
│   ├── auth/             # Auth pages (sign-in, error)
│   ├── dashboard/        # Main dashboard pages
│   └── layout.tsx        # Root layout
├── components/           # React components
│   ├── DashboardNav.tsx
│   ├── DashboardOverview.tsx
│   ├── ProgressChart.tsx
│   └── ...
├── lib/                  # Utilities & configs
│   ├── auth.ts          # NextAuth configuration
│   ├── creditCalculator.ts  # Credit calculation engine
│   └── prisma.ts        # Prisma client
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Sample data
└── types/               # TypeScript types
```

---

## 📊 Database Schema

### Core Models

**User** - User accounts with Google OAuth
**Program** - Academic programs (Major/Minor)
**Course** - Course catalog
**CourseEnrollment** - Student course registrations
**UserProgram** - User's enrolled programs
**ApprovedUser** - Whitelist for sign-in validation

### Credit Tracking

- Core credits
- Discipline Electives (DE)
- Program Electives (PE)
- Free Electives
- MTP/ISTP credits

---

## 🔧 Configuration

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
6. Copy Client ID and Secret to `.env`

### Database Setup

**Local PostgreSQL:**
```env
DATABASE_URL="postgresql://username:password@localhost:5432/degree_planner"
```

**Cloud (e.g., Supabase, Neon):**
```env
DATABASE_URL="postgresql://user:pass@host.region.provider.com:5432/dbname"
```

### User Validation

**Option 1: Email Domain**
```env
ALLOWED_EMAIL_DOMAIN="@university.edu"
```

**Option 2: Approved User List**
Run `npm run add-users` and edit `scripts/add-users.ts`

---

## 🎯 Next Steps

### Add Your Data

1. **Update approved users** in `scripts/add-users.ts`
2. **Add your programs** via Prisma Studio (`npm run db:studio`)
3. **Import courses** from your institution's catalog
4. **Configure credit requirements** per program

### Customize

- Adjust MTP/ISTP rules in database
- Add more course types if needed
- Customize visualizations
- Add GPA tracking
- Export to PDF functionality

### Deploy

- Vercel (recommended for Next.js)
- Railway, Render, or any Node.js host
- Set up production database
- Configure production Google OAuth

---

## 📖 Available Scripts

```powershell
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

npm run db:generate  # Generate Prisma Client
npm run db:push      # Push schema to database
npm run db:seed      # Seed sample data
npm run db:studio    # Open Prisma Studio (database GUI)
npm run add-users    # Add approved users
```

---

## 🐛 Troubleshooting

**"Database connection failed"**
- Check PostgreSQL is running
- Verify DATABASE_URL in `.env`

**"Google OAuth error"**
- Check redirect URI matches exactly
- Verify Client ID and Secret

**"User not approved"**
- Add user to ApprovedUser table
- Or set ALLOWED_EMAIL_DOMAIN

**Build errors**
- Delete `.next` and `node_modules`
- Run `npm install` again

---

## 📞 Need Help?

- Check [SETUP.md](./SETUP.md) for detailed instructions
- Review [README.md](./README.md) for feature overview
- Open database with `npm run db:studio`

---

**Happy Planning! 🎓**
