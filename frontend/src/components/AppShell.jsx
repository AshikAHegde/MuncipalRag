import React, { useState } from 'react';
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  ShieldCheck,
  Sun,
  UserCircle2,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const AppShell = ({ darkMode, onToggleDarkMode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/chat', label: 'Chat', icon: MessageSquareText },
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin Uploads', icon: ShieldCheck }] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.2),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_44%,_#f8fafc_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_24%),linear-gradient(180deg,_#07111f_0%,_#09172a_44%,_#050b14_100%)] dark:text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:120px_120px] opacity-30 dark:opacity-20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.22),_transparent_58%)] blur-3xl dark:bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.35),_transparent_58%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
        <header className="glass-panel mb-5 rounded-[24px] px-4 py-3.5 sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300 via-cyan-300 to-amber-200 text-slate-950 shadow-[0_18px_45px_rgba(20,184,166,0.25)]">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.32em] text-teal-700/80 dark:text-teal-200/80">Knowledge Engine</p>
                <h1 className="truncate text-lg font-semibold tracking-[0.01em] text-slate-900 dark:text-white sm:text-[1.75rem]">MuniRules RAG</h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileNavOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/70 text-slate-700 backdrop-blur-xl transition hover:bg-white lg:hidden dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
              aria-label="Toggle navigation"
            >
              {isMobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          <div className="mt-3.5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <nav className={`${isMobileNavOpen ? 'flex' : 'hidden'} flex-col gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-1.5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 lg:flex lg:flex-row lg:flex-wrap`}>
              {navItems.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setIsMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950 dark:shadow-[0_10px_25px_rgba(255,255,255,0.18)]'
                        : 'text-slate-600 hover:bg-slate-900/6 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white'
                    }`
                  }
                >
                  {React.createElement(icon, { size: 16 })}
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
              <div className="flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-2.5 backdrop-blur-xl dark:border-white/10 dark:bg-white/6">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
                  <UserCircle2 size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.fullName}</p>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{user?.role}</p>
                </div>
              </div>

              <button
                onClick={onToggleDarkMode}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/70 p-0 text-slate-700 backdrop-blur-xl transition hover:bg-white hover:text-slate-950 dark:border-white/10 dark:bg-white/6 dark:text-slate-200 dark:hover:bg-white/12 dark:hover:text-white"
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                onClick={handleLogout}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white/70 px-4 text-sm font-medium text-slate-700 backdrop-blur-xl transition hover:bg-white hover:text-slate-950 dark:border-white/10 dark:bg-white/6 dark:text-slate-200 dark:hover:bg-white/12 dark:hover:text-white"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
