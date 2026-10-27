import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, Shield } from 'lucide-react';
import { getStoredUsername } from '../services/api';

export default function UserHeader({ onOpenMobile = () => {} }) {
  const username = getStoredUsername() || 'Signed in';

  return (
    <header
      className="mb-5 flex items-center justify-between gap-4 p-3 bg-white border border-slate-200 rounded-xl"
    >
      {/* Left: Mobile Menu Trigger & Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          className="lg:hidden p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="lg:hidden w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
            <Shield className="w-4 h-4" />
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>Sentinel Core Cluster</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-semibold">MongoDB Synchronized</span>
          </div>
        </div>
      </div>

      {/* Right: User Status Badge & Settings Shortcut */}
      <div className="flex items-center gap-2.5">
        <Link
          to="/settings"
          className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-semibold flex items-center justify-center">
            {username.slice(0, 1).toUpperCase()}
          </div>
          <span className="text-xs font-medium text-slate-800">
            {username}
          </span>
        </Link>
      </div>
    </header>
  );
}
