# Setup Instructions - MUST READ

## ⚠️ Important: Database Setup Required

The application has **new database models** that need to be set up before the app will work:

### New Models Added:
1. **TimetableEntry** - For scheduling classes with venues
2. **Document** - For managing forms and documents
3. **User.branch** field - For branch selection

## 🚀 Quick Setup (5 Steps)

### Step 1: Create Environment File
```powershell
Copy-Item .env.example .env
```

Then edit `.env` and add your database connection:

```env
# Use a local PostgreSQL database or a hosted service
DATABASE_URL="postgresql://user:password@localhost:5432/degreeplanner"

# Generate this: https://generate-secret.vercel.app/32
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Get from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID="your-id"
GOOGLE_CLIENT_SECRET="your-secret"
```

### Step 2: Set Up Database

**Option A: Local PostgreSQL (Recommended for Development)**
```powershell
# Install PostgreSQL from: https://www.postgresql.org/download/windows/

# Create database
psql -U postgres
CREATE DATABASE degreeplanner;
\q
```

**Option B: Use a Free Cloud Database**
- [Supabase](https://supabase.com) - Free PostgreSQL (recommended)
- [Neon](https://neon.tech) - Free serverless PostgreSQL
- [Railway](https://railway.app) - Free tier available

### Step 3: Push Database Schema
```powershell
npx prisma db push
```

This creates all the tables including:
- User (with `branch` field)
- TimetableEntry (for class schedules)
- Document (for forms/documents)
- Program, Course, CourseEnrollment
- ApprovedUser

### Step 4: Generate Prisma Client
```powershell
npx prisma generate
```

This generates TypeScript types for the new models and fixes all errors.

### Step 5: Run the App
```powershell
npm run dev
```

Visit: `http://localhost:3000`

---

## 📝 Current Errors Explained

You're seeing TypeScript errors like:
```
Property 'timetableEntry' does not exist on type 'PrismaClient'
Property 'document' does not exist on type 'PrismaClient'
Property 'branch' does not exist in type 'UserSelect'
```

**Why?** The Prisma Client hasn't been regenerated with the new schema.

**Solution:** Run `npx prisma generate` after setting up your database.

---

## 🗄️ Database Setup Options

### Local PostgreSQL (Windows)

1. **Download & Install**:
   - Go to: https://www.postgresql.org/download/windows/
   - Download installer
   - During installation, set a password for `postgres` user
   - Default port: 5432

2. **Create Database**:
   ```powershell
   # Open psql (PostgreSQL command line)
   psql -U postgres
   
   # Create database
   CREATE DATABASE degreeplanner;
   
   # Exit
   \q
   ```

3. **Update .env**:
   ```env
   DATABASE_URL="postgresql://postgres:your-password@localhost:5432/degreeplanner"
   ```

### Cloud Database (Supabase - Free)

1. **Sign Up**: https://supabase.com
2. **Create Project**: Choose free tier, set password
3. **Get Connection String**:
   - Go to Project Settings → Database
   - Copy "Connection string" (Transaction mode)
   - Replace `[YOUR-PASSWORD]` with your password
4. **Update .env**:
   ```env
   DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
   ```

### Cloud Database (Neon - Free)

1. **Sign Up**: https://neon.tech
2. **Create Project**: Free tier available
3. **Get Connection String**: Copy from dashboard
4. **Update .env**:
   ```env
   DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb"
   ```

---

## 🔑 Google OAuth Setup

1. **Go to**: https://console.cloud.google.com/apis/credentials
2. **Create OAuth 2.0 Client ID**:
   - Application type: Web application
   - Name: Degree Planner
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://your-domain.vercel.app/api/auth/callback/google` (for production)
3. **Copy credentials** to `.env`

---

## ✅ Verification Checklist

After setup, verify:

- [ ] `.env` file exists with all variables
- [ ] Database connection works (`npx prisma db push` succeeds)
- [ ] Prisma Client generated (`npx prisma generate` runs)
- [ ] No TypeScript errors (check VS Code problems panel)
- [ ] Dev server starts (`npm run dev`)
- [ ] Can access http://localhost:3000
- [ ] Google Sign-In works

---

## 🐛 Troubleshooting

### Error: `DATABASE_URL` not found
**Fix**: Create `.env` file in project root with `DATABASE_URL`

### Error: Connection refused
**Fix**: 
- Check PostgreSQL is running (Windows Services)
- Verify port 5432 is not blocked by firewall
- Test connection: `psql -U postgres -h localhost`

### Error: Role does not exist
**Fix**: Make sure username in `DATABASE_URL` exists in PostgreSQL

### Error: Google Sign-In fails
**Fix**:
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check redirect URI in Google Console matches `NEXTAUTH_URL`
- Clear browser cookies and try again

### Error: Prisma Client validation failed
**Fix**: Run `npx prisma generate` to regenerate client

### TypeScript errors persist
**Fix**:
1. Delete `node_modules/.prisma` folder
2. Run `npx prisma generate`
3. Restart VS Code TypeScript server (Cmd+Shift+P → "Restart TS Server")

---

## 📚 Database Schema Overview

### New Tables

**TimetableEntry**
- Stores class schedules with times and venues
- Fields: dayOfWeek, startTime, endTime, venue, roomNumber, building, classType, instructor

**Document**
- Stores academic documents and forms
- Fields: title, description, category, fileUrl, fileName, fileSize, isPublic

**User.branch** (new field)
- Stores user's academic branch (CSE, ECE, etc.)
- Used for branch-specific credit calculations

---

## 🎯 Next Steps After Setup

1. **Add Approved Users** (to allow sign-ins):
   ```sql
   INSERT INTO "ApprovedUser" (id, email, "createdAt", "updatedAt")
   VALUES (gen_random_uuid(), 'your.email@example.com', NOW(), NOW());
   ```

2. **Create Sample Program** (optional, for testing):
   ```sql
   INSERT INTO "Program" (id, name, code, type, "totalCredits", "dcCredits", "deCredits", "peCredits", "freeElectiveCredits", "createdAt", "updatedAt")
   VALUES (gen_random_uuid(), 'BTech Computer Science', 'CSE', 'BTech', 160, 96, 24, 0, 40, NOW(), NOW());
   ```

3. **Test Features**:
   - Sign in with approved email
   - Go to Settings → Select branch
   - Go to Timetable → Add a class
   - Go to Documents → View documents (admin can upload)

---

## 🚀 Production Deployment

When ready to deploy to Vercel:

1. **Set Environment Variables** in Vercel dashboard
2. **Use production database** (Supabase/Neon recommended)
3. **Update OAuth redirect URIs** in Google Console
4. **Run migrations** before first deployment

See `DEPLOYMENT.md` for detailed instructions.

---

## 📞 Support

If you encounter issues:

1. Check this file for solutions
2. Review `FIXES.md` for common errors
3. Check `NEW_FEATURES.md` for feature documentation
4. Inspect browser console for runtime errors
5. Check VS Code Problems panel for TypeScript errors

---

**Ready to start?** Run these 3 commands:

```powershell
# 1. Copy environment template
Copy-Item .env.example .env

# 2. Edit .env with your database URL and secrets
# (Use notepad or VS Code to edit the file)

# 3. Set up database and generate types
npx prisma db push
npx prisma generate

# 4. Start development server
npm run dev
```

Then visit: **http://localhost:3000** 🎉
