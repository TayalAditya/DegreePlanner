# 🎓 New Features Added

## 1. Pass/Fail (P/F) Courses Support

### Rules
- **Total P/F Credits**: Max 9 credits (count towards Free Electives)
- **Per Semester**: Max 6 credits in any single semester
- **Eligibility**: Students can mark courses as P/F when enrolling

### Database Changes
- `CourseEnrollment.isPassFail`: Boolean flag to mark as P/F
- `CourseEnrollment.passFailCredits`: Store actual credits if P/F
- `User.totalPassFailCredits`: Track total P/F credits used
- `User.passFailPerSemester`: Track per-semester P/F credits
- `Course.isPassFailEligible`: Mark courses that can be taken P/F

### Validation
Use `canTakePassFailCourse()` from `lib/course-validation.ts` before enrollment.

---

## 2. Internship Support

### Types & Credits
- **Semester-long Remote Internship**: 6 credits (added to Free Electives)
- **Onsite Internship**: 9 credits (as P/F FE)
- **BS Program Special Rule**: 6-week internships = 0 credits (no credit for short internships)

### Database Changes
- `CourseEnrollment.isInternship`: Boolean flag for internship
- `CourseEnrollment.internshipType`: REMOTE or ONSITE
- `CourseEnrollment.internshipDays`: Duration for validation
- `CourseType` enum: Added INTERNSHIP

### Validation
Use `getInternshipCredits()` and `validateInternship()` from `lib/course-validation.ts`.

---

## 3. Branch-Specific Courses (DP-010P)

### Requirements
- **All B.Tech Students**: Must take 2-credit project/seminar in Semester 8
- **Course Code**: Varies by branch
  - CSE-010P (Computer Science)
  - EE-010P (Electrical Engineering)
  - ME-010P (Mechanical Engineering)
  - etc.

### Database Changes
- `Course.isBranchSpecific`: Boolean flag
- `Course.requiredBranches`: Array of branch codes (e.g., ["CSE", "DSE"])
- `Course.requiredSemester`: Semester when course must be taken (e.g., 8)

### Auto-Enrollment
Branch-specific courses should be auto-enrolled in semester 8 if not already taken.

---

## 4. Adjusted DE/FE Credits Based on ISTP

### Logic
- **ISTP Done**: DE and FE as per curriculum
- **ISTP Skipped**: +4 credits to FE
- **MTP-2 Skipped**: +5 credits to DE

### Calculation
Use `calculateAdjustedElectives()` from `lib/course-validation.ts`.

### Examples
For CSE (normally DC=38, DE=28, FE=22):
- ISTP done, MTP-2 done: FE=22
- ISTP skipped, MTP-2 done: FE=26 (+4 from ISTP skip)
- ISTP done, MTP-2 skipped: DE=33 (+5 from MTP-2 skip)
- Both skipped: DE=33, FE=26

---

## 5. Document Management

### Features
- **User-Specific Documents**: Students can upload and see only their own documents
- **Public Documents**: Admins can mark documents as public (visible to all)
- **Branch-Specific Documents**: Add curriculum, guides specific to each branch
- **Document Categories**: Forms, Procedures, Guides, Certificates, Transcripts, Other

### Access Control
- GET /api/documents: Returns user's own docs + public docs
- POST /api/documents/upload: Student uploads personal document
- Admin-only: Upload branch-specific or public documents

### New Document Category (Optional)
Consider adding CURRICULUM or BRANCH_GUIDES as categories.

---

## 6. Backlog Tracking (F/FS Grades)

### Database Changes
- `CourseEnrollment.status`: Added FAILED to track F grades
- `CourseCategoryType`: Added BACKLOG enum value
- `CourseEnrollment`: Can be re-taken later with BACKLOG category

### Process
1. Student enrolls in course, gets F/FS grade → marked with FAILED status
2. Later semester: Student enrolls in same course again
3. Mark second enrollment with `category: BACKLOG`
4. Grade validation: Most recent completion counts

---

## 7. Branch Changes Support

### Database Changes
- `User.previousBranch`: Track previous branch for branch-change students
- Helps identify students who need to complete IC requirements of new branch

### Manual Processing
As user mentioned: Have list of students who changed branches, process separately:
1. Check if new branch has different IC requirements
2. Identify missing IC courses
3. Mark them for additional enrollment (if applicable)

---

## 8. Batch 2023 Student Gating

### Login Flow
1. Student logs in with Google OAuth
2. Fetch name and enrollment ID
3. Extract batch from enrollment ID (B23xxx for 2023 batch)
4. **Currently: Only approve B23xxx students**
5. Show message to others: "Currently operating for Batch 2023 students. Might expand later."

### Database
- `User.batch`: Extracted from enrollmentId
- `ApprovedUser.batch`: Filter during approval

---

## 9. Timetable Auto-Sync

### Features
- Students can upload timetable (CSV/Excel format)
- System auto-creates TimetableEntry records
- Format: Course Code, Day, Start Time, End Time, Venue

### Sample CSV
```
CS101,MONDAY,09:00,10:30,LHC-101
CS102,WEDNESDAY,11:00,12:30,Lab-201
MATH201,FRIDAY,14:00,15:30,Seminar-301
```

### Implementation
Create endpoint: POST /api/timetable/import

---

## File Locations

- **Validation Logic**: `lib/course-validation.ts`
- **Branch Courses Script**: `scripts/seed-branch-courses.ts`
- **Database Schema**: `prisma/schema.prisma`
- **API Endpoints**: `app/api/enrollments/route.ts`, `app/api/documents/route.ts`

---

## Next Steps

1. ✅ Database schema updated
2. ⏳ Create enrollment validation API
3. ⏳ Seed branch-specific courses (DP-010P)
4. ⏳ Update enrollment UI to support P/F selection
5. ⏳ Create internship enrollment form
6. ⏳ Add branch-specific document filtering
7. ⏳ Implement batch gating in auth flow
8. ⏳ Create timetable import endpoint

---

## Status
✅ Schema updated
✅ Validation utilities created
⏳ API endpoints pending
⏳ UI updates pending
⏳ Testing pending

