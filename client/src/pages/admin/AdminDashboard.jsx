import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { breakdownByTerm, TermBreakdown } from '../../components/StatTermBreakdown';

// Admin's "Applications Dashboard" — groups the same application rows
// Faculty sees (GET /faculty/applications, which ADMIN is also allowed to
// call) by applicant + term, matching how a GTA program admin actually
// thinks about a person ("what is Emily Chen up to this term") rather than
// one row per course application. Adds three things Faculty's dashboard
// doesn't have: Block/Unblock, a "Make Offer" shortcut straight into the
// existing Assign-to-Section flow, and "Undo Fully Assign" (bulk-revert
// every HIRED course for that person/term back to Pending).
const STATUS_LABEL = { PENDING: 'Pending', INTERVIEW: 'Interview', HIRED: 'Hired' };

// Remembers when "Export Offer Ready" was last clicked, per browser — purely
// informational (so an admin can tell at a glance whether today's export
// already happened), not synced anywhere.
const LAST_EXPORT_KEY = 'gta_admin_offer_ready_export_at';
// Same idea, for "Trigger Offer Letter Flow".
const LAST_FLOW_TRIGGER_KEY = 'gta_admin_offer_letter_flow_triggered_at';

function lastNameOf(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  return parts[parts.length - 1] || '';
}

