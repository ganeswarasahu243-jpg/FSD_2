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
  Users,
  Search,
  Filter,
  Check,
  UserCheck,
  UserX,
  RotateCw,
} from 'lucide-react';
import { apiRequest, setAuthSession, getStoredRole, isAdmin } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import EmptyState from '../components/ui/EmptyState';
import { TableRowSkeleton } from '../components/ui/Skeleton';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'users' | 'system'
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

  // --- Admin User Management State ---
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [savingUserId, setSavingUserId] = useState(null);
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 8;

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

  const loadUsers = async () => {
    if (!isAdmin()) return;
    try {
      setLoadingUsers(true);
      const data = await apiRequest('/api/users/');
      setUsersList(Array.isArray(data) ? data : []);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load users list.' });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

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
        setAuthSession(
          res.access,
          res.refresh,
          res.user?.username || profile.username,
          res.user?.role || profile.role
        );
      }

      setProfile((prev) => ({ ...prev, password: '', confirm_password: '' }));
      setFeedback({
        type: 'success',
        message: res.message || 'Profile settings updated successfully in PostgreSQL.',
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update settings.' });
    } finally {
      setUpdating(false);
    }
  };

  // --- Admin User Management Actions ---
  const handleUserRoleChange = (userId, newRole) => {
    setUsersList((prev) =>
      prev.map((u) => (String(u.id) === String(userId) ? { ...u, role: newRole } : u))
    );
  };

  const handleSaveUserRole = async (targetUser) => {
    setSavingUserId(targetUser.id);
    setFeedback(null);

    try {
      const res = await apiRequest(`/api/users/${targetUser.id}/`, {
        method: 'PUT',
        body: { role: targetUser.role },
      });

      setFeedback({
        type: 'success',
        message: res.message || `Role for ${targetUser.username} updated to ${targetUser.role}.`,
      });
      await loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update user role.' });
    } finally {
      setSavingUserId(null);
    }
  };

  const handleToggleUserStatus = async (targetUser) => {
    const newStatus = !targetUser.is_active;
    const actionName = newStatus ? 'activate' : 'deactivate';

    if (!window.confirm(`Are you sure you want to ${actionName} account "${targetUser.username}"?`)) {
      return;
    }

    setSavingUserId(targetUser.id);
    setFeedback(null);

    try {
      const res = await apiRequest(`/api/users/${targetUser.id}/`, {
        method: 'PUT',
        body: { is_active: newStatus },
      });

      setFeedback({
        type: 'success',
        message: res.message || `User ${targetUser.username} ${newStatus ? 'activated' : 'deactivated'}.`,
      });
      await loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || `Failed to ${actionName} user.` });
    } finally {
      setSavingUserId(null);
    }
  };

  // Filtered Users List
  const filteredUsers = usersList.filter((u) => {
    const q = userSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.first_name && u.first_name.toLowerCase().includes(q)) ||
      (u.last_name && u.last_name.toLowerCase().includes(q));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active !== false) ||
      (statusFilter === 'deactivated' && u.is_active === false);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE) || 1;
  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * USERS_PER_PAGE,
    userPage * USERS_PER_PAGE
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Account & Workspace Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your compliance officer profile, authentication credentials, and user access roles.
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
                {profile.email || 'No email associated with account'} • PostgreSQL Active Record
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'bg-white text-slate-900 font-semibold border border-slate-200/80 shadow-xs'
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
                  ? 'bg-white text-slate-900 font-semibold border border-slate-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Security
            </button>

            {isAdmin() && (
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'users'
                    ? 'bg-white text-slate-900 font-semibold border border-slate-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>User Management</span>
                {usersList.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px]">
                    {usersList.length}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'system'
                  ? 'bg-white text-slate-900 font-semibold border border-slate-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Telemetry
            </button>
          </div>
        </div>
      </Card>

      {/* TAB 1: PROFILE DETAILS */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit}>
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
                  disabled={getStoredRole() !== 'admin'}
                  helperText={
                    getStoredRole() === 'admin'
                      ? 'Administrator privilege: assign employee, compliance_officer, or admin'
                      : 'Role assignment is locked. Contact an administrator to request elevation.'
                  }
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
        </form>
      )}

      {/* TAB 2: SECURITY */}
      {activeTab === 'security' && (
        <form onSubmit={handleSubmit}>
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Password & Security</CardTitle>
              <CardDescription>
                Update your password. The system supports salted Bcrypt and Django PBKDF2 hash formats.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 leading-relaxed">
                <strong>Dual-Engine Authentication Active:</strong> Your password is protected with Bcrypt and salted SHA-256 PBKDF2 encryption with 60-minute JWT token expiration and 7-day refresh lifecycle.
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
        </form>
      )}

      {/* TAB 3: USER MANAGEMENT (ADMIN ONLY) */}
      {activeTab === 'users' && isAdmin() && (
        <div className="space-y-6 animate-fade-in">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by username or email..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setUserPage(1);
                }}
                className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 bg-white"
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrator</option>
                <option value="compliance_officer">Compliance Officer</option>
                <option value="employee">Employee</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setUserPage(1);
                }}
                className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="deactivated">Deactivated Only</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={RotateCw}
              loading={loadingUsers}
              onClick={loadUsers}
            >
              Refresh Users
            </Button>
          </div>

          {/* User Table */}
          <Card>
            <CardHeader>
              <CardTitle>System Accounts & Role Permissions</CardTitle>
              <CardDescription>
                Showing {filteredUsers.length} total users in organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <TableRowSkeleton count={4} />
              ) : paginatedUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Assigned Role</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {paginatedUsers.map((u) => {
                        const isSelf = u.username === profile.username;
                        const isDeactivated = u.is_active === false;

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-medium text-xs flex items-center justify-center uppercase shrink-0">
                                  {u.username.slice(0, 2)}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                                    {u.username}
                                    {isSelf && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-100 text-blue-800 font-semibold">
                                        You
                                      </span>
                                    )}
                                  </p>
                                  {(u.first_name || u.last_name) && (
                                    <p className="text-slate-500 text-[11px]">
                                      {u.first_name} {u.last_name}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-slate-600">
                              {u.email || <span className="text-slate-400 italic">No email</span>}
                            </td>

                            <td className="py-3.5 px-4">
                              <select
                                value={u.role || 'employee'}
                                onChange={(e) => handleUserRoleChange(u.id, e.target.value)}
                                disabled={isSelf}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 outline-none focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
                              >
                                <option value="employee">Employee</option>
                                <option value="compliance_officer">Compliance Officer</option>
                                <option value="admin">Administrator</option>
                              </select>
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold inline-flex items-center gap-1 ${
                                  isDeactivated
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {isDeactivated ? 'Deactivated' : 'Active'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={Check}
                                  title="Save Role Assignment"
                                  disabled={isSelf}
                                  loading={savingUserId === u.id}
                                  onClick={() => handleSaveUserRole(u)}
                                >
                                  Save Role
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={isDeactivated ? UserCheck : UserX}
                                  disabled={isSelf}
                                  className={
                                    isDeactivated
                                      ? 'text-emerald-700 hover:bg-emerald-50'
                                      : 'text-red-600 hover:bg-red-50'
                                  }
                                  title={isSelf ? 'Cannot deactivate your own account' : isDeactivated ? 'Activate User' : 'Deactivate User'}
                                  onClick={() => handleToggleUserStatus(u)}
                                >
                                  {isDeactivated ? 'Activate' : 'Deactivate'}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No Users Found"
                  description="No registered user accounts match the selected filters."
                  actionLabel="Clear Filters"
                  onAction={() => {
                    setUserSearch('');
                    setRoleFilter('all');
                    setStatusFilter('all');
                  }}
                />
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">
                    Page {userPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={userPage <= 1}
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={userPage >= totalPages}
                      onClick={() => setUserPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: TELEMETRY / SYSTEM */}
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
              <p className="mt-2 text-2xl font-bold text-slate-900">PostgreSQL</p>
              <p className="mt-1 text-xs text-slate-500">Connected to Supabase PostgreSQL Cluster</p>
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
    </div>
  );
}
