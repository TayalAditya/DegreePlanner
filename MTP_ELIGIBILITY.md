# 🎓 MTP & ISTP Eligibility Rules

## MTP Eligibility Criteria

### B.Tech Programs (All 12 branches)

**MTP is taken in FINAL YEAR: Semesters 7 & 8**
- **Semester 7**: MTP-1 (3 credits)
- **Semester 8**: MTP-2 (5 credits)

To be eligible to start **MTP (in Semester 7)**, you must satisfy BOTH conditions:

1. **Completed Credits**: ✅ 90 or more credits completed by end of Semester 6
2. **Semester Minimum**: ✅ Reached 7th semester (final year)

```
Eligibility = (CompletedCredits >= 90) AND (CurrentSemester >= 7)
```

### B.S. in Chemical Sciences

**NO MTP requirement** - Uses research projects instead (14 credits)

---

## Why 90 Credits?

### Semester-by-Semester Breakdown

Assuming ~15-17 credits per semester in a normal B.Tech program:

| Semester | Credits Completed | MTP Eligible? |
|----------|-------------------|---------------|
| 1 | ~16 | ❌ No |
| 2 | ~32 | ❌ No |
| 3 | ~48 | ❌ No |
| 4 | ~64 | ❌ No |
| 5 | ~80 | ❌ No |
| 6 | ~96 | ❌ No (semester 7 not reached yet) |
| 7 | ~112 | ✅ **YES** (90+ credits done AND in sem 7) |
| 8 | ~128 | ✅ Yes |

**90 credits ≈ End of Semester 6**
**MTP starts in Semester 7 (final year)**

---

## MTP Timeline

### Year 1 & 2 (Semesters 1-4)
- ❌ Cannot start MTP
- Build foundation with core courses
- Accumulate foundational credits (~64 credits)

### Year 2-3 (Semesters 5-6)
- ❌ Still cannot start MTP
- Continue core and discipline courses
- Complete core curriculum (~96 credits by end of sem 6)
- Prepare for final year

### Year 4 (Semesters 7-8) ← FINAL YEAR
- ✅ **MTP Eligible** (if 90+ credits done)
- **Semester 7**: MTP-1 (3 credits) + other courses
- **Semester 8**: MTP-2 (5 credits) + other courses
- Final project completion
- 2 semesters for full MTP

---

## MTP vs ISTP

### MTP (Major Technical Project)

**Credits**: 8 total
- **MTP-1**: 3 credits (Semester 7)
- **MTP-2**: 5 credits (Semester 8)

**Timeline**: Final year (Semesters 7 & 8)

**Requirement**: Mandatory for all BTech students

**Typical Focus**: Technology development, research, engineering project

### ISTP (Interactive Socio-Technical Practicum)

**Credits**: 4 total (counts as one course)

**Timeline**: **OPTIONAL** - Either Semester 6 OR Semester 8
- **Semester 6**: Take ISTP early (instead of regular course)
- **Semester 8**: Take ISTP in final year (with MTP-2)
- **Not required**: Can skip entirely

**Requirement**: Optional - students choose whether to do ISTP

**Focus**: Societal impact, community engagement, sustainability

**Note**: If ISTP is not taken, those 4 credits go to Free Electives

---

## Skip Logic & Credit Adjustments

If a student **skips or doesn't take** MTP/ISTP components:

| Scenario | Timing | Credit Redistribution |
|----------|--------|----------------------|
| Skip ISTP entirely | N/A | +4 to Free Electives |
| Do ISTP in Sem 6 | Semester 6 | Replaces 1 elective course |
| Do ISTP in Sem 8 | Semester 8 | Replaces 1 elective course (with MTP-2) |
| Skip MTP-2 only | Complete MTP-1 (sem 7) | +5 to Discipline Electives |

---

## Eligibility Check Algorithm

```typescript
function isMTPEligible(completedCredits: number, currentSemester: number): boolean {
  const minCreditsForMTP = 90;
  const minSemesterForMTP = 7;  // Final year

  return (completedCredits >= minCreditsForMTP) &&
         (currentSemester >= minSemesterForMTP);
}

// Example usage:
isMTPEligible(92, 7);  // ✅ true (ready for MTP in final year)
isMTPEligible(88, 7);  // ❌ false (not enough credits)
isMTPEligible(92, 6);  // ❌ false (not in semester 7 yet - sem 6 is last year of regular courses)
isMTPEligible(100, 8); // ✅ true (already doing MTP-2)
```

---

## Important Notes

1. **Both conditions must be met** - It's an AND, not OR
2. **90 credits is a hard floor** - Can't start with 89 credits
3. **Semester 6 is earliest** - Can't start before 6th semester
4. **BS program exempt** - No MTP/ISTP requirements
5. **Credit validation needed** - Should check actual completed grades (not just enrolled)

---

## Database Implementation

In `lib/branches.ts`, for all B.Tech branches:

```typescript
minCreditsForMTP: 90,        // Hard requirement
minSemesterForMTP: 6,        // Earliest semester to start
```

For BS program:

```typescript
minCreditsForMTP: 0,         // No MTP required
minSemesterForMTP: 0,        // N/A
```

---

## Common Questions

**Q: When can I start MTP?**
A: Semester 7 (final year), if you have 90+ credits completed by end of semester 6.

**Q: Can I start MTP in semester 6?**
A: No. Even with 90+ credits, semester 7 is the earliest (final year requirement).

**Q: What if I complete 95 credits by semester 6 but semester 7 starts?**
A: Yes! You're eligible. You have 90+ credits AND you're in semester 7.

**Q: Can I do MTP in semester 8?**
A: Yes. If you haven't completed MTP-1 in semester 7, you can complete MTP-2 in semester 8.

**Q: What if I do MTP-1 (sem 7) but not MTP-2 (sem 8)?**
A: MTP-2 credits (+5) redistribute to Discipline Electives.

**Q: Can I do ISTP in semester 6?**
A: Yes! ISTP is optional and can be taken in Semester 6 OR Semester 8 (or skipped entirely).

**Q: If I take ISTP in sem 6, do I still do MTP in sem 7 & 8?**
A: Yes. ISTP (4 cr) in sem 6 + MTP-1 (3 cr) in sem 7 + MTP-2 (5 cr) in sem 8 = 12 credits total.

**Q: Can I skip ISTP entirely?**
A: Yes! ISTP is completely optional. If you skip it, you get +4 credits for Free Electives.

**Q: Does BS program have MTP?**
A: No. BS has 14-credit Research Projects instead (no semester restrictions).

---

## Verification Checklist

When implementing MTP eligibility:

- [ ] Check completed credits (not just enrolled)
- [ ] Check current semester number
- [ ] Apply AND logic (both must be true)
- [ ] Skip BS programs (they have no MTP)
- [ ] Handle credit redistribution on skip
- [ ] Update dashboard MTP status indicator
- [ ] Test edge cases (exactly 90, exactly semester 6)

---

**Source**: Official curriculum PDF
**Status**: ✅ Implemented in lib/branches.ts
