import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { APPLICANT: 'Applicant', FACULTY: 'Faculty Reviewer', ADMIN: 'Admin' };

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="top">
      <div className="brand">
        <div className="mark">G</div>
        <div className="name">GTA Portal<small>George Mason University</small></div>
      </div>
      <div className="top-actions">
        {user && (
          <div className="signed-in">
            <span className="avatar">{user.name?.[0]?.toUpperCase() || '?'}</span>
            <span>{user.name} · {ROLE_LABEL[user.role]}</span>
            <button className="signout-btn" onClick={logout}>Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}
