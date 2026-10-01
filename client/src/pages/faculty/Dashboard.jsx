import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';

const STATUS_LABEL = { PENDING: 'Pending', INTERVIEW: 'Interview', HIRED: 'Hired' };

export default function Dashboard() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [offerReadyFilter, setOfferReadyFilter] = useState(false);
  const [sortKey, setSortKey] = useState('submittedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);

  const load = (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    api.getFacultyApplications().then((data) => { setApplications(data.applications); setLoading(false); });
  };
  useEffect(() => load(true), []);

  const programs = useMemo(() => [...new Set(applications.map((a) => a.program).filter(Boolean))], [applications]);

  const stats = useMemo(() => ({
    total: applications.length,
    PENDING: applications.filter((a) => a.status === 'PENDING').length,
    INTERVIEW: applications.filter((a) => a.status === 'INTERVIEW').length,
    HIRED: applications.filter((a) => a.status === 'HIRED').length,
    offerReady: applications.filter((a) => a.offerLetterReady).length,
  }), [applications]);

  const filtered = useMemo(() => {
    let rows = applications.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (offerReadyFilter && !a.offerLetterReady) return false;
      if (programFilter && a.program !== programFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!a.applicantName.toLowerCase().includes(s) && !a.courseCode.toLowerCase().includes(s) && !a.courseTitle.toLowerCase().includes(s)) return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [applications, statusFilter, offerReadyFilter, programFilter, search, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const updateStatus = async (id, status, extra) => {
    const res = await api.updateApplicationStatus(id, status, extra);
    load(false); // background refresh only — don't flip loading back to true and unmount the table mid-transition
    return res;
  };

  const assign = async (id, sectionId, hours) => {
    const res = await api.assignApplication(id, sectionId, hours);
    load(false);
    return res;
  };

  const exportCsv = () => {
    // "Offer Letter Ready" here is the same hand-off point the board
    // described (board feedback item 4): this export is what gets injected
    // into SharePoint — the web app itself never talks to SharePoint or
    // triggers the actual offer letter.
    const header = ['Name', 'Course', 'Program', 'Hours', 'Submitted', 'Status', 'Offer Letter Ready'];
    const rows = filtered.map((a) => [a.applicantName, `${a.courseCode} — ${a.courseTitle}`, a.program || '', a.hours != null ? a.hours : '', new Date(a.submittedAt).toLocaleDateString(), a.status, a.offerLetterReady ? 'Yes' : 'No']);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'gta-applications.csv';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="center-loading">Loading applications…</div>;

  const tileDefs = [
    { key: '', label: 'Total Applicants', val: stats.total },
    { key: 'PENDING', label: 'Pending Review', val: stats.PENDING },
    { key: 'INTERVIEW', label: 'Interview', val: stats.INTERVIEW },
    { key: 'HIRED', label: 'Hired', val: stats.HIRED },
  ];

  return (
    <>
      <div className="stat-row">
        {tileDefs.map((t) => (
          <button key={t.label} className={`stat-tile ${statusFilter === t.key ? 'active' : ''}`} onClick={() => { setStatusFilter(t.key); setExpandedId(null); }}>
            <div className="num">{t.val}</div>
            <div className="lbl">{t.label}</div>
          </button>
        ))}
        <button
          className={`stat-tile ${offerReadyFilter ? 'active' : ''}`}
          onClick={() => { setOfferReadyFilter(!offerReadyFilter); setExpandedId(null); }}
          title="Fully assigned GTAs who also meet every Offer Letter requirement (GPA, courses registered, tuition status, hours worked outside GMU)"
        >
          <div className="num">{stats.offerReady}</div>
          <div className="lbl">Offer Letter Ready</div>
        </button>
      </div>
      <div className="toolbar">
        <input type="search" placeholder="Search by name or course…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
          <option value="">All Programs</option>
          {programs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="INTERVIEW">Interview</option>
          <option value="HIRED">Hired</option>
        </select>
        <button className="btn-export" onClick={exportCsv}>⬇ Export CSV</button>
      </div>
      <div className="result-count">{filtered.length} application{filtered.length === 1 ? '' : 's'}</div>
      <table className="app-table">
        <thead>
          <tr>
            {[
              { key: 'applicantName', label: 'Applicant' },
              { key: 'courseCode', label: 'Course' },
              { key: 'program', label: 'Program' },
              { key: 'hours', label: 'Hours' },
              { key: 'submittedAt', label: 'Submitted' },
              { key: 'status', label: 'Status' },
              { key: 'offerLetterReady', label: 'Offer Letter' },
            ].map((col) => (
              <th key={col.key} onClick={() => toggleSort(col.key)}>
                {col.label}
                <span className="arrow">{sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => (
            <FragmentRow
              key={a.id}
              application={a}
              expanded={expandedId === a.id}
              onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
              onUpdateStatus={updateStatus}
              onAssign={assign}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}

// Converts an ISO timestamp to the local "YYYY-MM-DDTHH:mm" shape a
// <input type="datetime-local"> needs as its value.
function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function FragmentRow({ application: a, expanded, onToggle, onUpdateStatus, onAssign }) {
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState(toLocalInputValue(a.interviewScheduledAt));
  const [invitePreview, setInvitePreview] = useState(null);
  const [sending, setSending] = useState(false);

  const [assigning, setAssigning] = useState(false);
  const [loadingAssignSections, setLoadingAssignSections] = useState(false);
  const [assignSections, setAssignSections] = useState([]);
  const [hoursAlreadyHired, setHoursAlreadyHired] = useState(0);
  const [hourCap, setHourCap] = useState(20.1);
  const [hoursBySection, setHoursBySection] = useState({});
  const [assignError, setAssignError] = useState('');
  const [assigningSectionId, setAssigningSectionId] = useState('');

  const openScheduler = (e) => {
    e.stopPropagation();
    setWhen(toLocalInputValue(a.interviewScheduledAt));
    setScheduling(true);
  };

  const confirmSchedule = async (e) => {
    e.stopPropagation();
    if (!when) return;
    setSending(true);
    try {
      const res = await onUpdateStatus(a.id, 'INTERVIEW', { interviewScheduledAt: new Date(when).toISOString() });
      setInvitePreview(res?.invitePreview || null);
      setScheduling(false);
    } finally {
      setSending(false);
    }
  };

  const openAssign = async (e) => {
    e.stopPropagation();
    setAssigning(true);
    setAssignError('');
    setLoadingAssignSections(true);
    try {
      const data = await api.getApplicationSections(a.id);
      setAssignSections(data.sections);
      setHoursAlreadyHired(data.hoursAlreadyHired);
      setHourCap(data.hourCap);
    } finally {
      setLoadingAssignSections(false);
    }
  };

  const confirmAssign = async (e, sectionId) => {
    e.stopPropagation();
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
    <>
      <tr className="app-row" onClick={onToggle}>
        <td>{a.applicantName}</td>
        <td>{a.courseCode} — {a.courseTitle}</td>
        <td>{a.program || <em>Not provided</em>}</td>
        <td>
          {a.hours != null ? `${a.hours} hrs/wk` : <em>—</em>}
          {Number(a.applicantTermHours) > 0 && Number(a.applicantTermHours) !== Number(a.hours) && (
            <div className="hours-total-note">{a.applicantTermHours} total this term</div>
          )}
        </td>
        <td>{new Date(a.submittedAt).toLocaleDateString()}</td>
        <td><span className={`pill ${a.status}`}>{STATUS_LABEL[a.status]}</span></td>
        <td>
          {a.offerLetterReady
            ? <span className="pill HIRED">✓ Ready</span>
            : <span className="pill not-ready">—</span>}
        </td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={7}>
            <div className="detail-panel">
              <div className="dp-grid">
                <dl><dt>Email</dt><dd>{a.applicantEmail}</dd><dt>Course</dt><dd>{a.courseCode} · {a.term}</dd></dl>
                <dl><dt>GPA</dt><dd>{a.gpa || <em>Not provided</em>}</dd><dt>Prior experience</dt><dd>{a.priorExperience || <em>Not provided</em>}</dd></dl>
                <dl>
                  <dt>Submitted</dt><dd>{new Date(a.submittedAt).toLocaleString()}</dd>
                  <dt>Current status</dt><dd><span className={`pill ${a.status}`}>{STATUS_LABEL[a.status]}</span></dd>
                  <dt>Interview</dt>
                  <dd>{a.interviewScheduledAt ? new Date(a.interviewScheduledAt).toLocaleString() : <em>Not scheduled</em>}</dd>
                </dl>
              </div>

              {a.status === 'HIRED' && (
                <div className="dp-grid" style={{ marginTop: -8, marginBottom: 18 }}>
                  <dl>
                    <dt>Assigned section</dt>
                    <dd>{a.assignedMeetingTime || <em>Not set</em>}{a.assignedInstructor ? ` · ${a.assignedInstructor}` : ''}</dd>
                    <dt>Hours (Basis)</dt>
                    <dd>
                      {a.hours != null ? `${a.hours} hrs/week` : <em>Not set</em>}
                      {Number(a.applicantTermHours) > 0 && Number(a.applicantTermHours) !== Number(a.hours) && (
                        <> — <strong>{a.applicantTermHours} hrs/week total</strong> across all their hires this term</>
                      )}
                    </dd>
                  </dl>
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

              {!scheduling && !assigning && (
                <div className="detail-actions">
                  <button className="interview-btn" onClick={openScheduler}>
                    {a.interviewScheduledAt ? '🔁 Reschedule Interview' : '📅 Schedule Interview'}
                  </button>
                  <button className="hire" onClick={openAssign}>
                    {a.status === 'HIRED' ? '🔁 Reassign Section / Hours' : '🎯 Assign to Section'}
                  </button>
                  {a.status !== 'PENDING' && (
                    <button className="reset-link" onClick={(e) => { e.stopPropagation(); onUpdateStatus(a.id, 'PENDING'); }}>Move back to pending</button>
                  )}
                </div>
              )}

              {scheduling && (
                <div className="schedule-form" onClick={(e) => e.stopPropagation()}>
                  <label htmlFor={`when-${a.id}`}>Interview date &amp; time</label>
                  <input
                    id={`when-${a.id}`}
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                  <button className="interview-btn" disabled={!when || sending} onClick={confirmSchedule}>
                    {sending ? 'Scheduling…' : 'Confirm & Send Invite'}
                  </button>
                  <button className="reset-link" onClick={(e) => { e.stopPropagation(); setScheduling(false); }}>Cancel</button>
                </div>
              )}

              {assigning && (
                <div className="assign-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="assign-head">
                    Sections of {a.courseCode} — {a.term}
                    <span className="assign-sub">The applicant applied to the course, not a section. Assigning one is the hire.</span>
                  </div>
                  <div className="cap-banner">
                    Already hired for <strong>{hoursAlreadyHired}</strong> of the {hourCap}-hour cap this term — <strong>{hoursRemaining.toFixed(1)}</strong> hours remaining.
                  </div>
                  {assignError && <div className="error-banner">{assignError}</div>}
                  {loadingAssignSections ? (
                    <div className="center-loading">Loading sections…</div>
                  ) : (
                    <table className="assign-table">
                      <thead>
                        <tr>
                          <th>CRN</th>
                          <th>Section</th>
                          <th>Faculty</th>
                          <th>Basis</th>
                          <th>Assign</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignSections.map((s) => (
                          <tr key={s.id}>
                            <td>{s.crn || <em>—</em>}</td>
                            <td>{s.sectionNumber}</td>
                            <td>{s.instructor || <em>Not provided</em>}</td>
                            <td>
                              <select
                                value={hoursBySection[s.id] || ''}
                                onChange={(e) => setHoursBySection({ ...hoursBySection, [s.id]: e.target.value })}
                              >
                                <option value="">— hours —</option>
                                {s.hourOptions.map((h) => <option key={h} value={h}>{h} hours</option>)}
                              </select>
                            </td>
                            <td>
                              <button
                                className="hire"
                                disabled={!hoursBySection[s.id] || assigningSectionId === s.id}
                                onClick={(e) => confirmAssign(e, s.id)}
                              >
                                {assigningSectionId === s.id ? 'Assigning…' : '✓ Assign here'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="detail-actions" style={{ border: 'none', paddingTop: 12 }}>
                    <button className="reset-link" onClick={(e) => { e.stopPropagation(); setAssigning(false); }}>Cancel</button>
                  </div>
                </div>
              )}

              {invitePreview && (
                <div className="invite-preview" onClick={(e) => e.stopPropagation()}>
                  <div className="ip-flag">Preview only — not actually sent</div>
                  <div className="ip-note">{invitePreview.note}</div>
                  <dl>
                    <dt>To</dt><dd>{invitePreview.to}</dd>
                    <dt>Subject</dt><dd>{invitePreview.subject}</dd>
                    <dt>When</dt><dd>{new Date(invitePreview.when).toLocaleString()}</dd>
                  </dl>
                  <pre>{invitePreview.body}</pre>
                  <div className="detail-actions" style={{ border: 'none', paddingTop: 12 }}>
                    <button className="reset-link" onClick={() => setInvitePreview(null)}>✕ Dismiss preview</button>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
