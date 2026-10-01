-- GTA Portal — database schema
-- This is the runtime schema for this sandbox (applied directly via psql, driven by
-- the `pg` client) because this environment's network policy blocks Prisma's engine
-- binary download (binaries.prisma.sh). It is hand-kept 1:1 with prisma/schema.prisma
-- so that on GMU's real infrastructure (where that host isn't blocked), this project
-- can switch to `prisma migrate dev` against schema.prisma with no model changes —
-- see README.md "Swapping in real Prisma" for the exact steps.

CREATE TYPE "Role" AS ENUM ('APPLICANT', 'FACULTY', 'ADMIN');
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'INTERVIEW', 'HIRED');
CREATE TYPE "EnrollmentType" AS ENUM ('FULL_TIME', 'PART_TIME');

CREATE TABLE "User" (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email               TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  "gNumber"           TEXT,
  phone               TEXT,
  role                "Role" NOT NULL,
  program             TEXT,
  department          TEXT,
  degree              TEXT,
  "expectedGraduation" TEXT,
  gpa                 TEXT,
  "priorExperience"   TEXT,
  -- "Accepted the offer" post-hire onboarding questionnaire (see migrations/002_onboarding_questionnaire.sql)
  "paidPositionLast2Years"    BOOLEAN,
  "onboardingPacketCompleted" BOOLEAN,
  "i9FormCompleted"           BOOLEAN,
  "usCitizenOrPermRes"        BOOLEAN,
  "hasSSN"                    BOOLEAN,
  "isNewGTA"                  BOOLEAN,
  "celtdCompleted"            BOOLEAN,
  "celtdEvidenceFileName"     TEXT,
  "celtdCertificateFileName"  TEXT,
  "coursesRegisteredNextTerm" INTEGER,
  "onboardingSubmittedAt"     TIMESTAMPTZ,
  -- Full profile, matching the original PowerApps Profile table
  -- (see migrations/003_full_profile_fields.sql for the field-by-field rationale)
  "preferredName"      TEXT,
  "addressLine1"       TEXT,
  "addressLine2"       TEXT,
  "city"               TEXT,
  "state"              TEXT,
  "zip"                TEXT,
  "linkedIn"           TEXT,
  "college"            TEXT,
  "major"              TEXT,
  "anticipatedGraduationSemester" TEXT,
  "anticipatedGraduationYear"     INTEGER,
  "earnedDegreePreviously"        BOOLEAN,
  "highestDegreeDegree"           TEXT,
  "highestDegreeMajor"            TEXT,
  "highestDegreeUniversity"       TEXT,
  "highestDegreeYear"             INTEGER,
  "gtaExperience"       BOOLEAN,
  "gtaSemesters"        INTEGER,
  "priorITExperience"   BOOLEAN,
  "itIndustryYoe"       INTEGER,
  "technology"          TEXT,
  "priorGTAExperienceInfo" TEXT,
  "workedForGMUBefore"  BOOLEAN,
  "whereAtGMU"          TEXT,
  "phdDissertationAdvisor" TEXT,
  "phdITConcentration"  TEXT,
  "resumeFileName"      TEXT,
  "unofficialTranscriptFileName" TEXT,
  -- Letter of Recommendation: no file upload — just the names of professors
  -- who highly rate/recommend the applicant (migration 007)
  "recommenders"        TEXT,
  -- Asked once ever, in the Apply flow's Education & Documents step
  -- (see migrations/005_sections_crn_instructor_and_final_semester.sql)
  "isFinalSemester"     BOOLEAN,
  -- In-state / Out-of-state — no international option (migration 008)
  "tuitionStatus"       TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A course groups one or more Sections (e.g. "IT 392" in Fall 2026 has
-- sections 001, 002, DL1, ...). Applicants apply to a Course; faculty assign
-- the specific Section (and hours) at hire time — see Application below.
CREATE TABLE "Course" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "courseCode"  TEXT NOT NULL,
  "courseTitle" TEXT NOT NULL,
  term          TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("courseCode", term)
);

CREATE TABLE "Section" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "courseId"    TEXT NOT NULL REFERENCES "Course"(id),
  "courseCode"  TEXT NOT NULL,
  "courseTitle" TEXT NOT NULL,
  term          TEXT NOT NULL,
  "meetingTime" TEXT NOT NULL,
  "totalSeats"  INTEGER NOT NULL,
  -- CRN + instructor, populated from the registrar's real course/faculty
  -- export (see prisma/seed-fall2026-sections.sql)
  "crn"         TEXT,
  "instructor"  TEXT,
  -- Allowed hour values for this section's "Basis" at hire time, comma-
  -- separated (e.g. "5,6.7,10"; IT 105 uses "10,15") — admin-configurable,
  -- see migrations/006_course_level_applications_and_hours.sql
  "hourOptions" TEXT NOT NULL DEFAULT '5,6.7,10',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "Section_crn_key" ON "Section"("crn") WHERE "crn" IS NOT NULL;

-- An applicant applies to a Course (courseId), not a specific Section.
-- assignedSectionId + hours are only set once a faculty member hires them
-- into one of that course's sections ("Basis" = hours, per the 2026-09-29
-- board meeting — replaces the old Full-time/Part-time/Lab enum). Each
-- GTA's hours across all their HIRED sections in a term may not exceed
-- 20.1 — enforced in application code, not a DB constraint.
CREATE TABLE "Application" (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "applicantId"     TEXT NOT NULL REFERENCES "User"(id),
  "courseId"        TEXT NOT NULL REFERENCES "Course"(id),
  "assignedSectionId" TEXT REFERENCES "Section"(id),
  hours             NUMERIC(4,1),
  "enrollmentType"  "EnrollmentType" NOT NULL,
  "resumeFileName"  TEXT,
  -- Asked once PER SEMESTER (not once-ever, unlike the User profile's
  -- ask-once fields) — lives here since each Application already carries
  -- its own term via its Course (migration 008)
  "hoursWorkedOutsideGMU" NUMERIC(5,1),
  status            "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "interviewScheduledAt" TIMESTAMPTZ,
  "submittedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("applicantId", "courseId")
);

CREATE INDEX "Application_applicantId_idx" ON "Application"("applicantId");
CREATE INDEX "Application_courseId_idx" ON "Application"("courseId");
CREATE INDEX "Application_assignedSectionId_idx" ON "Application"("assignedSectionId");
