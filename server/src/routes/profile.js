import { Router } from 'express';
import { q } from '../db.js';
import { toPublicUser } from '../auth.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ profile: toPublicUser(req.user) });
});

const EDITABLE_FIELDS = [
  'name', 'gNumber', 'phone', 'program', 'department',
  'degree', 'expectedGraduation', 'gpa', 'priorExperience',
  // Personal Information
  'preferredName', 'addressLine1', 'addressLine2', 'city', 'state', 'zip', 'linkedIn',
  // Education
  'college', 'major', 'anticipatedGraduationSemester', 'anticipatedGraduationYear',
  'earnedDegreePreviously', 'highestDegreeDegree', 'highestDegreeMajor',
  'highestDegreeUniversity', 'highestDegreeYear',
  // Experience
  'gtaExperience', 'gtaSemesters', 'priorITExperience', 'itIndustryYoe', 'technology',
  'priorGTAExperienceInfo', 'workedForGMUBefore', 'whereAtGMU',
  'phdDissertationAdvisor', 'phdITConcentration',
  // Documents
  'resumeFileName', 'unofficialTranscriptFileName', 'recommenders',
  // Eligibility & Work Authorization (moved from the post-hire questionnaire into Profile)
  'usCitizenOrPermRes', 'hasSSN', 'isNewGTA', 'celtdCompleted',
  'celtdEvidenceFileName', 'celtdCertificateFileName',
  // Asked once, the first time an applicant starts an application
  'paidPositionLast2Years', 'onboardingPacketCompleted', 'i9FormCompleted',
  'coursesRegisteredNextTerm', 'isFinalSemester', 'tuitionStatus',
];

// Integer columns — an empty string from a cleared number input must become
// SQL NULL, not "" (which Postgres would reject as invalid integer syntax).
const INTEGER_FIELDS = new Set([
  'anticipatedGraduationYear', 'highestDegreeYear', 'gtaSemesters', 'itIndustryYoe',
  'coursesRegisteredNextTerm',
]);

router.put('/', async (req, res) => {
  const updates = [];
  const values = [];
  let i = 1;
  for (const field of EDITABLE_FIELDS) {
    if (field in (req.body || {})) {
      let value = req.body[field];
      if (INTEGER_FIELDS.has(field) && (value === '' || value === undefined)) {
        value = null;
      }
      updates.push(`"${field}" = $${i++}`);
      values.push(value);
    }
  }
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No editable fields provided' });
  }
  values.push(req.user.id);
  const result = await q(
    `UPDATE "User" SET ${updates.join(', ')}, "updatedAt" = now() WHERE id = $${i} RETURNING *`,
    values
  );
  res.json({ profile: toPublicUser(result.rows[0]) });
});

export default router;
