# Database Failover & Load Balancing Guide

## 🎯 Quick Solutions

### Option 1: Simple Fallback (5 min setup) ⚡
**Cost:** FREE (use 2 free tier DBs)

**Setup:**
```env
# Primary DB (Neon)
DATABASE_URL="postgresql://neon-connection"

# Backup DB (Supabase or CockroachDB)
FALLBACK_DATABASE_URL="postgresql://supabase-connection"
```

**How it works:**
1. App tries Neon first
2. If Neon down → Auto switch to backup
3. Zero downtime for users

**Pros:** Simple, free, works immediately
**Cons:** Manual sync needed between DBs

---

### Option 2: Read Replicas (Better for scaling) 🚀
**Cost:** FREE on CockroachDB / $29/mo on Neon

**Setup:**
```typescript
// Use read replicas for SELECT queries
const READ_REPLICA = process.env.READ_REPLICA_URL;

// Writes → Primary
await prisma.user.create({...});

// Reads → Replica (faster, distributed)
const users = await prismaReplica.user.findMany();
```

**Pros:** Faster reads, load distribution
**Cons:** Need to manage 2 connections

---

### Option 3: Multi-Region Database (CockroachDB) 🌍
**Cost:** FREE tier includes multi-region

**How it works:**
- Automatic replication across regions
- Built-in failover (no code changes!)
- Data closer to users = faster

**Migration:**
```bash
# Export from Neon
pg_dump $NEON_URL > backup.sql

# Import to CockroachDB
psql $COCKROACH_URL < backup.sql

# Update Prisma
prisma db pull
prisma generate
```

**Pros:** Zero downtime, automatic failover
**Cons:** Initial migration effort

---

### Option 4: Connection Pooler + Multiple DBs 🎱

**PgBouncer setup:**
```yaml
# pgbouncer.ini
[databases]
mydb = host=neon-primary.com port=5432
mydb_fallback = host=supabase-backup.com port=5432

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

**Prisma config:**
```typescript
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## 🎁 Recommended Setup (Free Tier Combo)

**Primary:** Neon (512 MB, 100 compute hours)
**Backup:** Supabase (512 MB, unlimited requests)
**Total:** 1 GB storage, automatic fallback

**Setup Steps:**

1. **Create Supabase backup:**
```bash
# Create Supabase project
# Copy connection string
```

2. **Add to .env:**
```env
DATABASE_URL="postgresql://neon..."
FALLBACK_DATABASE_URL="postgresql://supabase..."
```

3. **Setup sync (optional):**
```typescript
// scripts/sync-databases.ts
import { PrismaClient as NeonClient } from '@prisma/client/neon';
import { PrismaClient as SupaClient } from '@prisma/client/supa';

const neon = new NeonClient({ datasourceUrl: process.env.DATABASE_URL });
const supa = new SupaClient({ datasourceUrl: process.env.FALLBACK_DATABASE_URL });

// Copy all data
const users = await neon.user.findMany();
await supa.user.createMany({ data: users });
```

4. **Use fallback client:**
```typescript
// Replace in your code:
import prisma from '@/lib/prisma-with-fallback';
```

---

## 💰 Cost Comparison

| Solution | Monthly Cost | Storage | Uptime |
|----------|--------------|---------|--------|
| Neon alone | FREE | 512 MB | 99.9% |
| Neon + Supabase fallback | FREE | 1 GB | 99.99% |
| CockroachDB multi-region | FREE | 5 GB | 99.99% |
| Railway (paid) | $5-10 | 1-2 GB | 99.95% |
| Oracle Cloud | FREE | 200 GB | 99.95% |

---

## 🚨 What to Monitor

```typescript
// scripts/health-check.ts
import prisma from '@/lib/prisma';

setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ DB healthy');
  } catch (error) {
    console.error('❌ DB down, sending alert...');
    // Send alert to Discord/Slack/Email
  }
}, 60000); // Check every minute
```

---

## 🎯 Which Option to Choose?

**For your college project:**
- **Now:** Stay with Neon (working fine, 2% usage)
- **When 100+ users:** Add Supabase fallback (5 min setup)
- **When 500+ users:** Migrate to CockroachDB (5 GB free + auto-failover)

**Want me to set up Option 1 (Simple Fallback) now?** Takes 5 minutes and gives instant redundancy! 🚀
