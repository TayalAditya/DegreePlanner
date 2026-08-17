-- Student's own final course registration declaration.
--
-- Samarth and Sootrank sometimes hold different (or wrong) submissions for the
-- same student. This table is where the student states what they actually want
-- registered and in what form (Regular / Pass-Fail / Audit), so the Academic
-- Secretary has one authoritative record to reconcile the portals against.
--
-- `courses` is a frozen snapshot taken at submit time, not a live view of the
-- draft plan: the whole point is a record of what was declared, which must not
-- drift when the student later edits their plan or an offering changes.
CREATE TABLE IF NOT EXISTS "FinalCourseSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "batchYear" INTEGER NOT NULL,
    "offeringSemester" INTEGER NOT NULL,
    "offeringYear" INTEGER NOT NULL,
    "courses" JSONB NOT NULL,
    "totalCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalCourseSubmission_pkey" PRIMARY KEY ("id")
);

-- One declaration per student per registration term; edits bump `revision`.
CREATE UNIQUE INDEX IF NOT EXISTS "FinalCourseSubmission_userId_offeringSemester_offeringYear_key"
    ON "FinalCourseSubmission" ("userId", "offeringSemester", "offeringYear");

-- Admin views list a whole term at a time.
CREATE INDEX IF NOT EXISTS "FinalCourseSubmission_offeringSemester_offeringYear_idx"
    ON "FinalCourseSubmission" ("offeringSemester", "offeringYear");

DO $$
BEGIN
    ALTER TABLE "FinalCourseSubmission"
        ADD CONSTRAINT "FinalCourseSubmission_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
