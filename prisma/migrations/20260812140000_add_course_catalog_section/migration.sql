-- Store an optional administrator-defined catalogue grouping for a course.
-- Existing courses keep their established code/department-derived grouping.
ALTER TABLE "Course" ADD COLUMN "catalogSection" TEXT;

CREATE INDEX "Course_catalogSection_idx" ON "Course"("catalogSection");
