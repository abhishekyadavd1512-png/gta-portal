# GMU base tables (from the professor)

These three files are the real GMU reference data your professor sent (`GTABaseTables.zip`), exported from the production/registrar system:

- **`imported_sections.csv`** — 529 real course sections (Fall 2026 + Spring 2027), with real CRNs, instructors, and GTA-eligibility flags. **Wired in** — see `../import-real-sections.js`, which loads the 522 `active_status = true` rows into this app's own `Course`/`Section` tables, replacing the 4 fake demo courses from `seed.js`.
- **`departments.csv`** — 58 real GMU departments across 11 real colleges. **Not wired in yet.**
- **`majors.csv`** — 220 real GMU majors/programs, each linked to a department. **Not wired in yet.**

Departments and majors are kept here for later — the Program dropdown (`client/src/constants.js` → `PROGRAMS`) and College dropdown (`client/src/pages/applicant/Profile.jsx` → `COLLEGES`) still use their original short placeholder lists. Swapping those in is a separate, bigger change (new API endpoint(s) to serve department/major data, and a decision on whether to keep a single flat Program dropdown or build cascading College → Department → Major dropdowns) — ask Claude to do that when you're ready.

Note: `imported_sections.csv` doesn't include room/meeting-time or seat-capacity data (it tracks CRN/instructor/GTA-assignment, not scheduling). Every imported `Section` gets a placeholder `meetingTime` and `totalSeats = 1` — correct seat counts by hand later from the Admin → Course Sections panel if needed.
