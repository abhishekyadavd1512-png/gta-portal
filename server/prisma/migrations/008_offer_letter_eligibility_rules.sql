-- Board feedback item 3 ("Offer Letter"): move remaining offer-letter-time
-- questions earlier — into the profile or the first application of the
-- semester — and add the business rules that go with them:
--
-- 1. Tuition status (In-state / Out-of-state — no international option),
--    asked once ever in the Apply flow's Education & Documents step, same
--    pattern as GPA/final-semester/etc (see server/src/routes/applications.js
--    EDITABLE_FIELDS in profile.js for the full ask-once-ever group).
-- 2. Hours worked outside GMU — asked once PER SEMESTER (not once-ever),
--    so it lives on the Application row itself (each Application already
--    carries its own term via its Course), not on the User profile.
--
-- Enforcement rules that ride along with these fields (GPA floor, minimum
-- courses registered based on enrollment type + final-semester) are plain
-- application-code checks in applications.js — not database constraints,
-- consistent with how the 20.1-hour cap is enforced.
--
-- Run this against an existing database with:
--   psql gta_portal -f server/prisma/migrations/008_offer_letter_eligibility_rules.sql
--
-- A fresh database created from prisma/schema.sql already includes this.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tuitionStatus" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "hoursWorkedOutsideGMU" NUMERIC(5,1);
