# Course List Semester Wise - Excel File Analysis

## File Structure

**File:** `Course List semester wise.xlsx`
**Location:** `docs/Course List semester wise.xlsx`

### Worksheets Available
1. **Odd 2023-24** (243 rows)
2. **Odd 2024-25**
3. **Even 2024-25**
4. **Odd 2025-26**
5. **Even 2025-26**

---

## Odd 2023-24 Sheet Structure

### Column Headers (Row 1)
Main course identification columns:
- **Sr. No.** - Serial number
- **Course No.** - Course code (e.g., IC-102P, BE-201)
- **Course Title** - Full course name
- **Credits (L-T-P-C)** - Lecture-Tutorial-Practical-Credit format
- **Instructor** - Faculty name(s)

### Branch/Specialization Columns
The rest of the columns show where each course is offered:

#### BTech (Undergraduate) Semesters
- **1st Sem** - Common 1st semester for all BTech
- **3rd Sem BE** - Bioengineering 3rd semester
- **3rd Sem CE** - Civil Engineering 3rd semester
- **3rd Sem CS** - Computer Science 3rd semester
- **3rd Sem DSE** - Data Science Engineering 3rd semester
- **3rd Sem EE** - Electrical Engineering 3rd semester
- **3rd Sem EP** - Engineering Physics 3rd semester
- **3rd Sem ME** - Mechanical Engineering 3rd semester
- **5th Sem** variants - Same pattern for 5th semester
- **7th Sem** variants - Same pattern for 7th semester

#### Dual Degree/Specializations
- **VLSI 1st sem, VLSI 3rd sem** - VLSI specialization
- **CSP 1st sem, CSP 3rd sem** - CSP specialization
- **PED 1st sem, PED 3rd sem** - PED specialization
- **CSE 1st sem, CSE 3rd sem** - CSE specialization
- **ET 1st sem, ET 3rd sem** - ET specialization
- **MEE 3rd sem, MES 3rd sem** - ME specializations
- **STE 1st sem, STE 3rd sem** - STE specialization
- **FTE 3rd sem** - FTE specialization
- **Bio 1st, Bio 3rd** - Biotech
- **MA 1st sem, MA 3rd sem** - Math
- **M.Sc (chem), M.Sc (math), M.Sc (Physics)** - Master's programs
- **I-Ph.D.** - Integrated PhD
- **MS/PhD** - Master's/PhD variants

### Indicator Values in Cells

Each course cell contains one of these markers:
- **C** = Compulsory/Mandatory
- **E** = Elective
- **IC** = Integrated Core (IC basket courses)
- **DC** = Discipline Core
- *Empty cell* = Course not offered in that semester for that branch

---

## Key Courses Identified

### IC (Integrated Core) - 1st Semester Common
- **IC-102P**: Foundations of Design Practicum (1-0-6-4) = 4 credits
- **IC-152**: Introduction to Python and Data Science (3-0-2-4) = 4 credits
- **IC-272**: Data Science III (2-0-2-3) = 3 credits

### IC Basket Courses
From row analysis:
- **IC-131**: Applied Chemistry for Engineers (2-0-2-3) = 3 credits → Marked as "Elective (E)" for 3rd+ semesters
- **IC-136**: Understanding Biotechnology (3-0-0-3) = 3 credits → Marked as "E" for 3rd+ semesters
- **IC-230**: Environmental Science (3-0-0-3) = 3 credits
- **IC-241**: Materials Science for Engineers (3-0-0-3) = 3 credits → Marked as "IC" for 3rd semester (not optional there)
- **IC-181**: Introduction to Consciousness and Wellbeing (2-0-2-3) = 3 credits → Marked as "E" for 3rd+ semesters

### Discipline Core (DC) Examples
**Bioengineering (BE):**
- BE-201: Cell Biology (3-0-2-4) = 4 credits - DC for 3rd Sem BE
- BE-202: Biochemistry and Molecular Biology (3-0-2-4) = 4 credits - DC for 3rd Sem BE
- BE-501: Anatomy and Physiology (3-0-0-3) = 3 credits - DC for 5th Sem BE

**Civil Engineering (CE):**
- CE-301: Strength of Materials and Structures (3-0-1-3) = 3 credits

### Practicum/Project Courses
- **BE-498P**: Major Technical Project-1 (0-0-4.5-3) = 3 credits
- **CE 498P**: Major Technical Project-1 (0-0-4.5-3) = 3 credits
- **BE-5xxP**: Btech Post Graduate Project (0-0-36-18) = 18 credits

