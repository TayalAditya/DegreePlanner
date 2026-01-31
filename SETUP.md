# Degree Planner - Setup Instructions

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running (local or cloud)
- Google OAuth credentials

## Step 1: Install Dependencies

```powershell
npm install
```

## Step 2: Configure Environment Variables

Create a `.env` file in the root directory:

```powershell
cp .env.example .env
```

Edit `.env` and configure:

1. **Database URL** - Update with your PostgreSQL connection string:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/degree_planner"
   ```

2. **NextAuth Secret** - Generate a secret:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Add the output to `.env`:
   ```
   NEXTAUTH_SECRET="your-generated-secret"
   ```

3. **Google OAuth** - Get credentials from https://console.cloud.google.com:
   - Create a new project
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Copy Client ID and Secret to `.env`

## Step 3: Initialize Database

```powershell
# Generate Prisma Client
npx prisma generate

# Create database schema
npx prisma db push

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

## Step 4: Seed Initial Data (Optional)

You can add approved users directly to the database:

```sql
INSERT INTO "ApprovedUser" (id, email, "enrollmentId", name, department, batch, "allowedPrograms", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'your-email@university.edu',
  'ENR001',
  'Your Name',
  'Computer Science',
  2024,
  ARRAY['CS-MAJOR'],
  NOW(),
  NOW()
);
```

## Step 5: Run Development Server

```powershell
npm run dev
```

Visit http://localhost:3000

## Features Implemented

✅ Google OAuth authentication with user validation  
✅ Semester-wise course tracking  
✅ Major and Minor program management  
✅ Real-time credit calculations  
✅ MTP/ISTP eligibility checking  
✅ Discipline Elective (DE) recommendations  
✅ Visual progress dashboards with charts  
✅ Mobile-responsive design  
✅ Print-friendly layouts  
✅ Offline resilience with React Query  
✅ Auto-save functionality  

## Next Steps

1. **Add Programs** - Create major/minor programs in the database
2. **Add Courses** - Populate course catalog
3. **Configure User Validation** - Add approved users or set email domain restriction
4. **Customize Credit Rules** - Adjust MTP/ISTP requirements per program

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify DATABASE_URL in `.env`
- Check firewall settings

### Google OAuth Issues
- Verify redirect URI matches exactly
- Ensure OAuth consent screen is configured
- Check Client ID and Secret are correct

### Build Errors
- Delete `node_modules` and `.next` folders
- Run `npm install` again
- Check Node.js version (18+)

## Production Deployment

Before deploying:

1. Set up production PostgreSQL database
2. Update environment variables
3. Run database migrations: `npx prisma migrate deploy`
4. Build the application: `npm run build`
5. Configure Google OAuth for production domain

## Support

For issues or questions, refer to:
- Next.js docs: https://nextjs.org/docs
- Prisma docs: https://www.prisma.io/docs
- NextAuth.js docs: https://next-auth.js.org
