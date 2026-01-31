# Production Deployment Checklist

## 🚀 Pre-Deployment

### Code Quality
- [x] All TypeScript errors resolved
- [x] ESLint warnings addressed
- [x] Production build tested locally (`npm run build`)
- [x] Environment variables documented in `.env.example`
- [ ] Security audit completed (`npm audit`)
- [ ] Dependencies updated to latest stable versions

### Database
- [ ] Production database created (PostgreSQL)
- [ ] Database migrations applied (`npx prisma db push` or `npx prisma migrate deploy`)
- [ ] Database backups configured
- [ ] Connection pooling configured (PgBouncer recommended)
- [ ] Database indexes optimized
- [ ] Sample data seeded (optional)

### Authentication
- [ ] NextAuth secret generated and added to production env
- [ ] Google OAuth credentials created for production domain
- [ ] Authorized redirect URIs updated in Google Console
- [ ] Approved user list populated
- [ ] Session timeout configured

### Performance
- [ ] Image optimization enabled (Next.js Image component used)
- [ ] API routes use pagination for large datasets
- [ ] Database queries optimized with proper indexes
- [ ] Static assets compressed (Gzip/Brotli)
- [ ] CDN configured for static assets

### Security
- [ ] HTTPS enforced (automatic on Vercel)
- [ ] CORS configured properly
- [ ] Rate limiting enabled on API routes
- [ ] Input validation implemented
- [ ] XSS protection via DOMPurify
- [ ] SQL injection prevented (Prisma ORM)
- [ ] Sensitive data not logged
- [ ] Security headers configured

### Monitoring
- [ ] Error tracking setup (Sentry recommended)
- [ ] Analytics configured (Vercel Analytics or Google Analytics)
- [ ] Uptime monitoring (UptimeRobot, Pingdom)
- [ ] Performance monitoring (Web Vitals)
- [ ] Database query logging
- [ ] API endpoint logging

---

## 📋 Deployment Steps

### 1. Environment Variables (Vercel Dashboard)

Required variables:
```bash
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="generate-new-secret-for-production"
NEXTAUTH_URL="https://your-domain.vercel.app"
GOOGLE_CLIENT_ID="production-client-id"
GOOGLE_CLIENT_SECRET="production-secret"
NODE_ENV="production"
```

Optional:
```bash
NEXT_PUBLIC_GA_ID="GA-XXXXXXXXX"
SENTRY_DSN="https://..."
NEXT_PUBLIC_API_URL="https://your-api.com"
```

### 2. Build Configuration

Verify `next.config.ts`:
```typescript
const nextConfig = {
  output: 'standalone', // For optimal Docker builds
  images: {
    domains: ['lh3.googleusercontent.com'], // Google profile images
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  // Enable production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};
```

### 3. Deploy to Vercel

**Method 1: Git Integration (Recommended)**
```bash
# Push to GitHub/GitLab/Bitbucket
git add .
git commit -m "Production ready deployment"
git push origin main

# Vercel will auto-deploy
```

**Method 2: Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
# ... add all other env vars
```

### 4. Post-Deployment Verification

- [ ] Visit deployed URL and verify homepage loads
- [ ] Test Google Sign-In with production OAuth
- [ ] Verify database connection (create test enrollment)
- [ ] Check API endpoints respond correctly
- [ ] Test mobile responsiveness
- [ ] Verify dark mode works
- [ ] Test PWA installation (Add to Home Screen)
- [ ] Check all navigation links
- [ ] Verify timetable creation
- [ ] Test document upload (admin)
- [ ] Check error pages (404, 500)

---

## 🔒 Security Hardening

### Headers Configuration

Add to `next.config.ts`:
```typescript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on'
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload'
        },
        {
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'Referrer-Policy',
          value: 'origin-when-cross-origin'
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()'
        }
      ]
    }
  ];
}
```

### Rate Limiting

Already implemented in `lib/rateLimit.ts`. To use:

```typescript
import { withRateLimit } from "@/lib/rateLimit";

