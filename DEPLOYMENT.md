# 🚀 Deployment Guide

## Frontend Deployment (Vercel)

### Prerequisites
- Vercel account
- GitHub repository with your code
- Environment variables configured

### Steps

1. **Push code to GitHub**
```powershell
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main
```

2. **Deploy to Vercel**
- Visit [vercel.com](https://vercel.com)
- Click "Import Project"
- Select your GitHub repository
- Configure environment variables:
  ```
  NEXTAUTH_URL=https://your-domain.vercel.app
  NEXTAUTH_SECRET=your-secret
  GOOGLE_CLIENT_ID=your-google-client-id
  GOOGLE_CLIENT_SECRET=your-google-client-secret
  DATABASE_URL=your-database-url
  ```
- Click "Deploy"

3. **Update Google OAuth**
- Add Vercel domain to Google OAuth redirect URIs:
  ```
  https://your-domain.vercel.app/api/auth/callback/google
  ```

### Environment Variables for Vercel

```env
# Database (use managed PostgreSQL like Supabase, Neon, or Railway)
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# NextAuth
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="generated-secret-key"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Optional
ALLOWED_EMAIL_DOMAIN="@university.edu"
```

---

## Backend API Deployment (PythonAnywhere)

### Option 1: Keep Next.js API Routes (Recommended)

Since Next.js handles both frontend and backend, you can deploy everything to Vercel. This is the **simplest approach**.

### Option 2: Separate Python Backend

If you need a separate Python backend for specific features:

#### Setup on PythonAnywhere

1. **Create Account**
- Sign up at [pythonanywhere.com](https://www.pythonanywhere.com)

2. **Create Virtual Environment**
```bash
mkvirtualenv --python=/usr/bin/python3.10 degreeplan
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-multipart
```

3. **Upload Python Backend Code**
- Use Git, SCP, or PythonAnywhere file manager
- Create backend directory structure

4. **Configure WSGI File**
```python
# /var/www/yourusername_pythonanywhere_com_wsgi.py
import sys
import os

path = '/home/yourusername/degree-planner-backend'
if path not in sys.path:
    sys.path.append(path)

from app.main import app as application
```

5. **Set Up Database**
- Use PostgreSQL from external provider (ElephantSQL, Supabase)
- Configure connection string in environment variables

### Backend Structure (if using separate Python API)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app
│   ├── models.py        # Database models
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── courses.py
│   │   ├── progress.py
│   │   └── timetable.py
│   ├── database.py
│   └── config.py
├── requirements.txt
└── README.md
```

### Example FastAPI Backend (if needed)

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import courses, progress, timetable

app = FastAPI(title="Degree Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(courses.router, prefix="/api/courses", tags=["courses"])
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(timetable.router, prefix="/api/timetable", tags=["timetable"])

@app.get("/")
def read_root():
    return {"message": "Degree Planner API"}
```

---

## Recommended Architecture

### Monolithic (Simplest - Recommended)
```
Frontend + API → Vercel
Database → Supabase/Neon (PostgreSQL)
```

**Pros:**
- Simpler deployment
- Single codebase
- No CORS issues
- Lower latency

**Cons:**
- Less flexible for scaling backend independently

### Separated (Advanced)
```
Frontend → Vercel (Next.js)
API → PythonAnywhere (Python/FastAPI)
Database → External PostgreSQL
```

**Pros:**
- Independent scaling
- Can use Python libraries
- Separate teams can work on frontend/backend

**Cons:**
- More complex setup
- CORS configuration needed
- Higher latency (extra network hop)

---

## Database Options

### Supabase (Recommended)
- Free tier: 500MB database
- Built-in auth (optional)
- Real-time features
- Direct connection string
- Setup: https://supabase.com

### Neon
- Free tier: 1 project, 3GB storage
- Serverless PostgreSQL
- Auto-scaling
- Setup: https://neon.tech

### Railway
- Free tier: $5 credit/month
- PostgreSQL included
- Easy deployment
- Setup: https://railway.app

---

## Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Database migrations run
- [ ] Sample data seeded (optional)
- [ ] Google OAuth configured with production URLs
- [ ] `.env` not committed to git
- [ ] Build succeeds locally (`npm run build`)

### Post-Deployment
- [ ] Test authentication flow
- [ ] Verify database connection
- [ ] Check all API endpoints
- [ ] Test mobile responsiveness
- [ ] Verify dark/light mode
- [ ] Test file uploads (if applicable)
- [ ] Monitor error logs

---

## Continuous Deployment

### Vercel
- Automatically deploys on git push to main branch
- Preview deployments for pull requests
- Environment variables preserved

### GitHub Actions (Optional)
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run build
      - run: npm test
```

---

## Monitoring & Logs

### Vercel
- Built-in logging
- Real-time function logs
- Analytics dashboard

### PythonAnywhere
- Error logs: `/var/log/yourusername.pythonanywhere.com.error.log`
- Server logs: `/var/log/yourusername.pythonanywhere.com.server.log`

---

## Cost Estimate

### Free Tier Setup
- **Vercel**: Free (Hobby plan)
- **Supabase/Neon**: Free tier
- **Total**: $0/month for small projects

### Paid Setup (for production)
- **Vercel Pro**: $20/month
- **Supabase Pro**: $25/month
- **Total**: ~$45/month

---

## Support

For deployment issues:
- Vercel: https://vercel.com/docs
- PythonAnywhere: https://help.pythonanywhere.com
- Supabase: https://supabase.com/docs
