-- Personal activities are private, student-created timetable entries such as
-- yoga. They deliberately have no course relation or shared approval flow.
ALTER TYPE "ClassType" ADD VALUE IF NOT EXISTS 'PERSONAL';

ALTER TABLE "TimetableEntry" ADD COLUMN IF NOT EXISTS "title" TEXT;
