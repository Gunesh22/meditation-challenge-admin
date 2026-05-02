import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ManageChallenges from './pages/ManageChallenges';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'tgf000') {
      setIsAuthenticated(true);
      localStorage.setItem('admin_auth', 'true');
      setError(false);
    } else {
      setError(true);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <form onSubmit={handleLogin} className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{ width: '50px', height: '50px', background: 'var(--accent)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px' }}>
              🔒
            </div>
          </div>
          <h2 style={{ marginBottom: '8px', fontSize: '22px' }}>Admin Access</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>Enter the master password to continue</p>
          <input
            type="password"
            className="glass-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: '16px', textAlign: 'center', fontSize: '16px', letterSpacing: '2px' }}
            autoFocus
          />
          {error && <p style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>Incorrect password</p>}
          <button type="submit" className="glass-button" style={{ width: '100%' }}>
            Unlock Dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/challenges" element={<ManageChallenges />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}
