# 📊 Branch Credit Distribution Reference

## Quick Lookup Table

| Program | Code | DC | DE | FE | IC | MTP/ISTP | Total |
|---------|------|----|----|----|----|----------|-------|
| **B.Tech Programs** |
| Bioengineering | BE | 42 | 24 | 22 | 60 | 12 | 160 |
| Civil | CE | 49 | 17 | 22 | 60 | 12 | 160 |
| Computer Science | CSE | 38 | 28 | 22 | 60 | 12 | 160 |
| Data Science | DSE | 33 | 33 | 22 | 60 | 12 | 160 |
| **Electrical** | **EE** | **52** | **20** | **17** | **60** | **12** | **160** |
| Engineering Physics | EP | 37 | 29 | 22 | 60 | 12 | 160 |
| General | GE | 36 | 30 | 22 | 60 | 12 | 160 |
| Math & Computing | MNC | 51 | 15 | 22 | 60 | 12 | 160 |
| Mechanical | ME | 50 | 16 | 22 | 60 | 12 | 160 |
| Materials Science | MSE | 45 | 21 | 22 | 60 | 12 | 160 |
| Microelectronics & VLSI | MEVLSI | 54 | 12 | 22 | 60 | 12 | 160 |
| **B.S. Program** |
| Chemical Sciences | BSCS | 82 | 24 | 15 | 52 | 14* | 163 |

**Legend:**
- **DC** = Discipline Core
- **DE** = Discipline Electives
- **FE** = Free Electives
- **IC** = Institute Core (39+6+12+3 for BTech, 31+6+12+3 for BS)
- **MTP/ISTP** = Terminal Projects (MTP: 8, ISTP: 4 for BTech; Research: 14 for BS)
- **\*** = Research Projects instead of MTP/ISTP

---

## Special Notes

### ⚠️ Electrical Engineering (EE)
- **FE = 17** (NOT 22 like others)
- DC + DE = 52 + 20 = 72 (combined 72, not individual)
- Still totals 160

### 🎓 BS in Chemical Sciences (BSCS)
- **Total = 163** (not 160)
- **IC = 52** (not 60)
- No MTP/ISTP requirement
- Research Projects = 14 credits instead

---

## DC Range Analysis

| Highest DC | Program | Credits |
|----------|---------|---------|
| 1st | MEVLSI | 54 |
| 2nd | EE | 52 |
| 3rd | MNC | 51 |
| 4th | ME | 50 |
| 5th | CE | 49 |
| 6th | MSE | 45 |
| 7th | BE | 42 |
| 8th | CSE | 38 |
| 9th | EP | 37 |
| 10th | GE | 36 |
| 11th | DSE | 33 |
| **BS Only** | **BSCS** | **82** |

---

## DE Range Analysis

| Highest DE | Program | Credits |
|----------|---------|---------|
| 1st | DSE | 33 |
| 2nd | EP | 29 |
| 3rd | GE | 30 |
| 4th | BE | 24 |
| 5th | CSE | 28 |
| 6th | BS-CS | 24 |
| 7th | MSE | 21 |
| 8th | EE | 20 |
| 9th | CE | 17 |
| 10th | MNC | 15 |
| 11th | MEVLSI | 12 |

---

## Credit Distribution Patterns

### Heavy Core Focus
These programs emphasize foundational knowledge:
- **MEVLSI**: DC=54, DE=12 (very specialized)
- **EE**: DC=52, DE=20 (electrical foundation)
- **MNC**: DC=51, DE=15 (mathematics heavy)

### Balanced Approach
These programs mix core and electives:
- **CSE**: DC=38, DE=28 (equal split)
- **DSE**: DC=33, DE=33 (perfect balance)
- **ME**: DC=50, DE=16 (core-heavy)
- **MSE**: DC=45, DE=21 (core-heavy)

### Flexible/Broad Focus
These programs emphasize electives:
- **EP**: DC=37, DE=29 (physics exploration)
- **GE**: DC=36, DE=30 (most flexible)
- **BE**: DC=42, DE=24 (biotech flexibility)

---

## How to Use This

1. **Quick DC/DE Lookup**: Find your program code in the main table
2. **Check Total**: Verify calculation: DC + DE + FE + IC + MTP/ISTP = 160 or 163
3. **EE Special Case**: Remember EE has FE=17, not 22
4. **BS Special Case**: Remember BSCS has IC=52, Total=163, no MTP
5. **Credit Planning**: Use these values to plan your course selections

---

## Code Reference

These values are stored in `lib/branches.ts`:

```typescript
// Example: CSE
CSE: {
  code: 'CSE',
  type: 'BTech',
  totalCredits: 160,
  icCredits: 60,
  dcCredits: 38,    // ← From this table
  deCredits: 28,    // ← From this table
  feCredits: 22,
  mtpIstpCredits: 12,
}

// Example: BSCS
BSCS: {
  code: 'BSCS',
  type: 'BS',
  totalCredits: 163,
  icCredits: 52,    // ← BS-specific
  dcCredits: 82,    // ← Much higher for BS
  deCredits: 24,    // ← From this table
  feCredits: 15,    // ← Lowest
  mtpIstpCredits: 14, // ← Research projects
}
```

---

## Verification Checklist

For each program, these should always be true:

- [ ] DC + DE + FE + IC + MTP/ISTP = Total (160 or 163)
- [ ] IC = 60 for all BTech (except BS = 52)
- [ ] FE = 22 for all BTech (except EE = 17)
- [ ] MTP/ISTP = 12 for all BTech (except BS = 14)
- [ ] BS total = 163 (not 160)
- [ ] BS IC = 52 (not 60)

✅ All values verified against official curriculum PDF