### Electives (E)
Many courses marked as "E" (Electives) for various semesters:
- BY-505: Nanobiotechnology (3-0-0-3) = 3 credits - marked E for multiple M.Sc programs
- BY-510: Advanced Cell Biology (3-0-0-3) = 3 credits - marked E for M.Sc programs

---

## Credit Format Interpretation

### L-T-P-C Structure
- **L** = Lecture hours per week
- **T** = Tutorial hours per week
- **P** = Practical/Lab hours per week
- **C** = Total Credit value (Usually L + 0.5×T + P)

### Examples
- 3-0-2-4: 3 lectures + 0 tutorials + 2 practicals = 4 credits
- 1-0-6-4: 1 lecture + 0 tutorials + 6 practicals = 4 credits
- 3-0-0-3: 3 lectures + 0 tutorials + 0 practicals = 3 credits
- 0-0-4.5-3: 0 lectures + 0 tutorials + 4.5 practicals = 3 credits

---

## Offering Pattern (Odd vs Even)

### Odd Semesters (1st, 3rd, 5th, 7th)
Covered in the **Odd 2023-24, Odd 2024-25, Odd 2025-26** sheets

### Even Semesters (2nd, 4th, 6th, 8th)
Covered in the **Even 2024-25, Even 2025-26** sheets

---

## Branch-Semester Mapping

### CSE (Computer Science) Path
- **1st Sem**: Compulsory IC courses
- **3rd Sem CS**: DC courses (CS208, CS214, CS212, CS213)
- **5th Sem CS**: More DC courses (CS313, CS312, CS305)
- **7th Sem CS**: Final DC courses + Projects

### DSE (Data Science Engineering) Path
- **1st Sem**: Compulsory IC courses
- **3rd Sem DSE**: DS-specific DC courses
- **5th Sem DSE**: DS DC courses
- **7th Sem DSE**: Final courses + Projects

### ME (Mechanical Engineering) Path
- **1st Sem**: Compulsory IC courses
- **3rd Sem ME**: ME DC courses
- **5th Sem ME**: More ME DC courses (Fluid Mechanics, Heat Transfer, Design)
- **7th Sem ME**: Final ME DC courses

### BE (Bioengineering) Path
- **1st Sem**: Compulsory IC courses
- **3rd Sem BE**: BE DC courses (Cell Biology, Biochemistry)
- **5th Sem BE**: Advanced BE courses
- **7th Sem BE**: Electives + Projects (BE-498P MTP-1)

### CE (Civil Engineering) Path
- **1st Sem**: Compulsory IC courses
- **3rd Sem CE**: CE DC courses
- **5th Sem CE**: More CE DC courses
- **7th Sem CE**: Final CE courses + MTP-1

---

## Important Observations

### 1. IC Courses in Different Semesters
Some IC courses appear flexible:
- **IC-131, IC-136, IC-230** marked as "E" (Elective) for 3rd+ semesters
- These are probably IC Basket options for students who took different ones in 1st semester

### 2. Credit Values
- Most courses range from 1-4 credits
- Laboratory courses typically 1-2 credits
- Lecture courses typically 3-4 credits
- Projects (P suffix) are variable credits

### 3. Instructor Names
Column shows faculty assignments (e.g., "Dr. Amit Shukla, Dr. Narendra K Dhar")
- Some courses have multiple instructors

### 4. Batch Years
Different academic years have different offerings:
- 2023-24 batch
- 2024-25 batch (Odd and Even semesters)
- 2025-26 batch (Odd and Even semesters)

---

## Missing from Current System

The planner currently doesn't track:
1. **Instructor names** - Available in Excel but not used
2. **Practical hours** - The P component is available but not tracked
3. **Tutorial hours** - The T component is available but not tracked
4. **Offering patterns** - Fall/Spring distinction is hardcoded, not from this Excel
5. **Credit flexibility** - Each course has fixed credits, but some might be variable (0.5 credit increments)

---

## Summary

This Excel file is the **source of truth for IIT Mandi's course offerings**:
- Shows which courses are offered each year
- Indicates which semester they're in (odd/even)
- Shows which branch each course belongs to (via column assignments)
- Provides credit breakdowns (Lecture-Tutorial-Practical-Credit)
- Lists instructor assignments
- Covers BTech, Dual Degree, and PG programs

The current system extracts some of this into `defaultCurriculum.ts` but doesn't fully utilize all the data available in this Excel file.
