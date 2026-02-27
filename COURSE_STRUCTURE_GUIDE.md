# Course List Structure - Semester Wise Understanding

## Overview
The degree planner organizes courses by **semester** and **branch**. Each branch has a predefined curriculum spread across 8 semesters, with each semester containing courses from different categories.

---

## Course Categories

### 1. **IC (Integrated Core)** - Common to All Branches
Core courses taken by all BTech students
- **Sem 1-2**: Foundational courses (Math, Physics, Computing)
- **Sem 3+**: Advanced IC courses (Design, ML, etc.)

**Examples:**
- IC112: Calculus (Sem 1, 2 cr)
- IC152: Computing and Data Science (Sem 1, 4 cr)
- IC272: Machine Learning (Sem 3, 3 cr)

### 2. **ICB (IC Basket)** - Choose One from Each Batch
Students pick ONE from each group:

**IC-I (Sem 1 - Pick One):**
- IC131: Applied Chemistry for Engineers (3 cr)
- IC136: Understanding Biotechnology (3 cr)
- IC230: Environmental Science (3 cr)

**IC-II (Sem 2 - Pick One):**
- IC121: Mechanics of Particles and Waves (3 cr)
- IC240: Mechanics of Rigid Bodies (3 cr)
- IC241: Material Science for Engineers (3 cr)
- IC253: Data Structures and Algorithms (3 cr)

### 3. **DC (Discipline Core)** - Branch Specific
Core courses for each branch. Credits vary by branch:
- **CSE**: 38 credits
- **DSE**: 33 credits
- **EE**: 52 credits
- **ME**: 50 credits
- **CE**: 49 credits

**Example (CSE):**
```
Sem 3: CS208, CS214, CS212, CS213
Sem 4: CS304, CS309
Sem 5: CS313, CS312, CS305
Sem 6: CS302, CS303
```

### 4. **DE (Discipline Electives)** - Free Choice
Students choose DE courses from their discipline. Credits vary.

### 5. **FE (Free Electives)** - Any Course
Can take any elective courses. Eligible for Pass/Fail grading (max 9 credits).

### 6. **HSS (Humanities & Social Sciences)**
Mandatory HSS courses for degree completion.

### 7. **IKS (Indian Knowledge Systems)**
IC181 - Indian Knowledge Systems (3 cr, Sem 1-2)

### 8. **MTP (Major Technical Project)**
- **DP 498P**: MTP-1 (Sem 7, 3 cr)
- **DP 499P**: MTP-2 (Sem 8, 5 cr)
- **Total**: 8 credits

### 9. **ISTP (Interdisciplinary Socio-Technical Practicum)**
- **DP 301P**: ISTP (Sem 6, 4 cr, mandatory)

---

## Semester Structure by Branch

### CSE (Computer Science Engineering)
```
Sem 1: IC comp + IC mixed + IC-I basket + IC core
Sem 2: IC comp + IC mixed + IC-II basket + IC core
Sem 3: IC core (IC202P, IC272) + CS DC courses
Sem 4: CS DC courses
Sem 5: CS DC courses
Sem 6: CS DC courses + ISTP (DP 301P)
Sem 7: MTP-1 (DP 498P)
Sem 8: MTP-2 (DP 499P)
```

**Branch-Specific Pattern:**
- **DS-xxx courses** → Classified as DE for CSE students

### DSE (Data Science Engineering)
```
Sem 1: IC comp + IC mixed + IC-I basket + IC core
Sem 2: IC comp + IC mixed + IC-II basket + IC core
Sem 3: IC core (IC202P, IC272) + DS DC courses
Sem 4: DS DC courses
Sem 5: DS DC courses
Sem 6: DS DC courses + ISTP (DP 301P)
Sem 7: MTP-1 (DP 498P)
Sem 8: MTP-2 (DP 499P)
```

**Branch-Specific Pattern:**
- **CS-xxx courses** → Classified as DE for DSE students

### EE, ME, CE
Similar structure with branch-specific DC courses for Sem 3-6.

---

## Course Display on Dashboard

### My Enrollments Tab
Courses are grouped **by semester** with:
- Semester header showing: `Semester X` with `count courses` and `total credits`
- Each course card displays:
  - Course code (e.g., CS208)
  - Credits badge
  - Status (COMPLETED or IN_PROGRESS)
  - Course name
  - Term & year (FALL/SPRING YYYY)
  - Department