export default function AdminDashboard() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState(''); // '', 'assigned', 'unassigned'
  const [showBlocked, setShowBlocked] = useState(false);
  const [sortDir, setSortDir] = useState('asc');
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState({ program: true, term: true });
  const [expanded, setExpanded] = useState({});
  const [autoAssignKey, setAutoAssignKey] = useState(null); // `${groupKey}:${applicationId}` to auto-open Assign on render
  const [undoingKey, setUndoingKey] = useState(null);
  const [blockingId, setBlockingId] = useState(null);
  const [lastExportedAt, setLastExportedAt] = useState(() => {
    try { return localStorage.getItem(LAST_EXPORT_KEY); } catch { return null; }
  });
  const [flowConfigured, setFlowConfigured] = useState(false);
  const [triggeringFlow, setTriggeringFlow] = useState(false);
  const [flowError, setFlowError] = useState('');
  const [lastFlowTriggeredAt, setLastFlowTriggeredAt] = useState(() => {
    try { return localStorage.getItem(LAST_FLOW_TRIGGER_KEY); } catch { return null; }
  });

  const load = (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    api.getFacultyApplications().then((data) => { setApplications(data.applications); setLoading(false); });
  };
  useEffect(() => load(true), []);
  // Whether someone has configured POWER_AUTOMATE_OFFER_LETTER_WEBHOOK_URL
  // on the server — checked once on load so the button can show an accurate
  // disabled state/tooltip before anyone clicks it.
  useEffect(() => { api.adminGetOfferLetterFlowConfig().then((data) => setFlowConfigured(!!data.configured)).catch(() => setFlowConfigured(false)); }, []);

  const programs = useMemo(() => [...new Set(applications.map((a) => a.program).filter(Boolean))], [applications]);
  const terms = useMemo(() => [...new Set(applications.map((a) => a.term).filter(Boolean))], [applications]);

  // Summary counts (same shape as Faculty's stat row) — counted per course
  // APPLICATION, not per applicant: someone with two applications, whether
  // across two different semesters or two courses in the same semester,
  // counts as two separate instances here, same as Faculty's dashboard
  // already does. This intentionally does not follow the admin table's
  // applicant+term grouping below.
  const stats = useMemo(() => {
    const pending = applications.filter((a) => a.status === 'PENDING');
    const interview = applications.filter((a) => a.status === 'INTERVIEW');
    const hired = applications.filter((a) => a.status === 'HIRED');
    const offerReady = applications.filter((a) => a.offerLetterReady);
    return {
      total: applications.length,
      totalByTerm: breakdownByTerm(applications),
      PENDING: pending.length,
      PENDINGByTerm: breakdownByTerm(pending),
      INTERVIEW: interview.length,
      INTERVIEWByTerm: breakdownByTerm(interview),
      HIRED: hired.length,
      HIREDByTerm: breakdownByTerm(hired),
      offerReady: offerReady.length,
      offerReadyByTerm: breakdownByTerm(offerReady),
    };
  }, [applications]);

  // Every HIRED + Offer Letter Ready course application, independent of the
  // toolbar's search/program/term/assigned filters or of how many
  // applicants or courses are involved — the export always covers all of
  // them at once.
  const offerReadyApplications = useMemo(
    () => applications.filter((a) => a.status === 'HIRED' && a.offerLetterReady),
    [applications]
  );

  // Group applications by applicant + term.
  const groups = useMemo(() => {
    const map = new Map();
    for (const a of applications) {
      const key = `${a.applicantId}|||${a.term}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          applicantId: a.applicantId,
          applicantName: a.applicantName,
          applicantEmail: a.applicantEmail,
          program: a.program,
          term: a.term,
          blocked: a.applicantBlocked,
          termHours: Number(a.applicantTermHours) || 0,
          courses: [],
        });
      }
      map.get(key).courses.push(a);
    }
    return [...map.values()];
  }, [applications]);

  const filtered = useMemo(() => {
    let rows = groups.filter((g) => {
      if (!showBlocked && g.blocked) return false;
      if (programFilter && g.program !== programFilter) return false;
      if (termFilter && g.term !== termFilter) return false;
      const anyHired = g.courses.some((c) => c.status === 'HIRED');
      if (assignedFilter === 'assigned' && !anyHired) return false;
      if (assignedFilter === 'unassigned' && anyHired) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!g.applicantName.toLowerCase().includes(s) && !g.applicantEmail.toLowerCase().includes(s)) return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      const av = lastNameOf(a.applicantName).toLowerCase();
      const bv = lastNameOf(b.applicantName).toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [groups, showBlocked, programFilter, termFilter, assignedFilter, search, sortDir]);

  const toggleExpand = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const makeOffer = (group) => {
    const pending = group.courses.find((c) => c.status === 'PENDING');
    if (!pending) return;
    setExpanded((prev) => ({ ...prev, [group.key]: true }));
    setAutoAssignKey(`${group.key}:${pending.id}`);
  };

  const undoFullyAssign = async (group) => {
    const hired = group.courses.filter((c) => c.status === 'HIRED');
    if (hired.length === 0) return;
    setUndoingKey(group.key);
    try {
      await Promise.all(hired.map((c) => api.updateApplicationStatus(c.id, 'PENDING')));
      load(false);
    } finally {
      setUndoingKey(null);
    }
  };

  const toggleBlock = async (group) => {
    setBlockingId(group.applicantId);
    try {
      await api.adminSetUserBlocked(group.applicantId, !group.blocked);
      load(false);
    } finally {
      setBlockingId(null);
    }
  };

  const assign = async (id, sectionId, hours) => {
    const res = await api.assignApplication(id, sectionId, hours);
    load(false);
    return res;
  };
  const updateStatus = async (id, status, extra) => {
    const res = await api.updateApplicationStatus(id, status, extra);
    load(false);
    return res;
  };

  // Downloads every Offer Letter Ready hire as a CSV — the same hand-off
  // point as Faculty's "Export CSV" (board feedback item 4): this is what
  // gets manually injected into SharePoint, the app itself never talks to
  // SharePoint or sends anything automatically.
  const exportOfferReady = () => {
    if (offerReadyApplications.length === 0) return;
    const header = ['Applicant', 'Email', 'Program', 'Term', 'Course', 'Section', 'CRN', 'Faculty', 'Hours'];
    const rows = offerReadyApplications.map((a) => [
      a.applicantName,
      a.applicantEmail,
      a.program || '',
      a.term,
      `${a.courseCode} — ${a.courseTitle}`,
      a.assignedMeetingTime || '',
      a.assignedCrn || '',
      a.assignedInstructor || '',
      a.hours != null ? a.hours : '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `offer-ready-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const now = new Date().toISOString();
    try { localStorage.setItem(LAST_EXPORT_KEY, now); } catch { /* ignore */ }
    setLastExportedAt(now);
  };

  // Hands the same Offer Letter Ready data off to a Power Automate flow,
  // instead of a CSV download — but ONLY once someone with Microsoft
  // 365/Power Platform access has built and published that flow and set
  // POWER_AUTOMATE_OFFER_LETTER_WEBHOOK_URL on the server (flowConfigured,
  // checked on load). This is still a manual, human-clicked action every
  // time, same as Export Offer Ready — nothing here runs on its own.
  const triggerOfferLetterFlow = async () => {
    if (!flowConfigured || offerReadyApplications.length === 0 || triggeringFlow) return;
    if (!window.confirm(`Send ${offerReadyApplications.length} Offer Letter Ready applicant(s) to the configured Power Automate flow now? This hands their data off to that flow immediately.`)) return;
    setTriggeringFlow(true);
    setFlowError('');
    try {
      const result = await api.adminTriggerOfferLetterFlow();
      const now = result?.triggeredAt || new Date().toISOString();
      try { localStorage.setItem(LAST_FLOW_TRIGGER_KEY, now); } catch { /* ignore */ }
      setLastFlowTriggeredAt(now);
    } catch (err) {
      setFlowError(err.message);
    } finally {
      setTriggeringFlow(false);
    }
  };

  if (loading) return <div className="center-loading">Loading applications…</div>;

  return (
    <>
      <div className="stat-row">
        <div className="stat-tile">
          <div className="num">{stats.total}</div>
          <div className="lbl">Total Applications</div>
          <TermBreakdown rows={stats.totalByTerm} />
        </div>
        <div className="stat-tile">
          <div className="num">{stats.PENDING}</div>
          <div className="lbl">Pending Review</div>
          <TermBreakdown rows={stats.PENDINGByTerm} />
        </div>
        <div className="stat-tile" title="Interview scheduled">
          <div className="num">{stats.INTERVIEW}</div>
          <div className="lbl">To Be Interviewed</div>
          <TermBreakdown rows={stats.INTERVIEWByTerm} />
        </div>
        <div className="stat-tile">
          <div className="num">{stats.HIRED}</div>
          <div className="lbl">Hired / Assigned</div>
          <TermBreakdown rows={stats.HIREDByTerm} />
        </div>
        <div
          className="stat-tile"
          title="Fully assigned GTAs who also meet every Offer Letter requirement (GPA, courses registered, tuition status, hours worked outside GMU)"
        >
          <div className="num">{stats.offerReady}</div>
          <div className="lbl">Offer Letter Ready</div>
          <TermBreakdown rows={stats.offerReadyByTerm} />
        </div>
      </div>
      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <input type="search" placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
          <option value="">All programs</option>
          {programs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
          <option value="">All semesters</option>
          {terms.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
          <option value="asc">Sort by last name (A–Z)</option>
          <option value="desc">Sort by last name (Z–A)</option>
        </select>
        <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}>
          <option value="">All (assigned + unassigned)</option>
          <option value="assigned">Assigned only</option>
          <option value="unassigned">Unassigned only</option>
        </select>
      </div>
      <div className="toolbar" style={{ marginTop: -8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
          <input type="checkbox" checked={showBlocked} onChange={(e) => setShowBlocked(e.target.checked)} />
          Show blocked profiles
        </label>
        <div style={{ position: 'relative' }}>
          <button className="reset-link" onClick={() => setColumnsOpen(!columnsOpen)}>Show/Hide Columns ▾</button>
          {columnsOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 12, marginTop: 6, minWidth: 160 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 8 }}>
                <input type="checkbox" checked={visibleCols.program} onChange={(e) => setVisibleCols({ ...visibleCols, program: e.target.checked })} />
                Program
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={visibleCols.term} onChange={(e) => setVisibleCols({ ...visibleCols, term: e.target.checked })} />
                Semester
              </label>
            </div>
          )}
        </div>
        <button
          className="btn-export"
          disabled={offerReadyApplications.length === 0}
          title={offerReadyApplications.length === 0 ? 'No applicants are Offer Letter Ready yet' : `Download all ${offerReadyApplications.length} Offer Letter Ready hire(s) as a CSV for the SharePoint export`}
          onClick={exportOfferReady}
        >
          ⬇ Export Offer Ready{offerReadyApplications.length > 0 ? ` (${offerReadyApplications.length})` : ''}
        </button>
        {lastExportedAt && (
          <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>
            Last exported: {new Date(lastExportedAt).toLocaleString()}
          </span>
        )}
        <button
          className="btn-export"
          disabled={!flowConfigured || offerReadyApplications.length === 0 || triggeringFlow}
          title={
            !flowConfigured
              ? "Power Automate isn't configured on the server yet — ask whoever manages the Flow for its webhook URL"
              : offerReadyApplications.length === 0
                ? 'No applicants are Offer Letter Ready yet'
                : `Send all ${offerReadyApplications.length} Offer Letter Ready hire(s) to the configured Power Automate flow`
          }
          onClick={triggerOfferLetterFlow}
        >
          {triggeringFlow ? '… Sending' : `⚡ Trigger Offer Letter Flow${flowConfigured && offerReadyApplications.length > 0 ? ` (${offerReadyApplications.length})` : ''}`}
        </button>
        {lastFlowTriggeredAt && (
          <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>
            Last triggered: {new Date(lastFlowTriggeredAt).toLocaleString()}
          </span>
        )}
      </div>
      {flowError && <div className="error-banner">{flowError}</div>}
      <div className="result-count">{filtered.length} applicant{filtered.length === 1 ? '' : 's'}</div>
      <table className="app-table">
        <thead>
          <tr>
            <th>Name</th>
            {visibleCols.program && <th>Program</th>}
            {visibleCols.term && <th>Semester</th>}
            <th>Courses</th>
            <th></th>
            <th>Block</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((g) => {
            const anyHired = g.courses.some((c) => c.status === 'HIRED');
            const hasPending = g.courses.some((c) => c.status === 'PENDING');
            return (
              <Fragment key={g.key}>
                <tr className="app-row">
                  <td>
                    {g.applicantName}
                    {anyHired && <span className="pill HIRED" style={{ marginLeft: 8 }}>Assigned</span>}
                    {g.blocked && <span className="pill" style={{ marginLeft: 8, background: 'var(--danger-bg)', color: 'var(--danger)' }}>Blocked</span>}
                  </td>
                  {visibleCols.program && <td>{g.program || <em>Not provided</em>}</td>}
                  {visibleCols.term && <td>{g.term}</td>}
                  <td><button className="hire" onClick={() => toggleExpand(g.key)}>View Courses ({g.courses.length})</button></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {anyHired && (
                      <button className="reset-link" style={{ marginRight: 10 }} disabled={undoingKey === g.key} onClick={() => undoFullyAssign(g)}>
                        {undoingKey === g.key ? 'Undoing…' : 'Undo Fully Assign'}
                      </button>
                    )}
                    {hasPending && (
                      <button className="hire" onClick={() => makeOffer(g)}>Make Offer</button>
                    )}
                  </td>
                  <td>
                    <button
                      className="reset-link"
                      style={g.blocked ? {} : { color: 'var(--danger)' }}
                      disabled={blockingId === g.applicantId}
                      onClick={() => toggleBlock(g)}
                    >
                      {blockingId === g.applicantId ? '…' : (g.blocked ? 'Unblock' : 'Block')}
                    </button>
                  </td>
                </tr>
                {expanded[g.key] && (
                  <tr className="detail-row">
                    <td colSpan={6}>
                      <div className="detail-panel">
                        {g.courses.map((c) => (
                          <CourseRow
                            key={c.id}
                            application={c}
                            autoOpenAssign={autoAssignKey === `${g.key}:${c.id}`}
                            onAssignOpened={() => setAutoAssignKey(null)}
                            onAssign={assign}
                            onUpdateStatus={updateStatus}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {filtered.length === 0 && (
            <tr><td colSpan={6}><em>No applicants match these filters.</em></td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}

// One course application within an expanded applicant+term group — a
// trimmed version of Faculty Dashboard's per-row detail actions (same APIs,
// same Assign-to-Section flow), since the group header above already
// handles the expand/collapse. Interview scheduling lives only on Faculty's
// dashboard — that's faculty's call, not admin's — so this row only offers
// Assign to Section, a (preview-only) Send Offer Letter, and Move back to
// pending.
function CourseRow({ application: a, autoOpenAssign, onAssignOpened, onAssign, onUpdateStatus }) {
  const [assigning, setAssigning] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [sections, setSections] = useState([]);
  const [hoursAlreadyHired, setHoursAlreadyHired] = useState(0);
  const [hourCap, setHourCap] = useState(20.1);
  const [hoursBySection, setHoursBySection] = useState({});
  const [assignError, setAssignError] = useState('');
  const [assigningSectionId, setAssigningSectionId] = useState('');

  // Offer Letter itself is a manual, external SharePoint process (board
  // feedback, 2026-09-30, "Offer Letter — SharePoint" item 4) — the app
  // never talks to SharePoint. This button only previews what would be
  // handed off in that export; nothing is actually sent from here.
  const [offerLetterPreview, setOfferLetterPreview] = useState(null);

  const openAssign = async () => {
    setAssigning(true);
    setAssignError('');
    setLoadingSections(true);
    try {
      const data = await api.getApplicationSections(a.id);
      setSections(data.sections);
      setHoursAlreadyHired(data.hoursAlreadyHired);
      setHourCap(data.hourCap);
    } finally {
      setLoadingSections(false);
    }
  };

  useEffect(() => {
    if (autoOpenAssign) {
      openAssign();
      onAssignOpened();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAssign]);

  const confirmAssign = async (sectionId) => {
    const hours = hoursBySection[sectionId];
    if (!hours) return;
    setAssignError('');
    setAssigningSectionId(sectionId);
    try {
      await onAssign(a.id, sectionId, hours);
      setAssigning(false);
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssigningSectionId('');
    }
  };

  const hoursRemaining = Math.max(0, hourCap - hoursAlreadyHired);

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
      <div className="dp-grid" style={{ marginBottom: 10 }}>
        <dl>
          <dt>Course</dt><dd>{a.courseCode} — {a.courseTitle} · {a.term}</dd>
          <dt>Status</dt><dd><span className={`pill ${a.status}`}>{STATUS_LABEL[a.status]}</span></dd>
        </dl>
        <dl>
          <dt>Hours (Basis)</dt><dd>{a.hours != null ? `${a.hours} hrs/week` : <em>Not set</em>}</dd>
          <dt>Assigned section</dt><dd>{a.assignedMeetingTime || <em>Not set</em>}{a.assignedInstructor ? ` · ${a.assignedInstructor}` : ''}</dd>
        </dl>
      </div>

      {a.status === 'HIRED' && (
        <div className="dp-grid" style={{ marginTop: -8, marginBottom: 10 }}>
          <dl>
            <dt>Offer Letter</dt>
            <dd>
              {a.offerLetterReady ? (
                <span className="pill HIRED">✓ Ready</span>
              ) : (
                <>
                  <em>Not ready</em>
                  {a.offerLetterMissing?.length > 0 && (
                    <div className="hours-total-note">Missing: {a.offerLetterMissing.join(', ')}</div>
                  )}
                </>
              )}
            </dd>
          </dl>
        </div>
      )}

      {!assigning && (
        <div className="detail-actions">
          <button className="hire" onClick={openAssign}>
            {a.status === 'HIRED' ? '🔁 Reassign Section / Hours' : '🎯 Assign to Section'}
          </button>
          {a.status === 'HIRED' && (
            <button
              className="hire"
              disabled={!a.offerLetterReady}
              title={a.offerLetterReady ? 'Preview what would be handed off to the SharePoint offer-letter process' : 'Not eligible yet — see "Offer Letter" above for what is missing'}
              onClick={() => setOfferLetterPreview({
                applicantName: a.applicantName,
                applicantEmail: a.applicantEmail,
                course: `${a.courseCode} — ${a.courseTitle} · ${a.term}`,
                section: `${a.assignedMeetingTime || 'Not set'}${a.assignedInstructor ? ` · ${a.assignedInstructor}` : ''}`,
                hours: a.hours,
              })}
            >
              📨 Send Offer Letter
            </button>
          )}
          {a.status !== 'PENDING' && (
            <button className="reset-link" onClick={() => onUpdateStatus(a.id, 'PENDING')}>Move back to pending</button>
          )}
        </div>
      )}

      {assigning && (
        <div className="assign-panel">
          <div className="assign-head">
            Sections of {a.courseCode} — {a.term}
            <span className="assign-sub">The applicant applied to the course, not a section. Assigning one is the hire.</span>
          </div>
          <div className="cap-banner">
            Already hired for <strong>{hoursAlreadyHired}</strong> of the {hourCap}-hour cap this term — <strong>{hoursRemaining.toFixed(1)}</strong> hours remaining.
          </div>
          {assignError && <div className="error-banner">{assignError}</div>}
          {loadingSections ? (
            <div className="center-loading">Loading sections…</div>
          ) : (
            <table className="assign-table">
              <thead>
                <tr><th>CRN</th><th>Section</th><th>Faculty</th><th>Basis</th><th>Assign</th></tr>
              </thead>
              <tbody>
                {sections.map((s) => (
                  <tr key={s.id}>
                    <td>{s.crn || <em>—</em>}</td>
                    <td>{s.sectionNumber}</td>
                    <td>{s.instructor || <em>Not provided</em>}</td>
                    <td>
                      <select value={hoursBySection[s.id] || ''} onChange={(e) => setHoursBySection({ ...hoursBySection, [s.id]: e.target.value })}>
                        <option value="">— hours —</option>
                        {s.hourOptions.map((h) => <option key={h} value={h}>{h} hours</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="hire" disabled={!hoursBySection[s.id] || assigningSectionId === s.id} onClick={() => confirmAssign(s.id)}>
                        {assigningSectionId === s.id ? 'Assigning…' : '✓ Assign here'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="detail-actions" style={{ border: 'none', paddingTop: 12 }}>
            <button className="reset-link" onClick={() => setAssigning(false)}>Cancel</button>
          </div>
        </div>
      )}

      {offerLetterPreview && (
        <div className="invite-preview">
          <div className="ip-flag">Preview only — not sent to SharePoint</div>
          <div className="ip-note">
            The Offer Letter process is still a manual, roughly-weekly export into SharePoint — this app
            never sends it automatically. This is what would be handed off for that export.
          </div>
          <dl>
            <dt>Applicant</dt><dd>{offerLetterPreview.applicantName} ({offerLetterPreview.applicantEmail})</dd>
            <dt>Course</dt><dd>{offerLetterPreview.course}</dd>
            <dt>Section</dt><dd>{offerLetterPreview.section}</dd>
            <dt>Hours</dt><dd>{offerLetterPreview.hours != null ? `${offerLetterPreview.hours} hrs/week` : <em>Not set</em>}</dd>
          </dl>
          <div className="detail-actions" style={{ border: 'none', paddingTop: 12 }}>
            <button className="reset-link" onClick={() => setOfferLetterPreview(null)}>✕ Dismiss preview</button>
          </div>
        </div>
      )}
    </div>
  );
}
