// One-time import: replaces the 4 fake demo courses (CS 540, IT 306, CS 321,
// STAT 346 — from seed.js) with the REAL Fall 2026 / Spring 2027 GTA-eligible
// course catalog your professor sent (server/prisma/gmu-data/imported_sections.csv).
//
// Only imported_sections.csv is wired into the app here — courses/sections are
// still stored in this app's own Course/Section tables (not as new tables), so
// no schema change is needed. departments.csv and majors.csv are kept in
// gmu-data/ for later, but are NOT used yet (Program/College dropdowns are
// unchanged — see client/src/constants.js and Profile.jsx).
//
// Safe to re-run: course/section upserts use ON CONFLICT, and the one-time
// fake-course cleanup only touches rows matching the exact 4 fake
// courseCode+term pairs from seed.js (never touches anything added since,
// via Admin or a real applicant).
//
// meetingTime and totalSeats aren't in the professor's export (it tracks CRN/
// instructor/assignment, not room/time/capacity), so every imported Section
// gets a placeholder meetingTime and totalSeats = 1. Admin can correct a
// section's seat count later from the admin Course Sections panel if needed.
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Minimal RFC4180 line parser (quoted fields, embedded commas) — this file
// has no embedded newlines inside quoted fields, so line-by-line is safe.
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

function loadImportedSections() {
  const raw = readFileSync(join(__dirname, 'gmu-data', 'imported_sections.csv'), 'utf8');
  const lines = raw.split('\n').filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  const idx = (col) => header.indexOf(col);
  const rows = lines.slice(1).map((line) => {
    const f = parseCsvLine(line);
    return {
      course: f[idx('course')],
      courseTitle: f[idx('course_title')],
      term: f[idx('term')],
      section: f[idx('section')],
      crn: f[idx('crn')],
      instructor: f[idx('instructor')] || null,
      activeStatus: f[idx('active_status')] === 'true',
    };
  });
  return rows.filter((r) => r.activeStatus);
}

// The 4 fake demo courses originally loaded by seed.js — only these are
// cleared out, never anything added since.
const FAKE_COURSES = [
  ['CS 540', 'Spring 2027'],
  ['IT 306', 'Spring 2027'],
  ['CS 321', 'Spring 2027'],
  ['STAT 346', 'Spring 2027'],
];

const run = async () => {
  const rows = loadImportedSections();
  console.log(`Loaded ${rows.length} active GTA-eligible sections from imported_sections.csv.`);

  // --- 1. Clear out the old fake demo courses (and anything applied to them) ---
  for (const [courseCode, term] of FAKE_COURSES) {
    const course = (await pool.query(
      'SELECT id FROM "Course" WHERE "courseCode" = $1 AND term = $2',
      [courseCode, term]
    )).rows[0];
    if (!course) continue;

    const apps = await pool.query('DELETE FROM "Application" WHERE "courseId" = $1', [course.id]);
    if (apps.rowCount > 0) {
      console.log(`  Removed ${apps.rowCount} application(s) that referenced fake course ${courseCode} (${term}).`);
    }
    await pool.query('DELETE FROM "Section" WHERE "courseId" = $1', [course.id]);
    await pool.query('DELETE FROM "Course" WHERE id = $1', [course.id]);
    console.log(`  Removed fake course ${courseCode} (${term}).`);
  }

  // --- 2. Upsert real Course rows (one per distinct course+term) ---
  const courseIdByKey = new Map();
  const seenCourseKeys = new Set();
  for (const r of rows) seenCourseKeys.add(`${r.course}|||${r.term}`);

  for (const key of seenCourseKeys) {
    const [courseCode, term] = key.split('|||');
    const title = rows.find((r) => r.course === courseCode && r.term === term).courseTitle;
    const { rows: [course] } = await pool.query(
      `INSERT INTO "Course" ("courseCode","courseTitle",term) VALUES ($1,$2,$3)
       ON CONFLICT ("courseCode", term) DO UPDATE SET "courseTitle" = EXCLUDED."courseTitle"
       RETURNING id`,
      [courseCode, title, term]
    );
    courseIdByKey.set(key, course.id);
  }
  console.log(`Upserted ${seenCourseKeys.size} real courses.`);

  // --- 3. Upsert real Section rows (one per CRN) ---
  let sectionCount = 0;
  for (const r of rows) {
    const courseId = courseIdByKey.get(`${r.course}|||${r.term}`);
    await pool.query(
      `INSERT INTO "Section"
         ("courseId","courseCode","courseTitle",term,"meetingTime","totalSeats","crn","instructor","hourOptions")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (crn) WHERE crn IS NOT NULL
       DO UPDATE SET "courseTitle" = EXCLUDED."courseTitle", instructor = EXCLUDED.instructor`,
      [
        courseId,
        r.course,
        r.courseTitle,
        r.term,
        `Section ${r.section} — meeting time TBD (see registrar)`,
        1,
        r.crn,
        r.instructor,
        '5,6.7,10',
      ]
    );
    sectionCount++;
  }
  console.log(`Upserted ${sectionCount} real sections.`);

  await pool.end();
};

run().catch((err) => { console.error(err); process.exit(1); });
