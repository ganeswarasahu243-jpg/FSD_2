import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardCheck,
  ShieldCheck,
  Activity,
  FileText,
  Settings,
  GitFork,
  LogOut,
  Shield,
  X,
  ExternalLink,
} from 'lucide-react';
import { clearAuthSession, getStoredUsername } from '../services/api';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'policies', label: 'Policies', path: '/policies', icon: FileText },
  { id: 'monitoring', label: 'Monitoring', path: '/monitoring', icon: Activity },
  { id: 'frameworks', label: 'Frameworks', path: '/frameworks', icon: ShieldCheck },
  { id: 'audict', label: 'Audits', path: '/audits', icon: ClipboardCheck },
  { id: 'workflow', label: 'Workflow', path: '/workflow', icon: GitFork },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar({ mobileOpen = false, onCloseMobile = () => {} }) {
  const navigate = useNavigate();
  const username = getStoredUsername() || 'User';

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  const content = (
    <div
      className="flex h-full flex-col justify-between p-4 bg-white border border-slate-200 rounded-2xl"
    >
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <NavLink
            to="/dashboard"
            onClick={onCloseMobile}
            className="flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white group-hover:bg-blue-700 transition-colors">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline font-bold text-base text-slate-900 tracking-tight leading-tight">
                  Sentinel Core
                </span>
                <span className="px-1.5 py-0.2 text-[10px] font-semibold text-blue-800 bg-blue-50 rounded border border-blue-200">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-600">Compliance Suite</p>
            </div>
          </NavLink>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="mt-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="pt-3 border-t border-slate-200 space-y-2.5">
        <NavLink
          to="/settings"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-medium text-xs flex items-center justify-center shrink-0">
            {username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 truncate">{username}</p>
            <p className="text-[11px] text-slate-600">Authenticated</p>
          </div>
        </NavLink>

        <div className="flex items-center gap-2">
          <NavLink
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Public Site</span>
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-5 h-[calc(100dvh-2.5rem)]">
        {content}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Slide-over Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 p-3 lg:hidden transition-transform duration-200 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </div>
    </>
  );
}
