import { Router } from 'express';
import { q } from '../db.js';

const router = Router();

// Max hours a GTA may be HIRED for, per term (2026-09-29 board meeting) —
// kept in sync with the same constant in applications.js.
const HOUR_CAP = 20.1;
// Minimum GPA to apply (board feedback item 3, "Offer Letter") — kept in
// sync with the same constant in applications.js. Re-checked here (not just
// at application time) because profile fields can change after submission.
const MIN_GPA = 3.0;

// Board feedback item 4 ("Offer Letter — SharePoint"): the web app never
// triggers the actual offer letter process or talks to SharePoint — that
// stays a manual, external, roughly-weekly process. All this computes is a
// read-only "Offer Letter Ready" flag so whoever runs that export knows,
// at a glance, which fully-assigned (HIRED + section + hours set) GTAs also
// satisfy every one of the board's "Offer Letter" eligibility rules: GPA
// floor, minimum courses registered, Tuition status answered, and Hours
// worked outside GMU answered for the term. Returns both the boolean and
// the specific list of what's missing, so faculty can see why someone
// isn't ready yet instead of just a plain yes/no.
function computeOfferLetterStatus(a) {
  if (a.status !== 'HIRED' || a.assignedSectionId == null || a.hours == null) {
    return { offerLetterReady: false, offerLetterMissing: ['Not fully assigned to a section yet'] };
  }
  const missing = [];
  const gpaNum = Number(a.gpa);
  if (!a.gpa || Number.isNaN(gpaNum) || gpaNum < MIN_GPA) missing.push(`GPA below ${MIN_GPA.toFixed(1)}`);
  const minCourses = (a.enrollmentType === 'FULL_TIME' && a.isFinalSemester === true) ? 1 : 2;
  const registeredNum = Number(a.coursesRegisteredNextTerm);
  if (a.coursesRegisteredNextTerm == null || Number.isNaN(registeredNum) || registeredNum < minCourses) missing.push('Courses registered below minimum');
  if (!a.tuitionStatus) missing.push('Tuition status not answered');
  if (a.hoursWorkedOutsideGMU == null) missing.push('Hours worked outside GMU not answered');
  return { offerLetterReady: missing.length === 0, offerLetterMissing: missing };
}

