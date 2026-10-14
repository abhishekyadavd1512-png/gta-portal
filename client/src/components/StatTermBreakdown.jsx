import { abbreviateTerm, termSortKey } from '../constants';

// Shared by the Faculty and Admin dashboards' summary stat rows. Counts a
// list of course applications by term, e.g. [['Fall 2026', 3],
// ['Spring 2027', 1]] — sorted chronologically (see termSortKey in
// constants.js), not alphabetically. Only includes terms that actually have
// at least one matching application; an empty term doesn't get a row.
export function breakdownByTerm(apps) {
  const counts = new Map();
  for (const a of apps) {
    if (!a.term) continue;
    counts.set(a.term, (counts.get(a.term) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => termSortKey(a[0]) - termSortKey(b[0]));
}

// Small per-term breakdown shown under a stat tile's main number, as
// compact pill badges that flow left-to-right and wrap only when they run
// out of room — e.g. "Fa26 3" "Sp27 1" side by side — so tiles stay close
// to the same height regardless of how many terms they cover, instead of
// growing a full-width row per term. Purely additional detail under the
// existing number/label; doesn't change the tile's layout, click behavior,
// or styling otherwise (safe to nest inside a <button className="stat-tile">,
// same as the existing .num/.lbl divs already are on Faculty's dashboard).
export function TermBreakdown({ rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="stat-tile-terms">
      {rows.map(([term, count]) => (
        <span key={term} className="stat-tile-term-badge">
          <span className="term-abbr">{abbreviateTerm(term)}</span>
          <span className="term-count">{count}</span>
        </span>
      ))}
    </div>
  );
}