```
Semester 1
├── IC112 (2 Cr) [COMPLETED]
├── IC113 (2 Cr) [COMPLETED]
├── IC152 (4 Cr) [COMPLETED]
├── IC140 (4 Cr) [COMPLETED]
├── IC102P (4 Cr) [COMPLETED]
├── IC181 (3 Cr) [COMPLETED]
└── IC131 (3 Cr) [COMPLETED]

Semester 2
├── IC161 (3 Cr) [COMPLETED]
├── IC114 (2 Cr) [COMPLETED]
└── ...
```

### Catalog Tab
Courses available to add, filtered by:
- Code pattern: `AA-123` format
- Exceptions: `DP301P`, `DP498P`, `DP499P` (special ISTP/MTP codes)
- Search query (code or name)
- Department filter

---

## Credit Calculations

### Credit Requirements (160 Total)
- **IC**: 54 credits (fixed)
- **DC**: Varies by branch (33-52 credits)
- **DE**: Remaining credits
- **FE**: Up to 9 credits (with pass/fail option)
- **HSS**: ~12 credits
- **IKS**: 3 credits
- **MTP**: 8 credits (DP 498P: 3, DP 499P: 5)
- **ISTP**: 4 credits (DP 301P)

### Credit Accumulation Display

**Dashboard Ring Chart** shows percentage complete:
```
{completed}/{required} credits
Categories shown:
- IC (Blue)
- IC_BASKET (Cyan)
- DC (Purple)
- DE (Pink)
- FE (Green)
- HSS (Orange)
- IKS (Amber)
- MTP (Red)
- ISTP (Teal)
```

---

## Course Categorization Logic

The system determines a course's category using this priority:

1. **Branch Mappings** (from database)
   - Look for mapping matching user's branch
   - Falls back to generic GE mappings if needed

2. **IC Basket Codes** (explicit check)
   - IC131, IC136, IC230 → IC_BASKET
   - IC121, IC240, IC241, IC253 → IC_BASKET

3. **Branch-Specific Patterns**
   - CSE: DS-xxx → DE
   - DSE: CS-xxx → DE

4. **Code Pattern Analysis**
   - Starts with `IC` → IC
   - Starts with `HS` → HSS
   - Starts with `IKS` or `IK` → IKS
   - Contains `MTP` → MTP
   - Contains `ISTP` → ISTP
   - IC181 → IKS (special case)

5. **Fallback to courseType**
   - DE → DE
   - FREE_ELECTIVE, PE → FE
   - MTP → MTP
   - ISTP → ISTP
   - CORE → DC

---

## Adding Courses

When adding a course via the catalog:

**Required Fields:**
- Course selection
- Semester (1-8)
- Grade (optional)
- Course Type (AUTO-detect by default)

**Auto-Detection:**
- Checks if course is in HSS → type: HSS
- Checks if in FE list → type: FE
- Checks IC basket codes → type: IC
- Checks if contains "MTP" → type: MTP
- Checks if contains "ISTP" → type: ISTP
- Default → type: CORE

**Pass/Fail Option:**
- Available only for FREE_ELECTIVE courses
- Max 9 credits total
- Tracks used credits in user settings

---

## Special Cases

### IC Basket Selection in CSE
For CSE students, IC basket courses show differently in progress page:
- IC-II courses (IC121, IC240, IC241, IC253) taken **before Sem 4** → FE
- IC-I courses (IC131, IC136, IC230) taken **before Sem 5** → FE
- Otherwise → IC_BASKET

### Code Format Handling
The system accepts multiple code formats:
- `DP-301P` (standard)
- `DP 301P` (with space)
- `DP301P` (no separator)

All are normalized to match database entries.

---

## Semester-Wise Display in Dashboard

### DashboardOverview Component
Shows **semester cards** with breakdown:
```
Semester 1: 21 credits
├── IC: 6 cr
├── DC: 0 cr
├── DE: 0 cr
├── FE: 0 cr
├── HSS: 0 cr
├── IKS: 3 cr
├── MTP: 0 cr
└── ISTP: 0 cr
```

Semester cards are:
- Grouped by semester (1-8)
- Sorted in ascending order
- Show total credits
- Show category breakdown (IC/DC/DE/FE/HSS/IKS/MTP/ISTP)
- Responsive grid layout

---

## Files Involved

- **lib/defaultCurriculum.ts** - Course definitions by branch and semester
- **app/dashboard/courses/page.tsx** - Courses tab with My Enrollments & Catalog
- **components/ProgressChart.tsx** - Ring chart showing category breakdown
- **components/DashboardOverview.tsx** - Semester-wise cards with breakdown
- **app/dashboard/progress/page.tsx** - Detailed progress tracking by category
- **app/api/courses/route.ts** - Course listing with filtering
- **app/api/enrollments/route.ts** - Enrollment management
