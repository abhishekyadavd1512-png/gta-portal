-- Expands the applicant Profile to match every field on the original PowerApps
-- "Profile" Dataverse table (see the project's profiles-table-recreation-plan doc
-- for the authoritative column list), so the web app's Edit Profile screen covers
-- everything the old app did: Personal Information, Education, Experience, and
-- Documents (including the unofficial transcript upload that was flagged missing).
--
-- Not duplicated here (already covered by the post-hire onboarding questionnaire,
-- migrations/002): CELTDCompletion, I9Completion, OnboardingPacketCompletion,
-- SSNSubmission. Not recreated (system-managed in Dataverse, not user-facing
-- here): DataverseStatus, Email Address (unused duplicate), Status lookup.
--
-- Run this against an existing database with:
--   psql gta_portal -f server/prisma/migrations/003_full_profile_fields.sql
--
-- A fresh database created from prisma/schema.sql already includes these columns.

ALTER TABLE "User"
  -- Personal Information
  ADD COLUMN IF NOT EXISTS "preferredName" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine1" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine2" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "state" TEXT,
  ADD COLUMN IF NOT EXISTS "zip" TEXT,
  ADD COLUMN IF NOT EXISTS "linkedIn" TEXT,
  -- Education
  ADD COLUMN IF NOT EXISTS "college" TEXT,
  ADD COLUMN IF NOT EXISTS "major" TEXT,
  ADD COLUMN IF NOT EXISTS "anticipatedGraduationSemester" TEXT,
  ADD COLUMN IF NOT EXISTS "anticipatedGraduationYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "earnedDegreePreviously" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "highestDegreeDegree" TEXT,
  ADD COLUMN IF NOT EXISTS "highestDegreeMajor" TEXT,
  ADD COLUMN IF NOT EXISTS "highestDegreeUniversity" TEXT,
  ADD COLUMN IF NOT EXISTS "highestDegreeYear" INTEGER,
  -- Experience
  ADD COLUMN IF NOT EXISTS "gtaExperience" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "gtaSemesters" INTEGER,
  ADD COLUMN IF NOT EXISTS "priorITExperience" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "itIndustryYoe" INTEGER,
  ADD COLUMN IF NOT EXISTS "technology" TEXT,
  ADD COLUMN IF NOT EXISTS "priorGTAExperienceInfo" TEXT,
  ADD COLUMN IF NOT EXISTS "workedForGMUBefore" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "whereAtGMU" TEXT,
  ADD COLUMN IF NOT EXISTS "phdDissertationAdvisor" TEXT,
  ADD COLUMN IF NOT EXISTS "phdITConcentration" TEXT,
  -- Documents
  ADD COLUMN IF NOT EXISTS "resumeFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "unofficialTranscriptFileName" TEXT;
