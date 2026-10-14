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

export const TERM_ORDER = ['Spring', 'Summer', 'Fall'];

// Short form for the Faculty/Admin dashboards' per-term stat breakdowns,
// e.g. "Fall 2026" -> "Fa26", "Spring 2027" -> "Sp27" — matches the
// "<Semester> <Year>" convention used everywhere terms are stored/generated
// (see buildUpcomingTermOptions below). Falls back to the raw term string
// for anything that doesn't match that shape (e.g. legacy/manually-typed
// terms), so it never silently hides a term it can't parse.
const SEASON_ABBR = { Spring: 'Sp', Summer: 'Su', Fall: 'Fa' };
export function abbreviateTerm(term) {
  const match = /^(Spring|Summer|Fall)\s+(\d{4})$/.exec(term || '');
  if (!match) return term || '';
  return `${SEASON_ABBR[match[1]]}${match[2].slice(-2)}`;
}

// Chronological sort key for "<Semester> <Year>" terms, so a per-term
// breakdown lists terms in the order they actually happen (Spring, then
// Summer, then Fall of the same year) instead of alphabetically. Unparseable
// terms sort first (key 0) rather than being dropped.
export function termSortKey(term) {
  const match = /^(Spring|Summer|Fall)\s+(\d{4})$/.exec(term || '');
  if (!match) return 0;
  return Number(match[2]) * 3 + TERM_ORDER.indexOf(match[1]);
}

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
