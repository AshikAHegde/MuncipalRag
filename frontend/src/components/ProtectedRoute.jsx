import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';

const LoadingState = () => (
  <div className="flex min-h-screen items-center justify-center px-4 sm:px-6">
    <div className="glass-panel w-full max-w-md rounded-[28px] p-6 text-center sm:p-8">
      <p className="text-xs uppercase tracking-[0.3em] text-teal-700/70 dark:text-teal-200/80">Loading Session</p>
      <h2 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">Checking your workspace</h2>
      <div className="mx-auto mt-6 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-400 dark:border-white/10 dark:border-t-teal-300" />
    </div>
  </div>
);

const ForbiddenState = () => (
  <div className="flex min-h-screen items-center justify-center px-4 sm:px-6">
    <div className="glass-panel w-full max-w-lg rounded-[28px] p-6 text-center sm:p-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200">
        <ShieldAlert size={28} />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-slate-900 dark:text-white">Admin access required</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
        This area is only available to admin accounts. Please sign in with an admin profile to continue.
      </p>
    </div>
  </div>
);

const ProtectedRoute = ({ requireAdmin = false }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <ForbiddenState />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
