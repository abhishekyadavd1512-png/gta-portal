// Seeds ONLY reference data (open course sections for the term) — no applicant,
// faculty, or application records. Matches the standing "no fake persona data"
// rule from the mockup: every user and application is real, created by real
// sign-ins/submissions, never pre-loaded.
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sections = [
  { courseCode: 'CS 540', courseTitle: 'Intro to AI', term: 'Spring 2027', meetingTime: 'Tue/Thu 10:30am', totalSeats: 3 },
  { courseCode: 'IT 306', courseTitle: 'Web App Dev', term: 'Spring 2027', meetingTime: 'Mon/Wed 1:30pm', totalSeats: 1 },
  { courseCode: 'CS 321', courseTitle: 'Object-Oriented Design', term: 'Spring 2027', meetingTime: 'Tue/Thu 3:00pm', totalSeats: 4 },
  { courseCode: 'STAT 346', courseTitle: 'Applied Probability', term: 'Spring 2027', meetingTime: 'Mon/Wed/Fri 9:00am', totalSeats: 2 },
];

const run = async () => {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM "Section"');
  if (rows[0].n > 0) {
    console.log('Sections already seeded, skipping.');
    await pool.end();
    return;
  }
  for (const s of sections) {
    await pool.query(
      'INSERT INTO "Section" ("courseCode","courseTitle",term,"meetingTime","totalSeats") VALUES ($1,$2,$3,$4,$5)',
      [s.courseCode, s.courseTitle, s.term, s.meetingTime, s.totalSeats]
    );
  }
  console.log(`Seeded ${sections.length} sections.`);
  await pool.end();
};

run().catch((err) => { console.error(err); process.exit(1); });
