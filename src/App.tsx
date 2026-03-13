import { Routes, Route, Navigate } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ManageChallenges from './pages/ManageChallenges';

export default function App() {
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
