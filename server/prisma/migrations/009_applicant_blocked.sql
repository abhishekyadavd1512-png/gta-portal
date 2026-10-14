-- Admin "Block" action (Applications Dashboard upgrade, 2026-10-06): lets an
-- admin prevent a specific applicant from submitting any NEW applications
-- (e.g. a no-show or a policy issue), without touching anything they've
-- already submitted or been assigned to. Enforced in applications.js's
-- POST / (new application). Admin toggles it via PATCH /admin/users/:id/block.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "blocked" BOOLEAN NOT NULL DEFAULT false;
