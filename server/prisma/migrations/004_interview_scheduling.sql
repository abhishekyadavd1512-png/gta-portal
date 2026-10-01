-- Adds a real scheduled date/time to the faculty "Schedule Interview" action,
-- instead of it just flipping status to INTERVIEW with no date attached.
--
-- The actual Teams/Outlook invitation email is stubbed for now (see
-- server/src/routes/faculty.js) — sending a real one needs Microsoft Graph
-- API access (Calendar + OnlineMeetings + Mail.Send permissions), which is
-- the same kind of Azure AD app registration already pending approval for
-- the login system. Swapping in the real send is a later, separate step.
--
-- Run this against an existing database with:
--   psql gta_portal -f server/prisma/migrations/004_interview_scheduling.sql
--
-- A fresh database created from prisma/schema.sql already includes this column.

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "interviewScheduledAt" TIMESTAMPTZ;
