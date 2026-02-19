# 📚 Official Curriculum Structure - Updated

## Overview

Your institution has **13 academic programs**:
- **12 B.Tech Programs** (160 credits each)
- **1 B.S. Program** (163 credits)

All programs follow a standardized credit structure with some branch-specific variations.

---

## 🎓 B.Tech Programs - Universal Structure

All B.Tech programs share this overall structure:

```
Total Credits: 160
├── Institute Core (IC):           60 credits (FIXED for all BTech)
├── Discipline Core (DC):          66 credits (base, varies by branch)
├── Discipline Electives (DE):     Variable (12-33 credits by branch)
├── Free Electives (FE):           22 credits (17 for EE only)
└── MTP + ISTP:                    12 credits (8 MTP + 4 ISTP)
    └── Total:                     160 credits
```

### Institute Core (IC) - 60 Credits (ALL BTech branches)

| Component | Credits |
|-----------|---------|
| IC Compulsory | 39 |
| IC Basket | 6 |
| HSS (Humanities & Social Sciences) | 12 |
| IKS (Indian Knowledge System) | 3 |
| **Total IC** | **60** |

### Terminal Projects - 12 Credits (ALL BTech branches)

| Component | Credits |
|-----------|---------|
| MTP (Major Technical Project) | 8 (includes MTP-1: 3, MTP-2: 5) |
| ISTP (Interactive Socio-Technical Practicum) | 4 |
| **Total MTP/ISTP** | **12** |

**Eligibility**: Minimum 90 credits completed, minimum 6th semester

---

## 📊 Branch-Specific Configurations

### 1. **CSE - Computer Science & Engineering**
```
DC: 38  |  DE: 28  |  FE: 22  |  Total: 160
```
Most balanced between DC and DE for flexible specialization.

### 2. **DSE - Data Science & Engineering**
```
DC: 33  |  DE: 33  |  FE: 22  |  Total: 160
```
Equal weight on core and electives for broad data science coverage.

### 3. **MEVLSI - Microelectronics & VLSI**
```
DC: 54  |  DE: 12  |  FE: 22  |  Total: 160
```
Highest DC - very specialized discipline with mandatory foundational courses.

### 4. **EE - Electrical Engineering** ⚠️ SPECIAL
```
DC: 52  |  DE: 20  |  FE: 17  |  Total: 160
```
**EXCEPTION**: FE = 17 (not 22 like others). Combined DC+DE = 72.

### 5. **MNC - Mathematics & Computing**
```
DC: 51  |  DE: 15  |  FE: 22  |  Total: 160
```
Heavy DC focus for mathematics foundation.

### 6. **CE - Civil Engineering**
```
DC: 49  |  DE: 17  |  FE: 22  |  Total: 160
```
Balanced core with practical electives.

### 7. **BE - Bioengineering**
```
DC: 42  |  DE: 24  |  FE: 22  |  Total: 160
```
More flexible with significant elective component.

### 8. **EP - Engineering Physics**
```
DC: 37  |  DE: 29  |  FE: 22  |  Total: 160
```
Lowest DC among BTech - emphasizes broad elective exploration.

### 9. **GE - General Engineering**
```
DC: 36  |  DE: 30  |  FE: 22  |  Total: 160
```
Most flexible - very broad foundation with emphasis on electives.

### 10. **ME - Mechanical Engineering**
```
DC: 50  |  DE: 16  |  FE: 22  |  Total: 160
```
Strong DC focus with limited electives.

### 11. **MSE - Materials Science & Engineering**
```
DC: 45  |  DE: 21  |  FE: 22  |  Total: 160
```
Moderate DC with balanced electives.

---

## 🎓 BS Program - Different Structure

### **BSCS - B.S. in Chemical Sciences**

```
Total Credits: 163 (not 160!)
├── Institute Core (IC):           52 credits (different from BTech!)
├── Discipline Core (DC):          82 credits (much higher)
├── Discipline Electives (DE):     24 credits
├── Free Electives (FE):           15 credits (lowest)
└── Research & Communication:      14 credits (instead of MTP/ISTP)
    └── Total:                     163 credits
```

### Institute Core for BS - 52 Credits

| Component | Credits |
|-----------|---------|
| IC Compulsory | 31 (lower than BTech's 39) |
| IC Basket | 6 |
| HSS | 12 |
| IKS | 3 |
| **Total IC** | **52** |

### Research & Communication - 14 Credits

| Component | Credits |
|-----------|---------|
| Research Projects | 14 |
| Communication Component | (included) |

**Note**: BS does NOT have MTP/ISTP requirements. Uses research projects instead.

---

## 📈 Comparison Table

| Metric | B.Tech (all) | BS-CS | EE Special |
|--------|----------|-------|-----------|
| **Total Credits** | 160 | 163 | 160 |
| **IC** | 60 | 52 | 60 |
| **DC** | 66 (base) | 82 | 52 |
| **DE** | 12-33 | 24 | 20 |
| **FE** | 22 | 15 | **17** |
| **Terminal** | 12 (MTP/ISTP) | 14 (Research) | 12 |
| **MTP/ISTP** | Required | N/A | Required |

---

## ⚙️ Implementation Details

### Credit Calculation Logic

**For B.Tech (general formula):**
```
Total = 160 credits
├── IC (fixed): 60
├── DC (branch-specific): varies
├── DE (branch-specific): varies
├── FE (usually 22, except EE=17): 22 or 17
└── MTP/ISTP (fixed): 12
```

**Special handling for EE:**
```
FE = 17 (not 22)
DC + DE combined = 72
Rest of calculation same
```

**For BS-CS:**
```
Total = 163 credits
├── IC (fixed): 52
├── DC (fixed): 82
├── DE (fixed): 24
├── FE (fixed): 15
└── Research (fixed): 14
```

### MTP/ISTP Skip Logic

When a student skips or completes MTP/ISTP, credits redistribute:
- **Skip ISTP (4 credits)**: +4 to Free Electives
- **Skip MTP (8 credits)**: +8 to Discipline Electives
- **Skip MTP-2 (5 credits)**: +5 to Discipline Electives

---

## 🔄 Database Schema Impact

The updated `lib/branches.ts` contains:
- **12 B.Tech branches** with individual DC/DE splits
- **1 BS-CS branch** with different IC and research requirement
- **Corrected credit allocations** for all branches
- **Special handling for EE** (FE=17, DC+DE=72)

All programs use:
- `icCredits`: Institute Core (60 for BTech, 52 for BS)
- `dcCredits`: Discipline Core (branch-specific)
- `deCredits`: Discipline Electives (branch-specific)
- `feCredits`: Free Electives (22 or 17 or 15)
- `mtpIstpCredits`: Terminal projects (12 for BTech, 14 for BS)

---

## ✅ Next Steps

1. **Update seed-programs.ts** to use these exact DC/DE values
2. **Update credit calculator** to handle IC as universal 60 (BTech) / 52 (BS)
3. **Update dashboard visualizations** to show IC separately
4. **Test MTP/ISTP skip logic** with new credit structure
5. **Validate BS program** doesn't require MTP eligibility checks

---

## 📝 Notes

- All B.Tech programs are 8 semesters (4 years)
- BS-CS is different: 163 credits with research focus
- EE is the ONLY exception to standard FE=22 rule
- IC is FIXED per program type (not variable per branch)
- MTP eligibility: 90+ credits, 6th semester minimum
- BS has no MTP eligibility - research projects instead

---

**Last Updated**: 2024
**Source**: Official Curriculum PDF
**Status**: ✅ Implemented in lib/branches.ts
