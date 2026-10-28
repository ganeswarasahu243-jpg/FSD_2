import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Lock, User, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
import { apiRequest, setAuthSession } from '../services/api';
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
    setUsername('jayasurya');
    setPassword('123456');
    setError(null);
    setInfo('Loaded Administrator credentials (jayasurya / 123456). Click "Sign In" to proceed.');
  };

  const fillEmployeeAccount = () => {
    setUsername('demo.employee');
    setPassword('demo1234');
    setError(null);
    setInfo('Loaded Employee credentials (demo.employee / demo1234). Click "Sign In" to proceed.');
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 md:p-8 bg-slate-950 font-sans">
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 flex flex-col lg:flex-row">
        {/* Left Brand Pane */}
        <div className="lg:w-1/2 p-6 md:p-10 bg-slate-900 flex flex-col justify-between text-white border-b lg:border-b-0 lg:border-r border-slate-800">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white group-hover:bg-blue-500 transition-colors">
                <Shield className="w-5 h-5" />
              </div>
              <span className="font-headline font-bold text-xl tracking-tight text-white">
                Sentinel Core
              </span>
            </Link>

            <div className="mt-10 space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-900/40 border border-blue-700/50 text-xs font-medium text-blue-300">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Enterprise Policy Compliance</span>
              </div>

              <h2 className="font-headline text-2xl lg:text-3xl font-bold text-white tracking-tight leading-snug">
                Machine-Readable Compliance Intelligence
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed">
                Automate policy extraction, audit framework cross-referencing (GDPR, SOC 2, HIPAA), and real-time internal risk telemetry.
              </p>
            </div>
          </div>

          {/* Pre-configured Demo Accounts Helper Box */}
          <div className="mt-8 p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-2.5">
            <span className="text-xs font-medium text-slate-200">
              Verified Testing Credentials
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700">
                <p className="font-semibold text-blue-400">Admin Account</p>
                <p className="text-slate-200 mt-1 text-[11px] tabular-nums">User: jayasurya</p>
                <p className="text-slate-300 text-[11px] tabular-nums">Pass: 123456</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700">
                <p className="font-semibold text-emerald-400">Employee Account</p>
                <p className="text-slate-200 mt-1 text-[11px] tabular-nums">User: demo.employee</p>
                <p className="text-slate-300 text-[11px] tabular-nums">Pass: demo1234</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Pane */}
        <div className="lg:w-1/2 p-6 md:p-10 bg-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-5 border-b border-slate-200">
              <div>
                <h1 className="font-headline text-2xl font-bold text-slate-900 tracking-tight">
                  Welcome Back
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Enter your credentials to access the Sentinel Workspace
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
                <Alert variant="danger" title="Authentication Error">
                  {error}
                </Alert>
              </div>
            )}

            {info && (
              <div className="mt-5">
                <Alert variant="info" title="Credential Loaded">
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
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-blue-700"
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
                    className="w-full pl-9 pr-10 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-blue-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800"
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
                Quick-Fill Test Logins
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fillAdminAccount}
                  className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  Admin (jayasurya)
                </button>
                <button
                  type="button"
                  onClick={fillEmployeeAccount}
                  className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  Employee (demo)
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              Protected by Enterprise JWT Authentication
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
