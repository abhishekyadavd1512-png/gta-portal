-- Edit Sections upgrade (Applications Dashboard follow-up, 2026-10-06):
--
-- "active" — an inactive section is hidden from the Apply flow's course list
-- (so applicants can't apply into it) and from Faculty/Admin's "pick a
-- section to assign" list, but keeps whatever history it already has
-- (an existing hire into a now-inactive section still displays fine). Used
-- by the Edit Sections table's Active checkbox, and automatically set false
-- by a CLSS re-import's "remove sections not in this file" option when a
-- section being removed has an existing hire attached (see admin.js
-- POST /sections/import) — it's deactivated and the affected hire(s) are
-- reverted to Pending for reassignment, rather than deleting a section an
-- applicant is actually relying on.
--
-- "countsTowardCap" — whether hours a GTA is hired for in this section count
-- toward their 20.1-hour/term maximum (see applications.js and faculty.js).
-- Defaults true for the normal case; an admin can flip it off for a section
-- that's funded/tracked separately from the usual GTA hour pool.
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "countsTowardCap" BOOLEAN NOT NULL DEFAULT true;
