import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Login from './pages/Login';
import Start from './pages/applicant/Start';
import Profile from './pages/applicant/Profile';
import Apply from './pages/applicant/Apply';
import Applications from './pages/applicant/Applications';
import Dashboard from './pages/faculty/Dashboard';
import Admin from './pages/admin/Admin';

function ApplicantTabs() {
  return (
    <nav className="tabs">
      <NavLink to="/start" className={({ isActive }) => isActive ? 'active' : ''}>Start</NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>My Profile</NavLink>
      <NavLink to="/apply" className={({ isActive }) => isActive ? 'active' : ''}>Apply to Courses</NavLink>
      <NavLink to="/applications" className={({ isActive }) => isActive ? 'active' : ''}>My Applications</NavLink>
    </nav>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="center-loading">Loading…</div>;
  if (!user) return <Login />;

  return (
    <>
      <Header />
      <div className="app-shell">
        {user.role === 'APPLICANT' && (
          <>
            <ApplicantTabs />
            <Routes>
              <Route path="/start" element={<Start />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/apply" element={<Apply />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="*" element={<Navigate to="/start" replace />} />
            </Routes>
          </>
        )}
        {user.role === 'FACULTY' && (
          <>
            <nav className="tabs"><span className="active" style={{ padding: '12px 18px', fontSize: 14, fontWeight: 600, color: 'var(--mason-green-dark)' }}>Applications Dashboard</span></nav>
            <Routes>
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </>
        )}
        {user.role === 'ADMIN' && (
          <>
            <nav className="tabs"><span className="active" style={{ padding: '12px 18px', fontSize: 14, fontWeight: 600, color: 'var(--mason-green-dark)' }}>Admin</span></nav>
            <Routes>
              <Route path="*" element={<Admin />} />
            </Routes>
          </>
        )}
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
