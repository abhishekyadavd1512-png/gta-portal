-- Adds the post-hire "accepted the offer" onboarding questionnaire fields to User.
-- One-time per applicant, shown at the top of their Profile page the moment they
-- have a HIRED application, ahead of their existing education/profile fields.
--
-- Run this against an existing database with:
--   psql gta_portal -f server/prisma/migrations/002_onboarding_questionnaire.sql
--
-- A fresh database created from prisma/schema.sql already includes these columns.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "paidPositionLast2Years" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "onboardingPacketCompleted" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "i9FormCompleted" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "usCitizenOrPermRes" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "hasSSN" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "isNewGTA" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "celtdCompleted" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "celtdEvidenceFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "celtdCertificateFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "coursesRegisteredNextTerm" INTEGER,
  ADD COLUMN IF NOT EXISTS "onboardingSubmittedAt" TIMESTAMPTZ;
