import { useEffect, useState } from 'react';
import { api } from '../../api';

const ROLE_LABEL = { APPLICANT: 'Applicant', FACULTY: 'Faculty', ADMIN: 'Admin' };

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ courseCode: '', courseTitle: '', term: '', meetingTime: '', totalSeats: '', hourOptions: '' });
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api.adminGetUsers(), api.adminGetSections()]).then(([u, s]) => {
      setUsers(u.users); setSections(s.sections); setLoading(false);
    });
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.adminCreateSection({ ...form, totalSeats: Number(form.totalSeats) });
      setForm({ courseCode: '', courseTitle: '', term: '', meetingTime: '', totalSeats: '', hourOptions: '' });
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

  if (loading) return <div className="center-loading">Loading admin data…</div>;

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20, lineHeight: 1.5 }}>
        This is a minimal starting point for the Admin role — user visibility and basic section
        management. It'll grow once the IST use cases define what admins actually need to do here
        (group sync, catalog export, CLSS updates, etc.).
      </p>
      {error && <div className="error-banner">{error}</div>}
      <div className="admin-grid">
        <div className="admin-panel">
          <h3>Users ({users.length})</h3>
          <table className="mini-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{ROLE_LABEL[u.role]}</td></tr>
              ))}
              {users.length === 0 && <tr><td colSpan={3}><em>No users have signed in yet.</em></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-panel">
          <h3>Course Sections ({sections.length})</h3>
          <table className="mini-table">
            <thead><tr><th>Course</th><th>Term</th><th>Seats</th><th>Basis (hours)</th><th></th></tr></thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.id}>
                  <td>{s.courseCode} — {s.courseTitle}</td>
                  <td>{s.term}</td>
                  <td>{s.totalSeats}</td>
                  <td>{s.hourOptions}</td>
                  <td><button className="reset-link" onClick={() => handleDelete(s.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={handleCreate} style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <div className="form-grid">
              <div className="field"><label>Course code</label><input required value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="e.g. CS 401" /></div>
              <div className="field"><label>Course title</label><input required value={form.courseTitle} onChange={(e) => setForm({ ...form, courseTitle: e.target.value })} placeholder="e.g. Data Structures" /></div>
              <div className="field"><label>Term</label><input required value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="e.g. Spring 2027" /></div>
              <div className="field"><label>Meeting time</label><input required value={form.meetingTime} onChange={(e) => setForm({ ...form, meetingTime: e.target.value })} placeholder="e.g. Mon/Wed 2:00pm" /></div>
              <div className="field"><label>Total seats</label><input required type="number" min="1" value={form.totalSeats} onChange={(e) => setForm({ ...form, totalSeats: e.target.value })} /></div>
              <div className="field full">
                <label>Basis (hour options)</label>
                <input
                  value={form.hourOptions}
                  onChange={(e) => setForm({ ...form, hourOptions: e.target.value })}
                  placeholder="e.g. 5,6.7,10 — leave blank for the default"
                />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '2px 0 14px' }}>
              Comma-separated hours/week a faculty member can assign an applicant to this section. Defaults to 5, 6.7, 10 — IT 105 sections typically use 10, 15.
            </p>
            <button className="btn-primary" type="submit">Add section</button>
          </form>
        </div>
      </div>
    </>
  );
}
