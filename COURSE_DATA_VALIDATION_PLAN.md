# Plan: Excel Course Data Extraction & Validation

## Overview
Extract and validate course information from Excel `Course List semester wise.xlsx` for semesters 1, 3, 4, 5, 6 to improve course accuracy in the planner.

---

## Phase 1: Data Extraction Strategy

### Step 1.1: Parse Excel File
**Input:** `docs/Course List semester wise.xlsx`
**Output:** JSON/CSV with extracted courses

```typescript
Extract from worksheets:
- Odd 2023-24 (semesters 1, 3, 5, 7)
- Even 2024-25 (semesters 2, 4, 6, 8)
- Even 2025-26 (semesters 2, 4, 6, 8)
```

**Data to Extract per Course Row:**
```json
{
  "courseCode": "CS-208",
  "courseName": "Mathematical Foundations of Computer Science",
  "credits": 4,
  "creditBreakdown": {
    "lecture": 3,
    "tutorial": 0,
    "practical": 2,
    "total": 4
  },
  "instructor": "Name1, Name2",
  "semester": 3,
  "offerings": {
    "BE": true/false,
    "CE": true/false,
    "CS": true/false,
    "DSE": true/false,
    "EE": true/false,
    "EP": true/false,
    "ME": true/false
  },
  "category": "C" // or "E", "IC", "DC"
}
```

### Step 1.2: Target Semesters
- **Sem 1**: Common IC courses (all branches)
- **Sem 3**: Branch-specific DC courses (BE, CE, CS, DSE, EE, EP, ME)
- **Sem 4**: Continuation of Sem 3
- **Sem 5**: Advanced branch courses
- **Sem 6**: Final DC + ISTP + Electives

---

## Phase 2: Course Code Validation

### Step 2.1: Code Format Standards
**Expected formats:**
- 2 letters + dash + 3 digits: `CS-208`, `BE-201`, `ME-210`
- 2 letters + 3 digits: `CS208`, `BE201`
- With suffix (P = Practicum): `IC-102P`, `ME-210P`
- Special: `DP-301P`, `DP-498P`, `DP-499P` (ISTP/MTP)

### Step 2.2: Validation Checklist
```
✓ Code is not empty
✓ Code matches pattern [A-Z]{2}-?\d{3}[P]?
✓ Code doesn't contain typos (IC- vs I-C-, etc.)
✓ Code is consistent across worksheets (same semester, same code)
✓ Code exists in current database or defaultCurriculum
```

### Step 2.3: Comparison Matrix
Create table comparing:
- Excel code vs. Database code vs. defaultCurriculum code
- Flag mismatches (e.g., "CS208" in Excel vs "CS-208" in DB)
- Identify missing courses in system

**Output Report:**
```
| Course Code | Excel | Database | Status | Action |
|---|---|---|---|---|
| CS-208 | ✓ | ✓ | Match | - |
| CE-2XX | ✗ | - | Invalid | Need proper code |
| BE-305 | ✓ | ✓ | Match | - |
```

---

## Phase 3: Course Name Validation & Spelling Check

### Step 3.1: Extract Course Names
From Excel column "Course Title"

### Step 3.2: Spelling Validation
```typescript
Check for:
1. Common typos (e.g., "Advacned" → "Advanced")
2. Inconsistent capitalization
3. Special characters (check encoding: é, ü, etc.)
4. Length (warn if > 100 characters)
5. Numbers in names (verify vs. database)
```

### Step 3.3: Comparison with System
Compare Excel names with:
- `defaultCurriculum.ts` course names
- Database course names
- Flag discrepancies

**Example Issues to Find:**
```
Excel: "Cell Biology"
DB: "Cell Biology"
Status: ✓ Match

Excel: "Advacned Hydrology Lab"
Expected: "Advanced Hydrology Lab"
Status: ⚠️ Typo detected
```

**Output Report:**
```
| Course Code | Excel Name | System Name | Match | Recommendation |
|---|---|---|---|---|
| BE-201 | Cell Biology | Cell Biology | ✓ | - |
| CE-XXYP | Advacned Hydrology Lab | Advanced Hydrology Lab | ⚠️ | Correct spelling |
```

---

## Phase 4: Instructor Name Extraction & Auto-Population

### Step 4.1: Extract Instructor Data
From Excel column "Instructor"
```
Raw formats found:
- "Dr. Amit Shukla"
- "Dr. Amit Shukla, Dr. Narendra K Dhar"
- "Prem Fleix Siril"
- "Biofac" (shared/multiple)
- "PK" (initials)
- "Harshad, Anand" (comma-separated)
```

### Step 4.2: Normalize Instructor Names
```typescript
Parse names into structured format:
{
  instructors: [
    { name: "Dr. Amit Shukla", department?: "Design" },
    { name: "Dr. Narendra K Dhar", department?: "Design" }
  ]
}
```

