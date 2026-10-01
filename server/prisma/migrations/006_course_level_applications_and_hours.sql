-- Reworks the application model per the 2026-09-29 board meeting feedback:
--
-- 1. Applicants now apply to a COURSE (e.g. "IT 392"), not a specific
--    section. Faculty assign the specific section — and how many hours the
--    GTA will work in it ("Basis") — at hire time. See the reference
--    screenshot: "The applicant applied to the course, not a section.
--    Assigning one is the hire."
-- 2. "Basis" changes from Full-time/Part-time/Lab to an actual hours value
--    (e.g. 5, 6.7, 10 — or 10/15 for IT 105), configurable per section by
--    an admin (Section.hourOptions, comma-separated).
-- 3. Each GTA's hours across all their HIRED sections this semester may not
--    exceed 20.1. Once a GTA is at the cap, they're blocked from submitting
--    any further course applications for that term (enforced in
--    server/src/routes/applications.js and faculty.js, not by the database).
--
-- Run this against an existing database with:
--   psql gta_portal -f server/prisma/migrations/006_course_level_applications_and_hours.sql
--
-- A fresh database created from prisma/schema.sql already includes all of this.

-- --- Course: a course is now a first-class row (courseCode + term), with
-- one or more Sections underneath it. ---
CREATE TABLE IF NOT EXISTS "Course" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "courseCode"  TEXT NOT NULL,
  "courseTitle" TEXT NOT NULL,
  term          TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("courseCode", term)
);

-- --- Section: belongs to a Course, and now carries its own allowed hour
-- options for the Basis dropdown at hire time. ---
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "courseId" TEXT REFERENCES "Course"(id);
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "hourOptions" TEXT;

-- Backfill: one Course row per distinct (courseCode, term) already in Section.
INSERT INTO "Course" ("courseCode", "courseTitle", term)
SELECT DISTINCT "courseCode", "courseTitle", term FROM "Section"
ON CONFLICT ("courseCode", term) DO NOTHING;

UPDATE "Section" s SET "courseId" = c.id
FROM "Course" c
WHERE s."courseCode" = c."courseCode" AND s.term = c.term AND s."courseId" IS NULL;

ALTER TABLE "Section" ALTER COLUMN "courseId" SET NOT NULL;

-- Default hour options: IT 105 gets the 10/15 exception from the meeting,
-- every other section defaults to 5/6.7/10. Admin can change these per
-- section afterward.
UPDATE "Section" SET "hourOptions" = '10,15' WHERE "courseCode" = 'IT 105' AND "hourOptions" IS NULL;
UPDATE "Section" SET "hourOptions" = '5,6.7,10' WHERE "hourOptions" IS NULL;
ALTER TABLE "Section" ALTER COLUMN "hourOptions" SET NOT NULL;

-- --- Application: now targets a Course. The specific Section and the
-- hours ("Basis") are only set once a faculty member assigns/hires the
-- applicant into one of that course's sections. ---
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "courseId" TEXT REFERENCES "Course"(id);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "assignedSectionId" TEXT REFERENCES "Section"(id);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "hours" NUMERIC(4,1);

-- Backfill existing applications: courseId from their old section's course;
-- already-HIRED applications keep their old section as the assigned section
-- (hours is left NULL for these legacy rows — there's no historical record
-- of what Basis they were hired under, so it isn't invented here).
UPDATE "Application" a SET "courseId" = s."courseId"
FROM "Section" s
WHERE a."sectionId" = s.id AND a."courseId" IS NULL;

UPDATE "Application" SET "assignedSectionId" = "sectionId"
WHERE status = 'HIRED' AND "assignedSectionId" IS NULL;

ALTER TABLE "Application" ALTER COLUMN "courseId" SET NOT NULL;

-- Drop the old direct section link and its constraints/index — replaced by
-- courseId (what was applied to) + assignedSectionId (what they were hired into).
ALTER TABLE "Application" DROP CONSTRAINT IF EXISTS "Application_applicantId_sectionId_key";
DROP INDEX IF EXISTS "Application_sectionId_idx";
ALTER TABLE "Application" DROP COLUMN IF EXISTS "sectionId";

ALTER TABLE "Application" ADD CONSTRAINT "Application_applicantId_courseId_key" UNIQUE ("applicantId", "courseId");

CREATE INDEX IF NOT EXISTS "Application_courseId_idx" ON "Application"("courseId");
CREATE INDEX IF NOT EXISTS "Application_assignedSectionId_idx" ON "Application"("assignedSectionId");
