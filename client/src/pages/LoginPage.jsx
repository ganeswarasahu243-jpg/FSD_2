import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { apiRequest, setAuthSession } from '../services/api';
import { DEMO_ACCOUNTS } from '../config/demoAccounts';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [activeDemo, setActiveDemo] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const data = await apiRequest('/api/auth/login/', {
        method: 'POST',
        body: { username: username.trim(), password },
      });

      setAuthSession(
        data.access,
        data.refresh,
        data.user?.username || username,
        data.user?.role || 'employee'
      );
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillAdminAccount = () => {
    const account = DEMO_ACCOUNTS.admin;
    setUsername(account.username);
    setPassword(account.password);
    setActiveDemo('admin');
    setError(null);

    if (account.password) {
      setInfo(
        `Loaded Administrator Demo credentials (${account.username}). Click "Sign In to Workspace" to authenticate.`
      );
    } else {
      setInfo(
        `Loaded Administrator Demo username (${account.username}). Enter the demo password configured in your environment to authenticate.`
      );
    }
  };

  const fillEmployeeAccount = () => {
    const account = DEMO_ACCOUNTS.employee;
    setUsername(account.username);
    setPassword(account.password);
    setActiveDemo('employee');
    setError(null);

    if (account.password) {
      setInfo(
        `Loaded Employee Demo credentials (${account.username}). Click "Sign In to Workspace" to authenticate.`
      );
    } else {
      setInfo(
        `Loaded Employee Demo username (${account.username}). Enter the demo password configured in your environment to authenticate.`
      );
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-3 sm:p-6 lg:p-8 bg-slate-950 font-sans">
      <div className="w-full max-w-5xl rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex flex-col lg:flex-row">
        {/* Left Brand & Demo Accounts Pane */}
        <div className="lg:w-1/2 p-6 sm:p-8 lg:p-10 bg-slate-900 flex flex-col justify-between text-white border-b lg:border-b-0 lg:border-r border-slate-800">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white group-hover:bg-blue-500 transition-colors shadow-sm">
                <Shield className="w-5 h-5" />
              </div>
              <span className="font-headline font-bold text-xl tracking-tight text-white">
                Sentinel Core
              </span>
            </Link>

            <div className="mt-8 space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-900/40 border border-blue-700/50 text-xs font-medium text-blue-300">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Enterprise Policy Compliance</span>
              </div>

              <h2 className="font-headline text-2xl lg:text-3xl font-bold text-white tracking-tight leading-snug">
                Machine-Readable Compliance Intelligence
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed">
                Experience automated policy extraction, audit framework cross-referencing (GDPR, SOC 2, HIPAA), and real-time internal risk telemetry.
              </p>
            </div>
          </div>

          {/* Interactive Demo Account Options */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Interactive Demo Profiles
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Select to load credentials</span>
            </div>

            {/* Administrator Demo Card */}
            <button
              type="button"
              onClick={fillAdminAccount}
              aria-label="Select Administrator Demo Account"
              className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                activeDemo === 'admin'
                  ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500/50 shadow-md'
                  : 'border-slate-800 bg-slate-800/60 hover:bg-slate-800 hover:border-blue-500/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                      Administrator Demo
                    </h3>
                    <p className="text-[11px] font-mono text-blue-300 mt-0.5">
                      User: {DEMO_ACCOUNTS.admin.username}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Full Admin Access
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                {DEMO_ACCOUNTS.admin.summary}
              </p>

              <div className="mt-2.5 pt-2 border-t border-slate-700/50 grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate">Policy Ingestion & AI Rules</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate">Alert Triage & Violations</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate">Activity Simulator Demo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate">User & Role Management</span>
                </div>
              </div>
            </button>

            {/* Employee Demo Card */}
            <button
              type="button"
              onClick={fillEmployeeAccount}
              aria-label="Select Employee Demo Account"
              className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                activeDemo === 'employee'
                  ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500/50 shadow-md'
                  : 'border-slate-800 bg-slate-800/60 hover:bg-slate-800 hover:border-emerald-500/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                      Employee Demo
                    </h3>
                    <p className="text-[11px] font-mono text-emerald-300 mt-0.5">
                      User: {DEMO_ACCOUNTS.employee.username}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Standard Employee
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                {DEMO_ACCOUNTS.employee.summary}
              </p>

              <div className="mt-2.5 pt-2 border-t border-slate-700/50 grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">Read Published Policies</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">Record Workflow Logs</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <XCircle className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">Gated from AI Ingestion</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <XCircle className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">Gated from Alert Triage</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Right Form Pane */}
        <div className="lg:w-1/2 p-6 sm:p-8 lg:p-10 bg-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-5 border-b border-slate-200">
              <div>
                <h1 className="font-headline text-2xl font-bold text-slate-900 tracking-tight">
                  Welcome Back
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Enter credentials or select a demo profile to access Sentinel Workspace
                </p>
              </div>
              <Link
                to="/signup"
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Create Account
              </Link>
            </div>

            {error && (
              <div className="mt-5">
                <Alert variant="error" title="Authentication Error">
                  {error}
                </Alert>
              </div>
            )}

            {info && (
              <div className="mt-5">
                <Alert variant="info" title="Profile Loaded">
                  {info}
                </Alert>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full pl-9 pr-10 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                fullWidth
                size="md"
                loading={loading}
                icon={ArrowRight}
                iconPosition="right"
                className="mt-2"
              >
                Sign In to Workspace
              </Button>
            </form>

            {/* Quick Demo Logins Helper */}
            <div className="mt-6 pt-5 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-2.5">
                Quick-Fill Demo Profiles
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fillAdminAccount}
                  className={`flex-1 py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    activeDemo === 'admin'
                      ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold'
                      : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                  <span>Admin Demo ({DEMO_ACCOUNTS.admin.username})</span>
                </button>
                <button
                  type="button"
                  onClick={fillEmployeeAccount}
                  className={`flex-1 py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    activeDemo === 'employee'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                      : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Employee Demo ({DEMO_ACCOUNTS.employee.username})</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              Protected by Enterprise JWT Authentication & Role-Based Access Control
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
