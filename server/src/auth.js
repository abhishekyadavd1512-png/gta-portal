// ---------------------------------------------------------------------------
// STUB AUTH — not Entra ID / MSAL.
//
// The board's architecture decision names Entra ID + MSAL App Roles as the
// real auth for this app, but wiring that up needs an Azure AD app
// registration this sandbox has no access to (and it's explicitly flagged as
// the critical-path blocker in the architecture doc, pending ASRB/Tenant
// Admin approval). Until that's available, this issues a signed JWT for
// whatever email/name/role the user picks on a simple login screen, so real
// features can be built and tested end-to-end now.
//
// To swap in real Entra ID/MSAL later: replace only this file's
// POST /login handler (validate the MSAL id_token server-side, map its App
// Role claim to our Role enum, upsert the User the same way this stub does)
// — every downstream route already just trusts req.user, so nothing else
// needs to change.
// ---------------------------------------------------------------------------
import jwt from 'jsonwebtoken';
import { q } from './db.js';

const SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'gta_session';

export async function login(req, res) {
  const { email, name, role } = req.body || {};
  if (!email || !name || !role) {
    return res.status(400).json({ error: 'email, name, and role are required' });
  }
  if (!['APPLICANT', 'FACULTY', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'role must be APPLICANT, FACULTY, or ADMIN' });
  }

  const existing = await q('SELECT * FROM "User" WHERE email = $1', [email]);
  let user = existing.rows[0];
  if (!user) {
    const inserted = await q(
      'INSERT INTO "User" (email, name, role) VALUES ($1,$2,$3) RETURNING *',
      [email, name, role]
    );
    user = inserted.rows[0];
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: '12h' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Required for the cookie to be sent back over HTTPS in production
    // (Render terminates TLS in front of the app); browsers reject
    // `secure` cookies over the plain http://localhost used in dev.
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ user: toPublicUser(user) });
}

export function logout(req, res) {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    const payload = jwt.verify(token, SECRET);
    const result = await q('SELECT * FROM "User" WHERE id = $1', [payload.sub]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not signed in' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized for this action' });
    }
    next();
  };
}

export function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    gNumber: user.gNumber,
    phone: user.phone,
    program: user.program,
    department: user.department,
    degree: user.degree,
    expectedGraduation: user.expectedGraduation,
    gpa: user.gpa,
    priorExperience: user.priorExperience,
    // Personal Information
    preferredName: user.preferredName,
    addressLine1: user.addressLine1,
    addressLine2: user.addressLine2,
    city: user.city,
    state: user.state,
    zip: user.zip,
    linkedIn: user.linkedIn,
    // Education
    college: user.college,
    major: user.major,
    anticipatedGraduationSemester: user.anticipatedGraduationSemester,
    anticipatedGraduationYear: user.anticipatedGraduationYear,
    earnedDegreePreviously: user.earnedDegreePreviously,
    highestDegreeDegree: user.highestDegreeDegree,
    highestDegreeMajor: user.highestDegreeMajor,
    highestDegreeUniversity: user.highestDegreeUniversity,
    highestDegreeYear: user.highestDegreeYear,
    // Experience
    gtaExperience: user.gtaExperience,
    gtaSemesters: user.gtaSemesters,
    priorITExperience: user.priorITExperience,
    itIndustryYoe: user.itIndustryYoe,
    technology: user.technology,
    priorGTAExperienceInfo: user.priorGTAExperienceInfo,
    workedForGMUBefore: user.workedForGMUBefore,
    whereAtGMU: user.whereAtGMU,
    phdDissertationAdvisor: user.phdDissertationAdvisor,
    phdITConcentration: user.phdITConcentration,
    // Documents
    resumeFileName: user.resumeFileName,
    unofficialTranscriptFileName: user.unofficialTranscriptFileName,
    recommenders: user.recommenders,
    // Eligibility & Work Authorization (asked once, as part of creating/editing the Profile)
    usCitizenOrPermRes: user.usCitizenOrPermRes,
    hasSSN: user.hasSSN,
    isNewGTA: user.isNewGTA,
    celtdCompleted: user.celtdCompleted,
    celtdEvidenceFileName: user.celtdEvidenceFileName,
    celtdCertificateFileName: user.celtdCertificateFileName,
    // Asked once, the first time an applicant starts an application (see client/src/pages/applicant/Apply.jsx)
    paidPositionLast2Years: user.paidPositionLast2Years,
    onboardingPacketCompleted: user.onboardingPacketCompleted,
    i9FormCompleted: user.i9FormCompleted,
    coursesRegisteredNextTerm: user.coursesRegisteredNextTerm,
    isFinalSemester: user.isFinalSemester,
    tuitionStatus: user.tuitionStatus,
  };
}
