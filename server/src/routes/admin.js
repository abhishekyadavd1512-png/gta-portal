// Minimal Admin scope, scaffolded ahead of the IST use cases per the board's
// three-role split (applicant/faculty/admin). Deliberately small right now —
// just enough to prove the role exists end-to-end (its own login, its own
// screen, its own protected API) — real admin capabilities (group sync,
// catalog export, CLSS update, etc. per the architecture doc's "Admin
// maintenance" note) get built once the use cases define what's needed.
import { Router } from 'express';
import { q } from '../db.js';
import { toPublicUser } from '../auth.js';

const router = Router();

router.get('/users', async (req, res) => {
  const result = await q('SELECT * FROM "User" ORDER BY "createdAt" DESC');
  res.json({ users: result.rows.map(toPublicUser) });
});

router.get('/sections', async (req, res) => {
  const result = await q('SELECT * FROM "Section" ORDER BY "courseCode" ASC');
  res.json({ sections: result.rows });
});

// Sections belong to a Course (courseCode + term); find-or-create the
// Course row so admin doesn't have to manage Courses as a separate step.
router.post('/sections', async (req, res) => {
  const { courseCode, courseTitle, term, meetingTime, totalSeats, hourOptions } = req.body || {};
  if (!courseCode || !courseTitle || !term || !meetingTime || !totalSeats) {
    return res.status(400).json({ error: 'courseCode, courseTitle, term, meetingTime, and totalSeats are required' });
  }
  const cleanedHourOptions = (hourOptions || '5,6.7,10')
    .split(',').map((v) => v.trim()).filter(Boolean).join(',');

  let course = (await q('SELECT * FROM "Course" WHERE "courseCode" = $1 AND term = $2', [courseCode, term])).rows[0];
  if (!course) {
    course = (await q(
      'INSERT INTO "Course" ("courseCode","courseTitle",term) VALUES ($1,$2,$3) RETURNING *',
      [courseCode, courseTitle, term]
    )).rows[0];
  }

  const result = await q(
    `INSERT INTO "Section" ("courseId","courseCode","courseTitle",term,"meetingTime","totalSeats","hourOptions")
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [course.id, courseCode, courseTitle, term, meetingTime, Number(totalSeats), cleanedHourOptions]
  );
  res.status(201).json({ section: result.rows[0] });
});

router.delete('/sections/:id', async (req, res) => {
  const inUse = await q('SELECT count(*)::int AS n FROM "Application" WHERE "assignedSectionId" = $1', [req.params.id]);
  if (inUse.rows[0].n > 0) {
    return res.status(409).json({ error: 'Cannot delete a section that already has a hired applicant assigned to it.' });
  }
  await q('DELETE FROM "Section" WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
