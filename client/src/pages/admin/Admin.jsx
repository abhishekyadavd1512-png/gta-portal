import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';

const EMPTY_FORM ={ courseCode: '', courseTitle: '', term: '', meetingTime: '', totalSeats: '', hourOptions: '', crn: '', instructor: '', active: true, countsTowardCap: true };

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [termFilter, setTermFilter] = useState('');

  // Delete Semester panel state
  const [semesterToDelete, setSemesterToDelete] = useState('');

  // Danger Zone panel state
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = () => {
    Promise.all([api.adminGetUsers(), api.adminGetSections()]).then(([u, s]) => {
      setUsers(u.users); setSections(s.sections); setLoading(false);
    });
  };
  useEffect(load, []);

  const terms = useMemo(() => [...new Set(sections.map((s) => s.term))].sort(), [sections]);

  const visibleSections = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sections.filter((s) => {
      if (termFilter && s.term !== termFilter) return false;
      if (!needle) return true;
      return [s.courseCode, s.courseTitle, s.crn, s.instructor].some((v) => (v || '').toLowerCase().includes(needle));
    });
  }, [sections, search, termFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.adminCreateSection({ ...form, totalSeats: Number(form.totalSeats) });
      setForm(EMPTY_FORM);
      setShowAddForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      await api.adminDeleteSection(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggle = async (id, field, value) => {
    setError('');
    try {
      await api.adminUpdateSection(id, { [field]: value });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSemester = async () => {
    if (!semesterToDelete) return;
    if (!window.confirm(`Delete every section, course, and application for "${semesterToDelete}"? This cannot be undone.`)) return;
    setError('');
    try {
      const result = await api.adminDeleteSemester(semesterToDelete);
      setSemesterToDelete('');
      load();
      window.alert(`Deleted: ${result.sectionsDeleted} section(s), ${result.coursesDeleted} course(s), ${result.applicationsDeleted} application(s).`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReset = async () => {
    if (resetConfirmText !== 'RESET') return;
    setError('');
    setResetting(true);
    try {
      const result = await api.adminReset(resetConfirmText);
      setResetConfirmText('');
      load();
      window.alert(`Everything reset. Deleted: ${result.sectionsDeleted} section(s), ${result.coursesDeleted} course(s), ${result.applicationsDeleted} application(s). User profiles were kept.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div className="center-loading">Loading admin data…</div>;

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20, lineHeight: 1.5 }}>
        Manage user visibility and course sections — including per-section Active / Counts-toward-cap
        flags, and semester-scoped or full data resets.
      </p>
      {error && <div className="error-banner">{error}</div>}

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h3>Users ({users.length})</h3>
        <div className="user-role-groups">
          {[
            { role: 'APPLICANT', label: 'Students' },
            { role: 'FACULTY', label: 'Faculty' },
            { role: 'ADMIN', label: 'Admins' },
          ].map(({ role, label }) => {
            const group = users.filter((u) => u.role === role);
            return (
              <div key={role} className="user-role-group">
                <h4>{label} ({group.length})</h4>
                <div className="user-role-group-scroll">
                  <table className="mini-table">
                    <thead><tr><th>Name</th><th>Email</th></tr></thead>
                    <tbody>
                      {group.map((u) => (
                        <tr key={u.id}><td>{u.name}</td><td>{u.email}</td></tr>
                      ))}
                      {group.length === 0 && <tr><td colSpan={2}><em>None yet.</em></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h3>Course Sections ({visibleSections.length} of {sections.length})</h3>
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search course, title, CRN, or instructor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
            <option value="">All terms</option>
            {terms.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="app-table">
            <thead>
              <tr>
                <th>Course</th><th>Term</th><th>CRN</th><th>Instructor</th><th>Seats</th>
                <th>Basis (hrs)</th><th>Active</th><th>Counts toward cap</th><th>Assigned to</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visibleSections.map((s) => (
                <tr key={s.id}>
                  <td>{s.courseCode} — {s.courseTitle}</td>
                  <td>{s.term}</td>
                  <td>{s.crn || '—'}</td>
                  <td>{s.instructor || '—'}</td>
                  <td>{s.totalSeats}</td>
                  <td>{s.hourOptions}</td>
                  <td>
                    <input type="checkbox" checked={s.active} onChange={(e) => handleToggle(s.id, 'active', e.target.checked)} title="Visible in the Apply flow / assignable to new hires" />
                  </td>
                  <td>
                    <input type="checkbox" checked={s.countsTowardCap} onChange={(e) => handleToggle(s.id, 'countsTowardCap', e.target.checked)} title="Counts toward the 20.1-hour cap" />
                  </td>
                  <td>
                    {s.assignedApplicants && s.assignedApplicants.length > 0
                      ? s.assignedApplicants.map((a) => `${a.name} (${a.hours}h)`).join(', ')
                      : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                  </td>
                  <td><button className="reset-link" onClick={() => handleDelete(s.id)}>Remove</button></td>
                </tr>
              ))}
              {visibleSections.length === 0 && (
                <tr><td colSpan={10}><em>No sections match.</em></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          {!showAddForm ? (
            <button className="btn-primary" type="button" onClick={() => setShowAddForm(true)}>+ Add section</button>
          ) : (
            <form onSubmit={handleCreate}>
              <div className="form-grid">
                <div className="field"><label>Course code</label><input required value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="e.g. CS 401" /></div>
                <div className="field"><label>Course title</label><input required value={form.courseTitle} onChange={(e) => setForm({ ...form, courseTitle: e.target.value })} placeholder="e.g. Data Structures" /></div>
                <div className="field"><label>Term</label><input required value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="e.g. Spring 2027" /></div>
                <div className="field"><label>Meeting time</label><input required value={form.meetingTime} onChange={(e) => setForm({ ...form, meetingTime: e.target.value })} placeholder="e.g. Mon/Wed 2:00pm" /></div>
                <div className="field"><label>Total seats</label><input required type="number" min="1" value={form.totalSeats} onChange={(e) => setForm({ ...form, totalSeats: e.target.value })} /></div>
                <div className="field"><label>CRN</label><input value={form.crn} onChange={(e) => setForm({ ...form, crn: e.target.value })} placeholder="optional" /></div>
                <div className="field"><label>Instructor</label><input value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} placeholder="optional" /></div>
                <div className="field full">
                  <label>Basis (hour options)</label>
                  <input
                    value={form.hourOptions}
                    onChange={(e) => setForm({ ...form, hourOptions: e.target.value })}
                    placeholder="e.g. 5,6.7,10 — leave blank for the default"
                  />
                </div>
                <div className="field">
                  <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} style={{ marginRight: 8 }} />Active</label>
                </div>
                <div className="field">
                  <label><input type="checkbox" checked={form.countsTowardCap} onChange={(e) => setForm({ ...form, countsTowardCap: e.target.checked })} style={{ marginRight: 8 }} />Counts toward cap</label>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '2px 0 14px' }}>
                Comma-separated hours/week a faculty member can assign an applicant to this section. Defaults to 5, 6.7, 10 — IT 105 sections typically use 10, 15.
              </p>
              <button className="btn-primary" type="submit">Add section</button>
              <button className="reset-link" type="button" style={{ marginLeft: 14 }} onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); }}>Cancel</button>
            </form>
          )}
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <h3>Delete a semester</h3>
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 14, lineHeight: 1.5 }}>
          Permanently removes every course, section, and application for one term. Applicant profiles are
          not affected. This cannot be undone.
        </p>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <select value={semesterToDelete} onChange={(e) => setSemesterToDelete(e.target.value)}>
            <option value="">Choose a semester…</option>
            {terms.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="reset-link" style={{ color: 'var(--danger)' }} disabled={!semesterToDelete} onClick={handleDeleteSemester}>
            Delete semester
          </button>
        </div>
      </div>

      <div className="admin-panel danger-zone">
        <h3>Danger zone</h3>
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 14, lineHeight: 1.5 }}>
          Permanently deletes <strong>every</strong> course, section, and application across every term.
          User profiles are kept. This cannot be undone — type <strong>RESET</strong> to confirm.
        </p>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            type="text"
            placeholder="Type RESET to confirm"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            style={{ flex: '0 0 220px', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px', fontSize: 14 }}
          />
          <button className="btn-primary" style={{ background: 'var(--danger)' }} disabled={resetConfirmText !== 'RESET' || resetting} onClick={handleReset}>
            {resetting ? 'Resetting…' : 'Reset everything'}
          </button>
        </div>
      </div>
    </>
  );
}
