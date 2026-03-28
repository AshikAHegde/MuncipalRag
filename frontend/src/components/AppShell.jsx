import React from 'react';
import { FileText, Moon, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Ask AI', icon: Sparkles },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
];

const AppShell = ({ darkMode, onToggleDarkMode }) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.2),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_44%,_#f8fafc_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_24%),linear-gradient(180deg,_#07111f_0%,_#09172a_44%,_#050b14_100%)] dark:text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:120px_120px] opacity-30 dark:opacity-20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.22),_transparent_58%)] blur-3xl dark:bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.35),_transparent_58%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="glass-panel mb-8 flex flex-col gap-5 rounded-[28px] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300 via-cyan-300 to-amber-200 text-slate-950 shadow-[0_18px_45px_rgba(20,184,166,0.25)]">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-teal-700/80 dark:text-teal-200/80">Knowledge Engine</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">MuniRules RAG</h1>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-1.5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950 dark:shadow-[0_10px_25px_rgba(255,255,255,0.18)]'
                        : 'text-slate-600 hover:bg-slate-900/6 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <button
              onClick={onToggleDarkMode}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/70 text-slate-700 backdrop-blur-xl transition hover:bg-white hover:text-slate-950 dark:border-white/10 dark:bg-white/6 dark:text-slate-200 dark:hover:bg-white/12 dark:hover:text-white"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
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
