import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

const STATUS_LABEL = { PENDING: 'Pending', INTERVIEW: 'Interview', HIRED: 'Hired' };

export default function Applications() {
  const [applications, setApplications] = useState(null);

  useEffect(() => {
    api.getMyApplications().then((data) => setApplications(data.applications));
  }, []);

  if (applications === null) return <div className="center-loading">Loading your applications…</div>;

  if (applications.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">📨</div>
        <h3>No applications submitted yet</h3>
        <p>Once you submit a GTA application, it will show up here so you can track its status and any interview requests.</p>
        <Link to="/apply"><button className="btn-primary">Apply to a course</button></Link>
      </div>
    );
  }

  return (
    <table className="app-table">
      <thead>
        <tr>
          <th>Course</th>
          <th>Term</th>
          <th>Enrollment</th>
          <th>Submitted</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((a) => (
          <tr key={a.id}>
            <td>{a.courseCode} — {a.courseTitle}</td>
            <td>{a.term}</td>
            <td>{a.enrollmentType === 'FULL_TIME' ? 'Full-time' : 'Part-time'}</td>
            <td>{new Date(a.submittedAt).toLocaleDateString()}</td>
            <td><span className={`pill ${a.status}`}>{STATUS_LABEL[a.status]}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
