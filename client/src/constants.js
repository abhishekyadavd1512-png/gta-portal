// Shared dropdown option lists reused across more than one page — kept here
// so a value picked in one place (e.g. Profile) always matches a value
// picked in another (e.g. Apply), which matters wherever the server does an
// exact-string filter/match on these fields (see faculty.js's `program`
// query filter and Dashboard.jsx's program filter dropdown, which is built
// from whatever distinct strings actually show up in the data).

export const PROGRAMS = [
  'MS Computer Science',
  'MS Information Technology',
  'MS Data Analytics Engineering',
  'PhD Computer Science',
];

// Reasonable default; not pulled from a live Dataverse/registrar Choice
// column — edit to match the exact option set from the original app
// whenever that list is available (see Profile.jsx's header comment).
export const DEGREE_LEVELS = ["Bachelor's", "Master's", 'PhD', 'Other'];

const TERM_ORDER = ['Spring', 'Summer', 'Fall'];

// Generates a rolling list of "<Semester> <Year>" options starting from the
// current term (so it never needs manual updating as terms pass), e.g.
// "Fall 2026", "Spring 2027", "Summer 2027", ... `count` terms ahead.
export function buildUpcomingTermOptions(count = 18) {
  const now = new Date();
  const month = now.getMonth(); // 0 = Jan
  let termIdx = month <= 4 ? 0 : month <= 6 ? 1 : 2; // Spring: Jan-May, Summer: Jun-Jul, Fall: Aug-Dec
  let year = now.getFullYear();
  const options = [];
  for (let i = 0; i < count; i++) {
    options.push(`${TERM_ORDER[termIdx]} ${year}`);
    termIdx++;
    if (termIdx > 2) { termIdx = 0; year++; }
  }
  return options;
}

// Generates a rolling list of graduation years starting from the current
// calendar year, e.g. ["2026", "2027", ..., ].
export function buildUpcomingYearOptions(count = 9) {
  const start = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => String(start + i));
}
