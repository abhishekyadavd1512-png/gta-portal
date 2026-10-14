// Admin scope — scaffolded ahead of the IST use cases per the board's
// three-role split (applicant/faculty/admin), grown as real admin
// capabilities get built. Covers: user visibility + the Applications
// Dashboard "Block" action, and section/course management including a
// CourseLeaf CLSS bulk import (Edit Sections upgrade, 2026-10-06).
import { Router } from 'express';
import multer from 'multer';
import { q, pool } from '../db.js';
import { toPublicUser } from '../auth.js';
import { computeOfferLetterStatus } from '../lib/offerLetter.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/users', async (req, res) => {
  const result = await q('SELECT * FROM "User" ORDER BY "createdAt" DESC');
  res.json({ users: result.rows.map(toPublicUser) });
});

// Applications Dashboard "Block" action — prevents an applicant from
// submitting NEW applications (enforced in applications.js's POST /) without
// touching anything they've already submitted or been assigned to.
router.patch('/users/:id/block', async (req, res) => {
  const { blocked } = req.body || {};
  if (typeof blocked !== 'boolean') {
    return res.status(400).json({ error: 'blocked must be true or false' });
  }
  const result = await q('UPDATE "User" SET blocked = $1 WHERE id = $2 RETURNING *', [blocked, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: toPublicUser(result.rows[0]) });
});

// Includes who (if anyone) is currently HIRED into each section, read-only,
// for the Edit Sections table — a section can have more than one GTA hired
// into it (e.g. two applicants split hours on the same IT 492 section).
router.get('/sections', async (req, res) => {
  const result = await q(`
    SELECT s.*,
      COALESCE(
        (SELECT json_agg(json_build_object('applicationId', a.id, 'name', u.name, 'email', u.email, 'hours', a.hours) ORDER BY u.name)
         FROM "Application" a JOIN "User" u ON u.id = a."applicantId"
         WHERE a."assignedSectionId" = s.id AND a.status = 'HIRED'),
        '[]'
      ) AS "assignedApplicants"
    FROM "Section" s
    ORDER BY s."courseCode" ASC, s.term ASC
  `);
  res.json({ sections: result.rows });
});

