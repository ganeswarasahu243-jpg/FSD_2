import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import UserHeader from './UserHeader';

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-body text-slate-900 antialiased">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row gap-5 p-4 sm:p-5 md:p-6">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />
        <main className="min-w-0 flex-1">
          <UserHeader onOpenMobile={() => setMobileMenuOpen(true)} />
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
