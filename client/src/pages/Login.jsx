import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('APPLICANT');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !name.trim()) {
      setError('Please enter both a name and an email.');
      return;
    }
    setSubmitting(true);
    try {
      await login({ email: email.trim(), name: name.trim(), role });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>GTA Portal</h1>
        <div className="sub">George Mason University — sign in to continue.</div>
        <div className="login-note">
          This is a development sign-in, not GMU's real login. Real Entra ID / MSAL
          sign-in will replace this screen once that's wired up — everything you build
          here works the same way afterward.
        </div>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jordan Alvarez" autoFocus />
          </div>
          <div className="field">
            <label>GMU email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmu.edu" type="email" />
          </div>
          <div className="field">
            <label>Sign in as</label>
            <div className="role-radio-group">
              {[
                { value: 'APPLICANT', label: 'Applicant' },
                { value: 'FACULTY', label: 'Faculty Reviewer' },
                { value: 'ADMIN', label: 'Admin' },
              ].map((opt) => (
                <label className="role-radio" key={opt.value}>
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={role === opt.value}
                    onChange={() => setRole(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
