import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import PoliciesPage from './pages/PoliciesPage';
import MonitoringPage from './pages/MonitoringPage';
import FrameworksPage from './pages/FrameworksPage';
import AuditsPage from './pages/AuditsPage';
import WorkflowPage from './pages/WorkflowPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/index.html" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login.html" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/signup.html" element={<SignupPage />} />

      {/* Protected Workspace Layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard.html" element={<DashboardPage />} />

          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/policies.html" element={<PoliciesPage />} />

          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/monitoring.html" element={<MonitoringPage />} />

          <Route path="/frameworks" element={<FrameworksPage />} />
          <Route path="/frameworks.html" element={<FrameworksPage />} />

          <Route path="/audits" element={<AuditsPage />} />
          <Route path="/audits.html" element={<AuditsPage />} />
          <Route path="/audict.html" element={<AuditsPage />} />

          <Route path="/workflow" element={<WorkflowPage />} />
          <Route path="/workflow.html" element={<WorkflowPage />} />

          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings.html" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