// Sections belong to a Course (courseCode + term); find-or-create the
// Course row so admin doesn't have to manage Courses as a separate step.
router.post('/sections', async (req, res) => {
  const { courseCode, courseTitle, term, meetingTime, totalSeats, hourOptions, crn, instructor, active, countsTowardCap } = req.body || {};
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

  try {
    const result = await q(
      `INSERT INTO "Section" ("courseId","courseCode","courseTitle",term,"meetingTime","totalSeats","hourOptions","crn","instructor","active","countsTowardCap")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [course.id, courseCode, courseTitle, term, meetingTime, Number(totalSeats), cleanedHourOptions, crn || null, instructor || null, active !== false, countsTowardCap !== false]
    );
    res.status(201).json({ section: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `CRN ${crn} is already in use by another section.` });
    throw err;
  }
});

// Edit Sections table's Active / Counts-toward-cap checkboxes.
router.patch('/sections/:id', async (req, res) => {
  const { active, countsTowardCap } = req.body || {};
  const updates = [];
  const values = [];
  let i = 1;
  if (active !== undefined) { updates.push(`active = $${i++}`); values.push(!!active); }
  if (countsTowardCap !== undefined) { updates.push(`"countsTowardCap" = $${i++}`); values.push(!!countsTowardCap); }
  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  values.push(req.params.id);
  const result = await q(`UPDATE "Section" SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values);
  if (!result.rows[0]) return res.status(404).json({ error: 'Section not found' });
  res.json({ section: result.rows[0] });
});

router.delete('/sections/:id', async (req, res) => {
  const inUse = await q('SELECT count(*)::int AS n FROM "Application" WHERE "assignedSectionId" = $1', [req.params.id]);
  if (inUse.rows[0].n > 0) {
    return res.status(409).json({ error: 'Cannot delete a section that already has a hired applicant assigned to it.' });
  }
  await q('DELETE FROM "Section" WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- CourseLeaf CLSS import -------------------------------------------------
// Minimal RFC4180 line parser (quoted fields, embedded commas) — same one
// used by prisma/import-real-sections.js.
function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

// A CLSS export has blank spacer rows/columns above the real header, so the
// header row is located automatically: the first row (within the first 20
// non-empty lines) that has recognizable columns for CRN, Term, Course and
// Section. Course Title and Instructor are used when present but optional.
function cleanHeaderCell(cell) {
  return (cell || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function locateHeader(lines) {
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const cells = parseCsvLine(lines[i]).map(cleanHeaderCell);
    const find = (...names) => cells.findIndex((c) => names.includes(c));
    const idx = {
      crn: find('crn'),
      term: find('term'),
      course: find('course'),
      section: find('section'),
      courseTitle: find('course title', 'title'),
      instructor: find('instructor'),
    };
    if (idx.crn >= 0 && idx.term >= 0 && idx.course >= 0 && idx.section >= 0) {
      return { headerRow: i, idx };
    }
  }
  return null;
}

router.post('/sections/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const removeNotInFile = req.body?.removeNotInFile === 'true' || req.body?.removeNotInFile === true;

  const nameLower = (req.file.originalname || '').toLowerCase();
  if (!nameLower.endsWith('.csv') && !nameLower.endsWith('.txt')) {
    return res.status(400).json({
      error: 'Only .csv files are supported right now (not .xlsx) — the Excel-reading library available for this project has known unpatched security issues, so it was left out on purpose. If your CLSS export is an .xlsx file, open it in Excel/Numbers/Sheets and "Save As" / "Export" to CSV first, then upload that.',
    });
  }

  const raw = req.file.buffer.toString('utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const located = locateHeader(lines);
  if (!located) {
    return res.status(400).json({ error: "Couldn't find a header row with CRN, Term, Course, and Section columns in this file." });
  }
  const { headerRow, idx } = located;

  const rows = [];
  for (const line of lines.slice(headerRow + 1)) {
    const f = parseCsvLine(line);
    const crn = (f[idx.crn] || '').trim();
    const term = (f[idx.term] || '').trim();
    const course = (f[idx.course] || '').trim();
    const section = (f[idx.section] || '').trim();
    if (!crn || !term || !course) continue; // blank spacer row
    rows.push({
      crn,
      term,
      course,
      section,
      courseTitle: idx.courseTitle >= 0 ? (f[idx.courseTitle] || '').trim() : course,
      instructor: idx.instructor >= 0 ? (f[idx.instructor] || '').trim() || null : null,
    });
  }
  if (rows.length === 0) {
    return res.status(400).json({ error: 'No data rows found under the header.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Upsert Course rows (one per distinct course+term).
    const courseIdByKey = new Map();
    const seenCourseKeys = new Map();
    for (const r of rows) seenCourseKeys.set(`${r.course}|||${r.term}`, r.courseTitle);
    for (const [key, title] of seenCourseKeys) {
      const [courseCode, term] = key.split('|||');
      const { rows: [course] } = await client.query(
        `INSERT INTO "Course" ("courseCode","courseTitle",term) VALUES ($1,$2,$3)
         ON CONFLICT ("courseCode", term) DO UPDATE SET "courseTitle" = EXCLUDED."courseTitle"
         RETURNING id`,
        [courseCode, title, term]
      );
      courseIdByKey.set(key, course.id);
    }

    // 2. Upsert Section rows, one per CRN. New sections get a placeholder
    // meeting time/seat count (CLSS exports in this format don't carry
    // room/time/capacity) — an admin can correct those from this same table
    // afterward. Re-importing an existing CRN only refreshes its instructor,
    // leaving meeting time / seats / hour options / active / counts-toward-
    // cap exactly as an admin last set them.
    let created = 0, updated = 0;
    for (const r of rows) {
      const courseId = courseIdByKey.get(`${r.course}|||${r.term}`);
      const result = await client.query(
        `INSERT INTO "Section"
           ("courseId","courseCode","courseTitle",term,"meetingTime","totalSeats","crn","instructor","hourOptions")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (crn) WHERE crn IS NOT NULL
         DO UPDATE SET instructor = EXCLUDED.instructor
         RETURNING (xmax = 0) AS inserted`,
        [courseId, r.course, r.courseTitle, r.term, `Section ${r.section} — meeting time TBD (see registrar)`, 20, r.crn, r.instructor, '5,6.7,10']
      );
      if (result.rows[0].inserted) created++; else updated++;
    }

    // 3. Optionally remove sections of any term this file covers that
    // weren't in the file. A section with an existing hire isn't deleted —
    // it's deactivated instead, and the affected hire(s) are reverted to
    // Pending so faculty/admin can reassign them (reported back as
    // studentsReassigned, not left as a silent broken reference).
    let removedDeleted = 0, removedDeactivated = 0, studentsReassigned = 0;
    if (removeNotInFile) {
      const termsInFile = [...new Set(rows.map((r) => r.term))];
      for (const term of termsInFile) {
        const crnsInFile = rows.filter((r) => r.term === term).map((r) => r.crn);
        const candidates = await client.query(
          `SELECT id FROM "Section" WHERE term = $1 AND (crn IS NULL OR crn <> ALL($2))`,
          [term, crnsInFile]
        );
        for (const { id: sectionId } of candidates.rows) {
          const inUse = await client.query('SELECT id FROM "Application" WHERE "assignedSectionId" = $1 AND status = \'HIRED\'', [sectionId]);
          if (inUse.rows.length > 0) {
            await client.query('UPDATE "Section" SET active = false WHERE id = $1', [sectionId]);
            await client.query(
              `UPDATE "Application" SET status = 'PENDING', "assignedSectionId" = NULL, hours = NULL, "updatedAt" = now() WHERE id = ANY($1)`,
              [inUse.rows.map((r) => r.id)]
            );
            removedDeactivated++;
            studentsReassigned += inUse.rows.length;
          } else {
            await client.query('DELETE FROM "Section" WHERE id = $1', [sectionId]);
            removedDeleted++;
          }
        }
      }
    }

    await client.query('COMMIT');
    res.json({ created, updated, removedDeleted, removedDeactivated, studentsReassigned, rowsRead: rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// "Delete Semester" — wipes every section, application, and course for one
// term (FK-safe order: Application -> Section -> Course). Scoped to one
// term, unlike the full reset below.
router.delete('/sections/term/:term', async (req, res) => {
  const term = req.params.term;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const apps = await client.query(
      `DELETE FROM "Application" WHERE "courseId" IN (SELECT id FROM "Course" WHERE term = $1)`,
      [term]
    );
    const sections = await client.query('DELETE FROM "Section" WHERE term = $1', [term]);
    const courses = await client.query('DELETE FROM "Course" WHERE term = $1', [term]);
    await client.query('COMMIT');
    res.json({ applicationsDeleted: apps.rowCount, sectionsDeleted: sections.rowCount, coursesDeleted: courses.rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Danger Zone — full reset across every term. Profiles (Users) are kept.
// Requires the typed "RESET" confirmation in the body, in addition to
// whatever the client-side UI requires, since this is irreversible.
router.post('/reset', async (req, res) => {
  if (req.body?.confirm !== 'RESET') {
    return res.status(400).json({ error: 'Type RESET to confirm this action.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const apps = await client.query('DELETE FROM "Application"');
    const sections = await client.query('DELETE FROM "Section"');
    const courses = await client.query('DELETE FROM "Course"');
    await client.query('COMMIT');
    res.json({ applicationsDeleted: apps.rowCount, sectionsDeleted: sections.rowCount, coursesDeleted: courses.rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// --- Offer Letter hand-off (Power Automate) ---------------------------------
// See lib/offerLetter.js for the full board-feedback context (item 4,
// "Offer Letter — SharePoint"). This endpoint requires
// POWER_AUTOMATE_OFFER_LETTER_WEBHOOK_URL to be set in the server's
// environment — until someone with Microsoft 365/Power Platform access has
// built and published that Flow and configured its HTTP-trigger URL here,
// this refuses to do anything. Even once configured, nothing is ever sent
// except when an admin explicitly clicks "Trigger Offer Letter Flow" on the
// dashboard — there is no automatic/background trigger anywhere in this app.
// What the Flow itself does with the data it receives (generate the letter,
// save it to SharePoint, notify the student) is entirely outside this app's
// knowledge or control; this endpoint's job ends at handing the data off.
async function getOfferReadyApplications() {
  const result = await q(`
    SELECT a.*, u.name AS "applicantName", u.email AS "applicantEmail", u.program, u.gpa,
           u."isFinalSemester", u."coursesRegisteredNextTerm", u."tuitionStatus",
           c."courseCode", c."courseTitle", c.term,
           s."meetingTime" AS "assignedMeetingTime", s.instructor AS "assignedInstructor", s.crn AS "assignedCrn"
    FROM "Application" a
    JOIN "User" u ON u.id = a."applicantId"
    JOIN "Course" c ON c.id = a."courseId"
    LEFT JOIN "Section" s ON s.id = a."assignedSectionId"
    WHERE a.status = 'HIRED'
    ORDER BY u.name ASC
  `);
  return result.rows
    .map((a) => ({ ...a, ...computeOfferLetterStatus(a) }))
    .filter((a) => a.offerLetterReady);
}

// Lets the dashboard show an accurate disabled/enabled state (and a helpful
// "not configured yet" message) before the admin even clicks anything.
router.get('/offer-letters/config', (req, res) => {
  res.json({ configured: !!process.env.POWER_AUTOMATE_OFFER_LETTER_WEBHOOK_URL });
});

router.post('/offer-letters/trigger', async (req, res) => {
  const webhookUrl = process.env.POWER_AUTOMATE_OFFER_LETTER_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(501).json({
      error: "Power Automate isn't configured yet. Ask whoever manages the Flow for its HTTP-trigger URL, then set POWER_AUTOMATE_OFFER_LETTER_WEBHOOK_URL in the server environment.",
    });
  }

  const ready = await getOfferReadyApplications();
  if (ready.length === 0) {
    return res.status(400).json({ error: 'No applicants are Offer Letter Ready right now.' });
  }

  const payload = {
    triggeredBy: req.user.email,
    triggeredAt: new Date().toISOString(),
    offers: ready.map((a) => ({
      applicationId: a.id,
      applicantName: a.applicantName,
      applicantEmail: a.applicantEmail,
      program: a.program || null,
      term: a.term,
      courseCode: a.courseCode,
      courseTitle: a.courseTitle,
      section: a.assignedMeetingTime || null,
      crn: a.assignedCrn || null,
      faculty: a.assignedInstructor || null,
      hours: a.hours != null ? Number(a.hours) : null,
    })),
  };

  let webhookRes;
  try {
    webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Optional defense-in-depth on top of the webhook URL's own
        // signature — only sent when configured.
        ...(process.env.POWER_AUTOMATE_WEBHOOK_SECRET ? { 'X-Webhook-Secret': process.env.POWER_AUTOMATE_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Power Automate webhook call failed:', err);
    return res.status(502).json({ error: 'Could not reach the Power Automate flow. Check the webhook URL and try again.' });
  }

  if (!webhookRes.ok) {
    const bodyText = await webhookRes.text().catch(() => '');
    console.error('Power Automate webhook returned an error:', webhookRes.status, bodyText);
    return res.status(502).json({ error: `The Power Automate flow rejected the request (HTTP ${webhookRes.status}).` });
  }

  console.log(`Offer Letter Flow triggered by ${req.user.email} for ${ready.length} applicant(s) at ${payload.triggeredAt}`);
  res.json({ sent: ready.length, triggeredAt: payload.triggeredAt });
});

export default router;