export const GET = withRateLimit(async (req: Request) => {
  // Your handler logic
}, { windowMs: 60000, maxRequests: 100 });
```

---

## 📊 Monitoring Setup

### Sentry Integration

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Add to `.env`:
```bash
NEXT_PUBLIC_SENTRY_DSN="your-sentry-dsn"
```

### Vercel Analytics

```bash
npm install @vercel/analytics
```

Add to `app/layout.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Google Analytics 4

Add to `app/layout.tsx`:
```typescript
<Script
  src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
  strategy="afterInteractive"
/>
<Script id="google-analytics" strategy="afterInteractive">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
  `}
</Script>
```

---

## 🗄️ Database Optimization

### Connection Pooling (for Serverless)

Use PgBouncer or Prisma Data Proxy:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL") // For migrations
}
```

### Indexes

Add to `prisma/schema.prisma`:
```prisma
model User {
  email String @unique
  enrollmentId String? @unique
  
  @@index([email])
  @@index([enrollmentId])
}

model Course {
  code String @unique
  
  @@index([code])
  @@index([term])
}

model TimetableEntry {
  userId String
  dayOfWeek DayOfWeek
  
  @@index([userId])
  @@index([dayOfWeek])
}
```

---

## 🧪 Testing Before Production

### Manual Testing Checklist

- [ ] Sign in/out flow
- [ ] Create/edit/delete enrollment
- [ ] Add/edit/delete timetable entry
- [ ] Upload document (admin only)
- [ ] Change theme (light/dark/system)
- [ ] Select branch in settings
- [ ] View progress dashboard
- [ ] Check MTP/ISTP eligibility
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Test on desktop browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test offline mode (disable network)
- [ ] Test PWA installation

### Load Testing

Use tools like:
- Apache Bench (ab)
- k6
- Artillery

Example:
```bash
npx artillery quick --count 100 --num 10 https://your-app.vercel.app
```

---

## 📱 PWA Configuration

### Service Worker Registration

Add to `app/layout.tsx`:
```typescript
useEffect(() => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    navigator.serviceWorker.register('/sw.js');
  }
}, []);
```

### App Icons

Ensure these files exist in `/public`:
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)
- `apple-touch-icon.png` (180x180)
- `favicon.ico`

---

## 🔄 CI/CD Pipeline (Optional)

### GitHub Actions Example

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npx prisma validate
```

---

## 📞 Post-Launch

### Week 1
- [ ] Monitor error rates (Sentry)
- [ ] Check performance metrics (Vercel Analytics)
- [ ] Review user feedback
- [ ] Monitor database performance
- [ ] Check API response times

### Week 2-4
- [ ] Analyze user behavior (Google Analytics)
- [ ] Identify bottlenecks
- [ ] Optimize slow queries
- [ ] A/B test new features
- [ ] Collect user feedback

### Ongoing
- [ ] Weekly security updates
- [ ] Monthly dependency updates
- [ ] Quarterly performance reviews
- [ ] Regular database backups
- [ ] Continuous monitoring

---

## 🆘 Emergency Procedures

### Rollback Deployment

**Vercel:**
1. Go to Vercel Dashboard → Deployments
2. Find previous successful deployment
3. Click "..." → "Promote to Production"

**Database Migration Rollback:**
```bash
npx prisma migrate resolve --rolled-back <migration-name>
```

### Database Backup Restore

```bash
# PostgreSQL
pg_restore -d your_database backup_file.dump
```

### Emergency Contacts

Document:
- [ ] Database admin contact
- [ ] Domain registrar login
- [ ] Vercel account owner
- [ ] Google Cloud Console access
- [ ] Backup maintainer

---

## ✅ Launch Complete!

Your production-ready degree planner is now deployed with:

✅ Full authentication system
✅ Dark/light mode theming
✅ 12-branch support
✅ Timetable management
✅ Document management
✅ Mobile PWA support
✅ Error tracking
✅ Performance monitoring
✅ Security hardening
✅ Rate limiting
✅ Input validation
✅ Offline support

**Next Steps:**
1. Share the app with initial users
2. Gather feedback
3. Monitor metrics
4. Iterate and improve

🎉 Congratulations on launching your production application!