### Step 4.3: Instructor-Semester Mapping Strategy

**Current System Issue:** Instructors are NOT stored in database; hardcoded in course names

**Proposed Solution:**
1. Create new table: `CourseInstructor`
   ```sql
   CREATE TABLE CourseInstructor (
     id UUID,
     courseId UUID,
     semester INT,
     year INT,
     term STRING ('FALL' | 'SPRING'),
     instructorName STRING,
     instructorEmail STRING,
     isPrimary BOOLEAN,
     createdAt DateTime
   )
   ```

2. Map instructor to semester & year
   ```json
   {
     "courseCode": "CS-208",
     "instructors": [
       { "name": "Rohit Kumar", "semester": 3, "year": 2023 },
       { "name": "Pradeep Singh", "semester": 3, "year": 2024 }
     ]
   }
   ```

3. Auto-fetch in UI:
   ```
   When user views semester 3:
   - Query CourseInstructor table
   - Filter by courseId, semester, current year
   - Display instructor name in course details
   ```

### Step 4.4: Extraction Report
```
| Course | Semester | Instructor(s) | Status |
|---|---|---|---|
| CS-208 | 3 | Rohit Kumar | ✓ Found |
| BE-201 | 3 | Biofac (multiple) | ⚠️ Clarify |
| IC-181 | 1 | Prof. Laxmidhar Behera | ✓ Found |
```

---

## Phase 5: Credit Verification

### Step 5.1: Parse L-T-P-C Format
Excel column: "Credits L-T-P-C"
```
Example: "3-0-2-4"
Parse to:
{
  lecture: 3,
  tutorial: 0,
  practical: 2,
  totalCredits: 4
}
```

### Step 5.2: Verify Credit Calculation
Standard formula: **L + 0.5×T + P = Total**

But IIT Mandi seems to use: **Total as explicitly stated**

**Validation:**
```typescript
// Check if stated total matches formula
const calculated = L + (T * 0.5) + P;
const stated = C;

if (Math.abs(calculated - stated) > 0.5) {
  flagDiscrepancy(courseCode, calculated, stated);
}
```

### Step 5.3: Compare with System
Cross-check Excel credits vs. database credits

**Example Discrepancies:**
```
| Course | Excel (L-T-P-C) | Excel Total | DB Total | Status |
|---|---|---|---|---|
| CS-208 | 3-0-2-4 | 4 | 4 | ✓ Match |
| BE-201 | 3-0-2-4 | 4 | 4 | ✓ Match |
| IC-102P | 1-0-6-4 | 4 | 4 | ✓ Match |
| DP-301P | - | 4 (Excel) | 3 (DB) | ❌ MISMATCH |
```

### Step 5.4: Credit Report
Generate comprehensive credit verification:
```
Total Courses Checked: 243
✓ Credits Match: 235
❌ Credits Mismatch: 8
⚠️ Missing Credits Field: 0
```

---

## Phase 6: Semester-Wise Course Grouping

### Step 6.1: Organize by Semester
```
Semester 1:
├── IC-102P (Foundations of Design Practicum) - 4 cr
├── IC-152 (Python and Data Science) - 4 cr
├── IC-181 (Consciousness and Wellbeing) - 3 cr
├── IC-131 or IC-136 or IC-230 (IC Basket-1)
└── ... more courses

Semester 3:
├── CS (Computer Science):
│   ├── CS-208 (Math Foundations of CS) - 4 cr
│   ├── CS-214 (Computer Organization) - 4 cr
│   └── ...
├── DSE (Data Science):
│   ├── DS-201 (Data Handling) - 3 cr
│   └── ...
└── ... (other branches)

Semester 4:
├── CS:
│   ├── CS-304 (Formal Languages) - 3 cr
│   └── ...
└── ...

Semester 5:
└── (Similar structure)

Semester 6:
├── DC courses + ISTP (DP-301P)
└── ...
```

---

## Phase 7: Implementation Steps

### Step 7.1: Create Extraction Script
**File:** `scripts/extract-excel-courses.ts`
```typescript
// Parse Excel workbook
// Extract courses for semesters 1, 3, 4, 5, 6
// Output: JSON file with normalized data
// Run: npx ts-node scripts/extract-excel-courses.ts
```

**Output:** `extracted-courses.json`
```json
{
  "extractedAt": "2026-02-27T...",
  "totalCourses": 243,
  "bySemester": {
    "1": [...],
    "3": [...],
    "4": [...],
    "5": [...],
    "6": [...]
  },
  "validationReport": {...}
}
```

