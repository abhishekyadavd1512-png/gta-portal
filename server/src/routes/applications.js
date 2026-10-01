import { Router } from 'express';
import { q, pool } from '../db.js';

const router = Router();

// Max courses an applicant may apply to at once — same limit regardless of
// full-time/part-time status (board correction, 2026-09-30). Kept in sync
// with the same constant in client/src/pages/applicant/Apply.jsx.
const MAX_COURSES = 10;
// Max hours a GTA may be HIRED for, per term (2026-09-29 board meeting).
// Enforced here (blocks new applications once reached) and again in
// faculty.js (blocks an assign action that would push someone over it).
const HOUR_CAP = 20.1;
// Minimum GPA to be allowed to apply (board feedback item 3, "Offer Letter").
const MIN_GPA = 3.0;

router.get('/mine', async (req, res) => {
  const result = await q(`
    SELECT a.*, c."courseCode", c."courseTitle", c.term,
           s."meetingTime" AS "assignedMeetingTime", s.instructor AS "assignedInstructor",
           s.crn AS "assignedCrn"
    FROM "Application" a
    JOIN "Course" c ON c.id = a."courseId"
    LEFT JOIN "Section" s ON s.id = a."assignedSectionId"
    WHERE a."applicantId" = $1
    ORDER BY a."submittedAt" DESC
  `, [req.user.id]);
  res.json({ applications: result.rows });
});

router.post('/', async (req, res) => {
  const { courseIds, enrollmentType, resumeFileName, hoursWorkedOutsideGMU } = req.body || {};
  if (!Array.isArray(courseIds) || courseIds.length === 0) {
    return res.status(400).json({ error: 'courseIds must be a non-empty array' });
  }
  if (!['FULL_TIME', 'PART_TIME'].includes(enrollmentType)) {
    return res.status(400).json({ error: 'enrollmentType must be FULL_TIME or PART_TIME' });
  }

  // GPA floor (board feedback item 3): a GPA is required to apply, and one
  // below the minimum blocks applying outright. req.user is re-read fresh
  // from the DB on every request (see requireAuth), so this reflects the
  // profile update the Apply flow makes immediately before this call.
  const gpaNum = Number(req.user.gpa);
  if (!req.user.gpa || Number.isNaN(gpaNum)) {
    return res.status(400).json({ error: 'Please enter your GPA before applying.' });
  }
  if (gpaNum < MIN_GPA) {
    return res.status(400).json({ error: `A minimum GPA of ${MIN_GPA.toFixed(1)} is required to apply. Your GPA on file is ${req.user.gpa}.` });
  }

  // Minimum courses registered for the upcoming semester (board feedback
  // item 3): full-time students in their final semester only need 1;
  // everyone else needs 2.
  const minCourses = (enrollmentType === 'FULL_TIME' && req.user.isFinalSemester === true) ? 1 : 2;
  const registeredNum = Number(req.user.coursesRegisteredNextTerm);
  if (req.user.coursesRegisteredNextTerm == null || Number.isNaN(registeredNum)) {
    return res.status(400).json({ error: 'Please tell us how many courses you have registered for the upcoming semester before applying.' });
  }
  if (registeredNum < minCourses) {
    return res.status(400).json({
      error: `You need to be registered for at least ${minCourses} course${minCourses === 1 ? '' : 's'} for the upcoming semester to apply${enrollmentType === 'FULL_TIME' && req.user.isFinalSemester === true ? ' (1 is enough since this is your final semester as a full-time student)' : ''}. You currently have ${registeredNum} on file.`,
    });
  }

  const existing = await q('SELECT count(*)::int AS n FROM "Application" WHERE "applicantId" = $1', [req.user.id]);
  const alreadyApplied = existing.rows[0].n;
  if (alreadyApplied + courseIds.length > MAX_COURSES) {
    return res.status(400).json({
      error: `Students may have up to ${MAX_COURSES} active application(s). You already have ${alreadyApplied} and are requesting ${courseIds.length} more.`,
    });
  }

  // 20.1-hour cap — once a GTA's HIRED hours for a term reach the cap,
  // they're blocked from submitting any further applications for that term.
  const targetCourses = await q('SELECT id, term FROM "Course" WHERE id = ANY($1)', [courseIds]);
  const terms = [...new Set(targetCourses.rows.map((c) => c.term))];
  for (const term of terms) {
    const hoursResult = await q(`
      SELECT COALESCE(SUM(a.hours), 0) AS total
      FROM "Application" a
      JOIN "Course" c ON c.id = a."courseId"
      WHERE a."applicantId" = $1 AND a.status = 'HIRED' AND c.term = $2
    `, [req.user.id, term]);
    const totalHired = Number(hoursResult.rows[0].total);
    if (totalHired >= HOUR_CAP) {
      return res.status(400).json({
        error: `You're already hired for ${totalHired} hours in ${term}, which is at the ${HOUR_CAP}-hour maximum — you can't submit new applications for that term.`,
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (const courseId of courseIds) {
      const result = await client.query(
        `INSERT INTO "Application" ("applicantId","courseId","enrollmentType","resumeFileName","hoursWorkedOutsideGMU")
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.user.id, courseId, enrollmentType, resumeFileName || null, hoursWorkedOutsideGMU === '' || hoursWorkedOutsideGMU == null ? null : hoursWorkedOutsideGMU]
      );
      created.push(result.rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json({ applications: created });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already applied to one of the selected courses.' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'One of the selected courses no longer exists.' });
    }
    throw err;
  } finally {
    client.release();
  }
});

export default router;
