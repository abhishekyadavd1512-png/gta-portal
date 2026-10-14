import { Router } from 'express';
import { q } from '../db.js';

const router = Router();

// Courses, grouped from Sections — this is what the Apply flow lists.
// Applicants apply to a Course; the specific Section (and hours) only get
// set once a faculty member assigns/hires them (see faculty.js).
// Only counts/surfaces ACTIVE sections (Edit Sections upgrade) — a course
// with zero active sections has nothing to apply for, so it's left out of
// the Apply flow's list entirely rather than showing "0 sections offered".
router.get('/courses', async (req, res) => {
  const result = await q(`
    SELECT c.*, count(s.id)::int AS "sectionCount"
    FROM "Course" c
    JOIN "Section" s ON s."courseId" = c.id AND s.active = true
    GROUP BY c.id
    ORDER BY c."courseCode" ASC
  `);
  res.json({ courses: result.rows });
});

// Raw sections (used by Admin's section management screen).
// Seats "open" = advertised capacity minus applicants already HIRED and
// assigned into that specific section.
router.get('/', async (req, res) => {
  const result = await q(`
    SELECT s.*,
      s."totalSeats" - COALESCE(SUM(CASE WHEN a.status = 'HIRED' THEN 1 ELSE 0 END), 0)::int AS "seatsOpen"
    FROM "Section" s
    LEFT JOIN "Application" a ON a."assignedSectionId" = s.id
    GROUP BY s.id
    ORDER BY s."courseCode" ASC
  `);
  res.json({ sections: result.rows });
});

export default router;
