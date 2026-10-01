-- Two additions:
--
-- 1. Adds CRN and instructor to Section, so the real Fall 2026 course/faculty
--    list (registrar export) can be loaded in with each section correctly
--    attributed to who's teaching it. CRN is unique per Banner/registrar
--    convention, so real sections can be re-imported safely without creating
--    duplicates (see prisma/seed-fall2026-sections.sql, which uses
--    ON CONFLICT (crn) DO NOTHING).
--
-- 2. Adds "isFinalSemester" to User — the applicant-facing "Is this your
--    final semester?" question, asked once ever in the Apply flow (same
--    ask-once pattern as GPA / course registration) and reused automatically
--    on every application after that.
--
-- Run this against an existing database with:
--   psql gta_portal -f server/prisma/migrations/005_sections_crn_instructor_and_final_semester.sql
--
-- A fresh database created from prisma/schema.sql already includes these columns.

ALTER TABLE "Section"
  ADD COLUMN IF NOT EXISTS "crn" TEXT,
  ADD COLUMN IF NOT EXISTS "instructor" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Section_crn_key" ON "Section"("crn") WHERE "crn" IS NOT NULL;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isFinalSemester" BOOLEAN;
