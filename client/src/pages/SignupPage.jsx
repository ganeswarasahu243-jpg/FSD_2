import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Lock, User, Mail, ShieldCheck, Check } from 'lucide-react';
import { apiRequest, setAuthSession } from '../services/api';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

export default function SignupPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest('/api/auth/register/', {
        method: 'POST',
        body: {
          username: username.trim(),
          password,
          role: 'employee',
          email: email.trim(),
        },
      });

      setAuthSession(
        data.access,
        data.refresh,
        data.user?.username || username,
        data.user?.role || 'employee'
      );
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-slate-950">
      <div className="w-full max-w-5xl rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 flex flex-col lg:flex-row">
        {/* Left Hero Pane */}
        <div className="lg:w-1/2 p-8 md:p-12 bg-slate-900 flex flex-col justify-between text-white border-b lg:border-b-0 lg:border-r border-slate-800">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white group-hover:bg-blue-600 transition-colors">
                <Shield className="w-5 h-5" />
              </div>
              <h1 className="font-headline font-bold text-2xl tracking-tight text-white">
                Sentinel Core
              </h1>
            </Link>

            <div className="mt-12 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                Workspace provisioning
              </div>

              <h2 className="font-headline text-2xl sm:text-3xl font-bold text-white leading-snug">
                Join Policy Intelligence
              </h2>

              <p className="text-sm text-slate-400 leading-relaxed">
                Operate continuous compliance monitoring, machine-readable rule synthesis, and audit-ready framework mapping across your organization.
              </p>
            </div>
          </div>

          {/* Feature Checklist */}
          <div className="mt-8 space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Full Access to PDF & DOCX Policy Interpreter</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>GDPR, SOC 2, and HIPAA Automated Controls</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Persistent MongoDB Encrypted Workspace</span>
            </div>
          </div>
        </div>

        {/* Right Form Pane */}
        <div className="lg:w-1/2 p-8 md:p-12 bg-white flex flex-col justify-between">
          <div className="max-w-md mx-auto w-full">
            {/* Top Switcher */}
            <div className="flex items-center justify-between mb-8">
              <span className="text-xs font-medium text-slate-500">
                New officer registration
              </span>
              <Link
                to="/login"
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors flex items-center gap-1"
              >
                Already have an account? Log In &rarr;
              </Link>
            </div>

            <div className="mb-6">
              <h3 className="font-headline text-2xl font-bold text-slate-900 tracking-tight">
                Create Account
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Set up your compliance profile to begin monitoring.
              </p>
            </div>

            {error && (
              <Alert variant="error" className="mb-5" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="choose.username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Work Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Min. 6 chars"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    Confirm <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="font-medium text-slate-700 hover:text-blue-700"
                >
                  {showPassword ? 'Hide Passwords' : 'Show Passwords'}
                </button>
                <span>Role: Employee / Compliance Officer</span>
              </div>

              <Button
                type="submit"
                loading={loading}
                fullWidth
                size="md"
                className="mt-3"
              >
                Create Account & Open Workspace
              </Button>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              By creating an account, you agree to organization audit logging and policy evaluation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
