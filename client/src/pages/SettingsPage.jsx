import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  KeyRound,
  Database,
  Save,
  CheckCircle2,
  AlertCircle,
  Server,
  Layers,
  Sparkles,
} from 'lucide-react';
import { apiRequest, setAuthSession } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import Alert from '../components/ui/Alert';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'system'
  const [profile, setProfile] = useState({
    username: '',
    role: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  const [systemStats, setSystemStats] = useState({
    connected_modules: 0,
    sync_health: 0,
    recommended_action: 'No database records available.',
  });

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, message }

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const [me, siteData] = await Promise.all([
          apiRequest('/api/auth/me/'),
          apiRequest('/api/site-data/'),
        ]);

        setProfile({
          username: me.username || '',
          role: me.role || 'employee',
          first_name: me.first_name || '',
          last_name: me.last_name || '',
          email: me.email || '',
          password: '',
          confirm_password: '',
        });

        setSystemStats({
          connected_modules: siteData.settings?.connected_modules || 0,
          sync_health: siteData.settings?.sync_health || 0,
          recommended_action: siteData.settings?.recommended_action || 'Review access roles and ensure policy compliance.',
        });
      } catch (err) {
        setFeedback({ type: 'error', message: err.message || 'Failed to load profile.' });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (profile.password && profile.password !== profile.confirm_password) {
      setFeedback({ type: 'warning', message: 'New passwords do not match.' });
      return;
    }

    setUpdating(true);
    setFeedback(null);

    try {
      const payload = {
        username: profile.username.trim(),
        role: profile.role.trim(),
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        email: profile.email.trim(),
      };
      if (profile.password && profile.password.trim().length >= 6) {
        payload.password = profile.password.trim();
      }

      const res = await apiRequest('/api/auth/profile/', {
        method: 'PUT',
        body: payload,
      });

      if (res.access && res.refresh) {
        setAuthSession(res.access, res.refresh, res.user?.username || profile.username);
      }

      setProfile((prev) => ({ ...prev, password: '', confirm_password: '' }));
      setFeedback({
        type: 'success',
        message: res.message || 'Profile settings updated successfully in MongoDB.',
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update settings.' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Account & Workspace Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your compliance officer profile, authentication credentials, and system synchronization telemetry.
        </p>
      </div>

      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Profile Overview Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-700 text-white font-bold text-2xl flex items-center justify-center uppercase">
              {profile.username ? profile.username.slice(0, 2) : 'SC'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline text-xl font-bold text-slate-900">
                  {profile.first_name && profile.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : profile.username || 'User Profile'}
                </h3>
                <Badge variant="medium">{profile.role || 'employee'}</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {profile.email || 'No email associated with account'} • MongoDB Persistent User
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'bg-white text-slate-900 font-semibold border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Profile Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'security'
                  ? 'bg-white text-slate-900 font-semibold border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Security
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'system'
                  ? 'bg-white text-slate-900 font-semibold border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Telemetry
            </button>
          </div>
        </div>
      </Card>

      {/* Main Settings Body */}
      <form onSubmit={handleSubmit}>
        {activeTab === 'profile' && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Personal & Role Information</CardTitle>
              <CardDescription>
                Update your display name, username, and organizational role.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Username"
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  required
                />
                <Input
                  label="Role"
                  value={profile.role}
                  onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                  helperText="e.g. employee, compliance_officer, admin"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="First Name"
                  value={profile.first_name}
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                />
                <Input
                  label="Last Name"
                  value={profile.last_name}
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                />
              </div>

              <Input
                label="Email Address"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="name@company.com"
              />

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <Button type="submit" loading={updating} icon={Save}>
                  Save Profile Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'security' && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Password & Security</CardTitle>
              <CardDescription>
                Update your password. The system supports both legacy Django PBKDF2 hashes and modern Bcrypt.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 leading-relaxed">
                <strong>Dual-Engine Authentication Active:</strong> Your password is protected with salted SHA-256 PBKDF2 / Bcrypt encryption with 60-minute JWT token expiration and 7-day refresh lifecycle.
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="New Password"
                  type="password"
                  value={profile.password}
                  onChange={(e) => setProfile({ ...profile, password: e.target.value })}
                  placeholder="Leave blank to keep current password"
                  helperText="Minimum 6 characters required"
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={profile.confirm_password}
                  onChange={(e) => setProfile({ ...profile, confirm_password: e.target.value })}
                  placeholder="Repeat new password"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <Button type="submit" loading={updating} icon={KeyRound}>
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-5">
                <span className="text-xs font-medium text-slate-600">Sync health</span>
                <p className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">{systemStats.sync_health}%</p>
                <p className="mt-1 text-xs text-slate-500">Database synchronization integrity</p>
              </Card>

              <Card className="p-5">
                <span className="text-xs font-medium text-slate-600">Connected modules</span>
                <p className="mt-2 text-2xl font-bold text-blue-700 tabular-nums">{systemStats.connected_modules}</p>
                <p className="mt-1 text-xs text-slate-500">Active policy, logging & audit channels</p>
              </Card>

              <Card className="p-5">
                <span className="text-xs font-medium text-slate-600">Database mode</span>
                <p className="mt-2 text-2xl font-bold text-slate-900">MongoDB</p>
                <p className="mt-1 text-xs text-slate-500">Migrated from SQLite3 successfully</p>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>System Recommendation</CardTitle>
                <CardDescription>Automated operational guidance from compliance engine</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 leading-relaxed">
                  {systemStats.recommended_action}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </form>
    </div>
  );
}