router.get('/applications', async (req, res) => {
  const { status, program, term, search } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;

  if (status) { conditions.push(`a.status = $${i++}`); values.push(status); }
  if (program) { conditions.push(`u.program = $${i++}`); values.push(program); }
  if (term) { conditions.push(`c.term = $${i++}`); values.push(term); }
  if (search) {
    conditions.push(`(u.name ILIKE $${i} OR c."courseCode" ILIKE $${i} OR c."courseTitle" ILIKE $${i})`);
    values.push(`%${search}%`);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await q(`
    SELECT a.*, u.name AS "applicantName", u.email AS "applicantEmail", u.program, u.gpa, u."priorExperience",
           u."isFinalSemester", u."coursesRegisteredNextTerm", u."tuitionStatus",
           c."courseCode", c."courseTitle", c.term,
           s."meetingTime" AS "assignedMeetingTime", s.instructor AS "assignedInstructor", s.crn AS "assignedCrn",
           -- Total hours this applicant is HIRED for across ALL their
           -- applications this term (not just this row) — a correlated
           -- subquery so it stays accurate regardless of the dashboard's
           -- active filters (status/program/term/search), which only
           -- narrow which ROWS show, not this total. Lets faculty see at a
           -- glance when someone is already at/near the 20.1-hour cap from
           -- being hired into more than one course.
           (SELECT COALESCE(SUM(a2.hours), 0)
            FROM "Application" a2
            JOIN "Course" c2 ON c2.id = a2."courseId"
            WHERE a2."applicantId" = a."applicantId" AND a2.status = 'HIRED' AND c2.term = c.term
           ) AS "applicantTermHours"
    FROM "Application" a
    JOIN "User" u ON u.id = a."applicantId"
    JOIN "Course" c ON c.id = a."courseId"
    LEFT JOIN "Section" s ON s.id = a."assignedSectionId"
    ${where}
    ORDER BY a."submittedAt" DESC
  `, values);
  const applications = result.rows.map((a) => ({ ...a, ...computeOfferLetterStatus(a) }));
  res.json({ applications });
});

// Lists the sections under an application's course, for the "Assign to
// section" screen (Basis = hours, not Full-time/Part-time/Lab — see
// migrations/006_course_level_applications_and_hours.sql). sectionNumber is
// parsed out of meetingTime (stored as e.g. "Section 001 — In-person, time
// TBA") since that's the short code faculty actually look for.
router.get('/applications/:id/sections', async (req, res) => {
  const appResult = await q('SELECT * FROM "Application" WHERE id = $1', [req.params.id]);
  const application = appResult.rows[0];
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const sectionsResult = await q(`
    SELECT s.*,
      regexp_replace(s."meetingTime", '^Section (\\S+).*', '\\1') AS "sectionNumber",
      s."totalSeats" - COALESCE(SUM(CASE WHEN a.status = 'HIRED' THEN 1 ELSE 0 END), 0)::int AS "seatsOpen"
    FROM "Section" s
    LEFT JOIN "Application" a ON a."assignedSectionId" = s.id
    WHERE s."courseId" = $1
    GROUP BY s.id
    ORDER BY s."meetingTime" ASC
  `, [application.courseId]);

  // Total hours this applicant is already HIRED for this term, across every
  // one of their applications — including this one, if it's already hired
  // (e.g. reopening "Reassign Section / Hours"), so the cap banner always
  // reflects their true current standing. This is a display figure only:
  // the actual assign check below (PATCH /applications/:id/assign)
  // correctly excludes this application's own current hours before adding
  // the newly-picked value, so replacing/lowering an existing hire's hours
  // isn't double-counted against itself.
  const hoursResult = await q(`
    SELECT COALESCE(SUM(a.hours), 0) AS total
    FROM "Application" a
    JOIN "Course" c ON c.id = a."courseId"
    WHERE a."applicantId" = $1 AND a.status = 'HIRED' AND c.term = (SELECT term FROM "Course" WHERE id = $2)
  `, [application.applicantId, application.courseId]);

  res.json({
    sections: sectionsResult.rows.map((s) => ({ ...s, hourOptions: s.hourOptions.split(',').map(Number) })),
    hoursAlreadyHired: Number(hoursResult.rows[0].total),
    hourCap: HOUR_CAP,
  });
});

// The actual hire: assigns a specific section + hours ("Basis") to a course
// application. Replaces the old plain "Hire" button — hiring now always
// means picking which section and how many hours.
router.patch('/applications/:id/assign', async (req, res) => {
  const { sectionId, hours } = req.body || {};
  const hoursNum = Number(hours);
  if (!sectionId || !hours || Number.isNaN(hoursNum)) {
    return res.status(400).json({ error: 'sectionId and hours are required' });
  }

  const appResult = await q('SELECT * FROM "Application" WHERE id = $1', [req.params.id]);
  const application = appResult.rows[0];
  if (!application) return res.status(404).json({ error: 'Application not found' });

  const sectionResult = await q('SELECT * FROM "Section" WHERE id = $1 AND "courseId" = $2', [sectionId, application.courseId]);
  const section = sectionResult.rows[0];
  if (!section) return res.status(400).json({ error: 'That section does not belong to this application\'s course.' });

  const allowedHours = section.hourOptions.split(',').map(Number);
  if (!allowedHours.includes(hoursNum)) {
    return res.status(400).json({ error: `${hoursNum} hours is not one of this section's allowed options (${allowedHours.join(', ')}).` });
  }

  // 20.1-hour cap: this hire's hours + whatever else the applicant is
  // already HIRED for this term must not exceed it.
  const termResult = await q('SELECT term FROM "Course" WHERE id = $1', [application.courseId]);
  const term = termResult.rows[0].term;
  const hoursAlready = await q(`
    SELECT COALESCE(SUM(a.hours), 0) AS total
    FROM "Application" a
    JOIN "Course" c ON c.id = a."courseId"
    WHERE a."applicantId" = $1 AND a.status = 'HIRED' AND c.term = $2 AND a.id != $3
  `, [application.applicantId, term, application.id]);
  const totalIfAssigned = Number(hoursAlready.rows[0].total) + hoursNum;
  if (totalIfAssigned > HOUR_CAP) {
    return res.status(400).json({
      error: `Assigning ${hoursNum} hours would bring this applicant to ${totalIfAssigned} hours for ${term}, over the ${HOUR_CAP}-hour maximum (they're already hired for ${hoursAlready.rows[0].total} elsewhere this term).`,
    });
  }

  const result = await q(
    `UPDATE "Application" SET status = 'HIRED', "assignedSectionId" = $1, hours = $2, "updatedAt" = now() WHERE id = $3 RETURNING *`,
    [sectionId, hoursNum, req.params.id]
  );
  res.json({ application: result.rows[0] });
});

// Sends a faculty member's "Schedule Interview" action, optionally with a
// chosen date/time. The actual Teams/Outlook invite email is stubbed below
// (invitePreview) — sending a real one needs Microsoft Graph API access
// (Calendar + OnlineMeetings + Mail.Send), the same kind of Azure AD app
// registration already pending approval for the login system. Swap the stub
// out for a real Graph call in this one spot once that's available.
// Hiring (status -> HIRED) now only happens through POST .../assign above,
// since a hire always needs a section + hours.
router.patch('/applications/:id', async (req, res) => {
  const { status, interviewScheduledAt } = req.body || {};
  if (!['PENDING', 'INTERVIEW'].includes(status)) {
    return res.status(400).json({ error: 'status must be PENDING or INTERVIEW (use POST /applications/:id/assign to hire)' });
  }

  const updates = ['status = $1', '"updatedAt" = now()'];
  const values = [status];
  let i = 2;
  if (interviewScheduledAt !== undefined) {
    updates.push(`"interviewScheduledAt" = $${i++}`);
    values.push(interviewScheduledAt || null);
  }
  // Moving back to Pending/Interview un-assigns any prior hire.
  if (status === 'PENDING' || status === 'INTERVIEW') {
    updates.push(`"assignedSectionId" = NULL`, `hours = NULL`);
  }
  values.push(req.params.id);

  const result = await q(
    `UPDATE "Application" SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Application not found' });

  let invitePreview = null;
  if (interviewScheduledAt) {
    const joined = await q(`
      SELECT a."interviewScheduledAt", u.name AS "applicantName", u.email AS "applicantEmail",
             c."courseCode", c."courseTitle", c.term
      FROM "Application" a
      JOIN "User" u ON u.id = a."applicantId"
      JOIN "Course" c ON c.id = a."courseId"
      WHERE a.id = $1
    `, [req.params.id]);
    const row = joined.rows[0];
    invitePreview = {
      stub: true,
      note: 'Preview only — not actually sent. This will send for real once Microsoft Graph (Calendar + Teams + Mail.Send) is wired up, pending the same Azure AD app registration approval as login.',
      to: row.applicantEmail,
      subject: `GTA Interview — ${row.courseCode} (${row.term})`,
      when: row.interviewScheduledAt,
      body: `Hi ${row.applicantName},\n\nYou're invited to a GTA interview for ${row.courseCode} — ${row.courseTitle}.\n\nJoin Microsoft Teams Meeting\nhttps://teams.microsoft.com/l/meetup-join/placeholder — real link generated once Microsoft Graph integration is live\n\nSee you then!`,
    };
  }

  res.json({ application: result.rows[0], invitePreview });
});

export default router;
