# 🚀 Deployment Architecture Guide

## Overview

This guide covers deploying your Degree Planner application with a **split architecture**:

- **Frontend & API Routes**: Vercel (Next.js App Router)
- **Python Backend** (Optional): PythonAnywhere for heavy computations, PDF generation, data processing

---

## 📋 Table of Contents

1. [Current Architecture](#current-architecture)
2. [Deployment Option 1: Full Next.js on Vercel](#deployment-option-1-full-nextjs-on-vercel)
3. [Deployment Option 2: Split Architecture](#deployment-option-2-split-architecture)
4. [Database Setup](#database-setup)
5. [Environment Configuration](#environment-configuration)
6. [Deployment Steps](#deployment-steps)
7. [Post-Deployment](#post-deployment)

---

## Current Architecture

### ✅ What You Have (Monolithic Next.js)

```
┌─────────────────────────────────────────┐
│           Vercel Deployment             │
├─────────────────────────────────────────┤
│  Frontend (React Components)            │
│  ├── /app (Next.js App Router)          │
│  ├── /components (Reusable UI)          │
│  └── /public (Static assets)            │
├─────────────────────────────────────────┤
│  Backend (API Routes)                   │
│  ├── /app/api/* (TypeScript)            │
│  ├── Prisma ORM (Database access)       │
│  └── NextAuth (Authentication)          │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│      PostgreSQL Database                │
│  (Supabase / Railway / Neon)            │
└─────────────────────────────────────────┘
```

**Pros**: Simple, fast, serverless, great for 95% of use cases  
**Cons**: Serverless functions have 10s timeout, no persistent background jobs

---

## Deployment Option 1: Full Next.js on Vercel

### ✅ Recommended for Most Users

This is the **simplest** and **most cost-effective** approach. Your entire app runs on Vercel's serverless infrastructure.

### Prerequisites

- GitHub account
- Vercel account (free tier works great)
- PostgreSQL database (Supabase/Neon recommended)

### Step-by-Step Deployment

#### 1. **Prepare Your Repository**

```bash
# Ensure everything is committed
git add .
git commit -m "Production ready deployment"
git push origin main
```

#### 2. **Set Up Database**

**Option A: Supabase (Recommended)**

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy connection string from Settings → Database → Connection string
4. Format: `postgresql://postgres:[password]@[host]:5432/postgres?pgbouncer=true`

**Option B: Neon**

1. Go to [neon.tech](https://neon.tech)
2. Create new project
3. Copy Prisma-compatible connection string

**Option C: Railway**

1. Go to [railway.app](https://railway.app)
2. Create PostgreSQL database
3. Copy DATABASE_URL from connection details

#### 3. **Deploy to Vercel**

```bash
# Install Vercel CLI (optional but helpful)
npm i -g vercel

# Deploy
vercel --prod

# Or use Vercel dashboard:
# 1. Go to vercel.com/new
# 2. Import your GitHub repository
# 3. Configure as Next.js project
# 4. Add environment variables (see below)
# 5. Click Deploy
```

#### 4. **Configure Environment Variables in Vercel**

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

```env
# Database
DATABASE_URL=your-database-connection-string
DIRECT_URL=your-direct-connection-string # If using Supabase pgbouncer

# NextAuth
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Analytics & Monitoring
NEXT_PUBLIC_GA_ID=your-google-analytics-id
SENTRY_DSN=your-sentry-dsn
```

#### 5. **Initialize Database**

```bash
# Run migrations
npx prisma db push

# Seed initial data (optional)
npx prisma db seed
```

#### 6. **Verify Deployment**

Visit your Vercel URL and test:
- ✅ Authentication works
- ✅ Database connections are stable
- ✅ All API routes respond correctly

### Performance Optimizations

```typescript
// next.config.ts
const config = {
  experimental: {
    optimizePackageImports: ['@prisma/client', 'react-query'],
  },
  images: {
    domains: ['lh3.googleusercontent.com'], // For Google profile images
    formats: ['image/avif', 'image/webp'],
  },
  compress: true,
  poweredByHeader: false,
};
```

---

## Deployment Option 2: Split Architecture

### ⚡ When You Need This

Use this if you need:
- PDF generation (large reports, transcripts)
- Data analytics (complex computations)
- Background jobs (email sending, batch processing)
- Python-specific libraries (pandas, matplotlib, etc.)

### Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Next.js App Router                              │  │
│  │  - React Components                              │  │
│  │  - Client-side logic                             │  │
│  │  - Static pages                                  │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  API Routes (TypeScript)                         │  │
│  │  - Authentication (NextAuth)                     │  │
│  │  - CRUD operations (Prisma)                      │  │
│  │  - Simple business logic                         │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                          │
                          ▼
      ┌────────────────────────────────────────┐
      │      PostgreSQL Database               │
      │      (Supabase / Neon)                 │
      └────────────────────────────────────────┘
                          ▲
                          │
┌────────────────────────────────────────────────────────┐
│            Python Backend (PythonAnywhere)             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Flask / FastAPI Application                     │  │
│  │  - PDF generation (ReportLab)                    │  │
│  │  - Data analysis (pandas, numpy)                 │  │
│  │  - Email sending (SMTP)                          │  │
│  │  - Background tasks (Celery)                     │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Python Backend Setup (PythonAnywhere)

#### Directory Structure for Python Backend

```
degree-planner-backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI/Flask app
│   ├── config.py            # Configuration
│   ├── database.py          # Database connection
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── pdf.py           # PDF generation endpoints
│   │   ├── analytics.py     # Data analytics
│   │   └── batch.py         # Batch processing
│   ├── services/
│   │   ├── pdf_generator.py # PDF creation logic
│   │   ├── email_service.py # Email handling
│   │   └── analytics.py     # Data processing
│   └── utils/
│       ├── auth.py          # JWT verification
│       └── helpers.py       # Utility functions
├── requirements.txt
├── wsgi.py                  # WSGI entry point
└── README.md
```

#### Sample FastAPI Backend

```python
# app/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os

from .database import get_db
from .routes import pdf, analytics, batch
from .utils.auth import verify_token

app = FastAPI(title="Degree Planner Backend")

# CORS for Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-app.vercel.app",
        "http://localhost:3000",  # Development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "degree-planner-backend"}

# Include routers
app.include_router(pdf.router, prefix="/api/pdf", tags=["PDF"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(batch.router, prefix="/api/batch", tags=["Batch"])

# Sample PDF generation endpoint
from .routes.pdf import router as pdf_router

# app/routes/pdf.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import io

router = APIRouter()

@router.post("/generate-transcript")
async def generate_transcript(
    user_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(verify_token)
):
    """Generate academic transcript PDF"""
    
    # Fetch user data from database
    # ... database queries ...
    
    # Create PDF
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    
    # Add content
    pdf.drawString(100, 800, "Academic Transcript")
    # ... more PDF content ...
    
    pdf.save()
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=transcript.pdf"}
    )
```

#### PythonAnywhere Deployment

1. **Create Account**: Go to [pythonanywhere.com](https://pythonanywhere.com)

2. **Upload Code**:
   ```bash
   # On PythonAnywhere console
   git clone https://github.com/yourusername/degree-planner-backend.git
   cd degree-planner-backend
   ```

3. **Set Up Virtual Environment**:
   ```bash
   python3.10 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. **Configure Web App**:
   - Go to Web tab → Add new web app
   - Choose Manual configuration → Python 3.10
   - Set source code directory
   - Set working directory
   - Configure WSGI file

5. **WSGI Configuration**:
   ```python
   # /var/www/yourusername_pythonanywhere_com_wsgi.py
   import sys
   import os
   
   path = '/home/yourusername/degree-planner-backend'
   if path not in sys.path:
       sys.path.insert(0, path)
   
   os.environ['DATABASE_URL'] = 'your-database-url'
   os.environ['SECRET_KEY'] = 'your-secret-key'
   
   from app.main import app as application
   ```

6. **Environment Variables**:
   ```bash
   # In PythonAnywhere bash console
   echo 'export DATABASE_URL="postgresql://..."' >> ~/.bashrc
   echo 'export SECRET_KEY="..."' >> ~/.bashrc
   source ~/.bashrc
   ```

### Connecting Next.js to Python Backend

```typescript
// lib/python-backend.ts
const PYTHON_BACKEND_URL = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 
  'https://yourusername.pythonanywhere.com';

export async function generateTranscript(userId: string) {
  const response = await fetch(`${PYTHON_BACKEND_URL}/api/pdf/generate-transcript`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getSessionToken()}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to generate transcript');
  }
  
  const blob = await response.blob();
  return blob;
}

// Usage in Next.js API route
// app/api/transcript/route.ts
export async function POST(request: Request) {
  const { userId } = await request.json();
  
  // Call Python backend
  const pdfBlob = await generateTranscript(userId);
  
  return new Response(pdfBlob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=transcript.pdf',
    },
  });
}
```

---

## Database Setup

### Prisma Schema Updates

The schema already supports everything you need. Just ensure you push it to your database:

```bash
# Production database
npx prisma db push

# Generate Prisma Client
npx prisma generate

# (Optional) Seed initial data
npx prisma db seed
```

### Recommended Database Providers

| Provider | Free Tier | Best For | Pricing |
|----------|-----------|----------|---------|
| **Supabase** | 500MB, 2 CPU | Production, built-in auth | Free → $25/mo |
| **Neon** | 10GB, 1 branch | Serverless, auto-scaling | Free → $19/mo |
| **Railway** | $5 credit | Simple setup, MySQL/Postgres | Pay as you go |
| **PlanetScale** | 5GB | MySQL, branching | Free → $29/mo |

---

## Environment Configuration

### Required Environment Variables

```env
# ===== DATABASE =====
DATABASE_URL=postgresql://user:pass@host:5432/db
# For Supabase with connection pooling:
DIRECT_URL=postgresql://user:pass@host:5432/db?pgbouncer=true

# ===== AUTHENTICATION =====
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=generate-using-openssl-rand-base64-32

# Google OAuth (get from console.cloud.google.com)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# ===== OPTIONAL: PYTHON BACKEND =====
NEXT_PUBLIC_PYTHON_BACKEND_URL=https://yourusername.pythonanywhere.com

# ===== OPTIONAL: MONITORING =====
SENTRY_DSN=https://xxx@sentry.io/xxx
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# ===== OPTIONAL: EMAIL =====
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
```

---

## Deployment Steps

### Quick Deploy Checklist

- [ ] Push code to GitHub
- [ ] Set up database (Supabase/Neon)
- [ ] Configure environment variables in Vercel
- [ ] Deploy to Vercel
- [ ] Run `npx prisma db push`
- [ ] Test authentication flow
- [ ] Test all API routes
- [ ] (Optional) Deploy Python backend to PythonAnywhere
- [ ] Configure domain (optional)
- [ ] Set up monitoring (Sentry)
- [ ] Enable analytics (GA4)

---

## Post-Deployment

### Monitoring & Logs

```bash
# View Vercel logs
vercel logs --prod

# Check deployment status
vercel inspect [deployment-url]
```

### Performance Monitoring

- **Vercel Analytics**: Built-in, enable in dashboard
- **Sentry**: Error tracking, add DSN to env vars
- **Google Analytics**: User behavior tracking

### Database Maintenance

```bash
# Check database health (Supabase)
# Go to Supabase Dashboard → Database → Health

# Run migrations (when schema changes)
npx prisma migrate deploy

# Backup database (automated in Supabase/Neon)
```

### Continuous Deployment

Vercel automatically redeploys on:
- Push to `main` branch
- Pull request merges
- Manual trigger from dashboard

---

## Troubleshooting

### Common Issues

**Issue**: Database connection fails  
**Solution**: Check `DATABASE_URL` format, ensure IP is whitelisted

**Issue**: NextAuth redirect loop  
**Solution**: Verify `NEXTAUTH_URL` matches deployed URL exactly

**Issue**: Build fails on Vercel  
**Solution**: Check build logs, ensure all dependencies in `package.json`

**Issue**: API routes timeout  
**Solution**: Optimize queries, add indexes, consider caching

---

## Cost Breakdown

### Option 1: Full Next.js (Recommended)

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| Vercel | 100GB bandwidth | $20/mo (Pro) |
| Supabase | 500MB DB | $25/mo (Pro) |
| **Total** | **$0/mo** | **$45/mo** |

### Option 2: Split Architecture

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| Vercel | 100GB bandwidth | $20/mo |
| Supabase | 500MB DB | $25/mo |
| PythonAnywhere | Limited | $5-$12/mo |
| **Total** | **~$5/mo** | **$50-60/mo** |

---

## Recommendations

### ✅ Start with Option 1 (Full Next.js)

99% of degree planning features work perfectly on Vercel's serverless platform.

### 📈 Upgrade to Option 2 when you need:

- Heavy PDF generation (100+ page reports)
- Complex data analytics
- Background jobs (email campaigns)
- Python-specific ML/data processing

---

## Next Steps

1. **Deploy to Vercel** using Option 1
2. **Test thoroughly** with real users
3. **Monitor performance** and costs
4. **Add Python backend** only if needed

Your app is **production-ready** right now! 🚀
