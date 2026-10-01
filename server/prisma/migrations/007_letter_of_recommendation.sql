-- Adds a "Letter of Recommendation" field to the applicant profile, per
-- board feedback item 2: no file upload needed — just the names of
-- professors who highly rate/recommend the applicant, as free text.
-- Reused automatically on future applications (same pattern as
-- priorExperience / degree / expectedGraduation), not a one-time question.
--
-- Run this against an existing database with:
--   psql gta_portal -f server/prisma/migrations/007_letter_of_recommendation.sql
--
-- A fresh database created from prisma/schema.sql already includes this.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recommenders" TEXT;