### Step 7.2: Create Validation Script
**File:** `scripts/validate-courses.ts`
```typescript
// Compare extracted courses with system
// Generate validation report
// Flag discrepancies: codes, names, credits, instructors
// Output: HTML/JSON report
```

**Output:** `course-validation-report.html`
- Color-coded (✓ green, ⚠️ yellow, ❌ red)
- Section-wise breakdown
- Actionable recommendations

### Step 7.3: Create Migration Script
**File:** `scripts/migrate-courses-from-excel.ts`
```typescript
// For courses needing updates:
// 1. Update course codes (if changed)
// 2. Update course names (if spelling wrong)
// 3. Update credits (if incorrect)
// 4. Add instructor records
// 5. Verify branch mappings
// Run: npx ts-node scripts/migrate-courses-from-excel.ts --dry-run
```

### Step 7.4: Update Database Schema
**If not exists:** Add instructor tracking
```prisma
model CourseInstructor {
  id          String    @id @default(cuid())
  courseId    String
  course      Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  instructorName String
  semester    Int       // 1-8
  year        Int       // 2023, 2024, 2025
  term        String    // "FALL" or "SPRING"
  isPrimary   Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([courseId, semester, year, term])
  @@index([courseId])
  @@index([semester])
}
```

### Step 7.5: Update UI to Show Instructors
**File:** `components/CourseCard.tsx` or `app/dashboard/courses/page.tsx`
```typescript
// For each course, fetch instructor from CourseInstructor table
// Filter by: semester, current_year, term (FALL/SPRING)
// Display: "Instructor: Dr. Amit Shukla" in course card
```

---

## Phase 8: Validation Checklist

### Before Migration
- [ ] Extract script runs without errors
- [ ] Validation report generated (all discrepancies identified)
- [ ] Course codes verified (no typos)
- [ ] Course names spell-checked
- [ ] Credit calculations verified
- [ ] Instructor list extracted and normalized
- [ ] Database schema updated (if adding CourseInstructor table)

### After Migration
- [ ] All 243 courses processed
- [ ] ✓ Codes match across Excel & DB
- [ ] ✓ Names are correct (no misspellings)
- [ ] ✓ Credits are accurate
- [ ] ✓ Instructors assigned to courses per semester
- [ ] ✓ Dashboard shows instructor names
- [ ] ✓ No data loss
- [ ] ✓ Backwards compatibility maintained

---

## Phase 9: Deliverables

### 1. Extraction Report
- List of all 243 courses with extracted data
- Format: JSON, CSV, or HTML table

### 2. Validation Report
- Code validation (format, duplicates, typos)
- Name validation (spelling, encoding)
- Credit validation (calculation accuracy)
- Instructor validation (parsing, normalization)
- Status for each course (✓ OK, ⚠️ Warning, ❌ Error)

### 3. Migration Plan Document
- Step-by-step instructions
- Risk assessment
- Rollback procedures
- Timeline estimate

### 4. Updated Data
- Corrected course codes
- Fixed course names
- Verified credits
- Instructor assignments per semester

### 5. Code & Scripts
- `extract-excel-courses.ts` - Extraction script
- `validate-courses.ts` - Validation script
- `migrate-courses.ts` - Migration script
- Schema updates (if needed)
- UI updates for instructor display

---

## Estimated Timeline

| Phase | Task | Time |
|---|---|---|
| 1 | Excel parsing | 1-2 hours |
| 2 | Code validation | 1 hour |
| 3 | Name validation | 1 hour |
| 4 | Instructor extraction | 2 hours |
| 5 | Credit verification | 1 hour |
| 6 | Course grouping | 1 hour |
| 7 | Script creation | 3-4 hours |
| 8 | Testing & validation | 2-3 hours |
| 9 | Documentation | 1-2 hours |
| **Total** | | **13-17 hours** |

---

## Success Criteria

✅ All course codes verified as correct
✅ All course names spelled correctly
✅ All credits validated (L-T-P-C calculation correct)
✅ All instructors extracted and assigned to semesters
✅ System auto-fetches instructor names per semester
✅ Validation report shows 100% accuracy (or documented exceptions)
✅ Zero data loss during migration
✅ UI displays instructor information
✅ Dashboard shows complete, accurate course data

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Excel data inconsistency | Wrong course data | Validate every field |
| Instructor name variations | Duplicate records | Normalize names first |
| Credit formula differs per course | Incorrect totals | Document all variations |
| Database constraint violations | Migration fails | Use dry-run first |
| UI breaks due to new data | User experience issue | Test all course views |

---

## Notes

- Excel file is SOURCE OF TRUTH for instructor names per semester
- Current `defaultCurriculum.ts` is incomplete (lacks instructors)
- Database needs enhancement to store instructor-semester mapping
- Bulk import feature should validate against this Excel data
