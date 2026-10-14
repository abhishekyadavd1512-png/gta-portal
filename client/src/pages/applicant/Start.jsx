import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Start() {
  const { user } = useAuth();
  return (
    <>
      <div className="hero">
        <h1>Graduate Teaching Assistant Applications</h1>
        <p>
          {user?.name ? `Welcome, ${user.name.split(' ')[0]}. ` : ''}
          Find open GTA positions across departments, submit one application per term,
          and track your status in one place.
        </p>
        <div className="cta"><Link to="/apply"><button>Start an Application</button></Link></div>
      </div>
      <div className="card-grid">
        <Link className="action-card" to="/apply">
          <div className="icon">📋</div>
          <h3>Browse open sections</h3>
          <p>See which course sections are accepting GTA applications this term, with seats and eligibility shown up front.</p>
          <span className="link">Apply to courses →</span>
        </Link>
        <Link className="action-card" to="/profile">
          <div className="icon">👤</div>
          <h3>Complete your profile</h3>
          <p>Add your program, advisor, and contact details once — reuse them on every application you submit.</p>
          <span className="link">Go to profile →</span>
        </Link>
        <Link className="action-card" to="/applications">
          <div className="icon">📨</div>
          <h3>Track your applications</h3>
          <p>Check status, see interview requests, and follow up on submitted applications.</p>
          <span className="link">View applications →</span>
        </Link>
      </div>
    </>
  );
}
