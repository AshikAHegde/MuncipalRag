import React, { useState } from 'react';
import { ArrowRight, BriefcaseBusiness, LockKeyhole, Mail, Phone, Scale, User2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const copyMap = {
  login: {
    eyebrow: 'Welcome Back',
    title: 'Login to your legal AI workspace',
    subtitle: 'Access the legal assistant, saved conversation history, and admin tools according to your account role.',
    cta: 'Login',
    alternateLabel: "Don't have an account?",
    alternateLink: '/signup',
    alternateText: 'Create one',
  },
  signup: {
    eyebrow: 'Create Account',
    title: 'Sign up for your legal AI portal',
    subtitle: 'Create a user, lawyer, or admin account and keep legal conversations linked to your profile.',
    cta: 'Create account',
    alternateLabel: 'Already have an account?',
    alternateLink: '/login',
    alternateText: 'Login',
  },
};

const initialForms = {
  login: { email: '', password: '' },
  signup: { fullName: '', email: '', phone: '', password: '', role: 'user', domain: '' },
};

const LEGAL_DOMAINS = [
  { label: 'Criminal', value: 'criminal' },
  { label: 'Civil', value: 'civil' },
  { label: 'Corporate', value: 'corporate' },
  { label: 'Tax', value: 'tax' },
];

const AuthForm = ({ mode }) => {
  const [formData, setFormData] = useState(initialForms[mode]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const copy = copyMap[mode];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
      ...(name === 'role' && value !== 'lawyer' ? { domain: '' } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      setIsSubmitting(true);

      if (mode === 'login') {
        const response = await login(formData);
        navigate(response.user.role === 'admin' ? '/admin' : '/', { replace: true });
        return;
      }

      const response = await register(formData);
      navigate(response.user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (submitError) {
      setError(submitError.response?.data?.error || submitError.message || 'Unable to continue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.22),_transparent_28%),linear-gradient(180deg,_#f7fbff_0%,_#edf7f5_46%,_#f8fafc_100%)] px-3 py-4 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.12),_transparent_28%),linear-gradient(180deg,_#04111d_0%,_#071723_46%,_#050b14_100%)] dark:text-slate-50 sm:px-5 sm:py-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.1)_1px,transparent_1px)] bg-[size:110px_110px] opacity-40 dark:opacity-20" />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1320px] items-center gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="glass-panel rounded-[26px] p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.34em] text-teal-700/75 dark:text-teal-200/80">{copy.eyebrow}</p>
          <h1 className="mt-2.5 max-w-xl text-[2rem] font-semibold leading-tight tracking-[0.01em] text-slate-950 dark:text-white sm:text-[2.35rem]">
            {copy.title}
          </h1>
          <p className="mt-3.5 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-[0.92rem]">
            {copy.subtitle}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Secure access', value: 'JWT login with protected routes' },
              { label: 'Role aware', value: 'User, lawyer, and admin accounts each get the right tools' },
              { label: 'Domain aware', value: 'Lawyer accounts route legal analysis through their selected domain' },
            ].map((item) => (
              <div key={item.label} className="rounded-[18px] border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/6">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-2.5 text-sm leading-6 text-slate-700 dark:text-slate-200">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-[26px] p-3 shadow-[0_24px_64px_rgba(2,8,23,0.28)] sm:p-4">
          <div className="rounded-[22px] border border-slate-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-slate-950/35 sm:p-5">
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Full name</span>
                  <div className="flex items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-white/6">
                    <User2 size={17} className="text-slate-400" />
                    <input
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="Ashik Hegde"
                      required
                      className="w-full bg-transparent outline-none placeholder:text-slate-400"
                    />
                  </div>
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
                <div className="flex items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-white/6">
                  <Mail size={17} className="text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-transparent outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Phone</span>
                  <div className="flex items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-white/6">
                    <Phone size={17} className="text-slate-400" />
                    <input
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="Optional"
                      className="w-full bg-transparent outline-none placeholder:text-slate-400"
                    />
                  </div>
                </label>
              )}

              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Account type</span>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { label: 'User', value: 'user', helper: 'General legal Q&A and history access' },
                      { label: 'Lawyer', value: 'lawyer', helper: 'Structured legal reports bound to one legal domain' },
                      { label: 'Admin', value: 'admin', helper: 'Includes upload and indexing tools' },
                    ].map((option) => {
                      const isActive = formData.role === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFormData((current) => ({ ...current, role: option.value }))}
                          className={`min-h-11 rounded-[16px] border px-4 py-3 text-left transition ${
                            isActive
                              ? 'border-teal-300 bg-teal-50 text-slate-900 dark:border-teal-200/40 dark:bg-teal-400/10 dark:text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-teal-200 dark:border-white/10 dark:bg-white/6 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {option.value === 'lawyer' ? <Scale size={16} /> : option.value === 'admin' ? <BriefcaseBusiness size={16} /> : <User2 size={16} />}
                            <p className="text-sm font-semibold">{option.label}</p>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{option.helper}</p>
                        </button>
                      );
                    })}
                  </div>
                </label>
              )}

              {mode === 'signup' && formData.role === 'lawyer' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Lawyer domain</span>
                  <div className="flex items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-white/6">
                    <Scale size={17} className="text-slate-400" />
                    <select
                      name="domain"
                      value={formData.domain}
                      onChange={handleChange}
                      required
                      className="w-full bg-transparent outline-none"
                    >
                      <option value="">Select legal domain</option>
                      {LEGAL_DOMAINS.map((option) => (
                        <option key={option.value} value={option.value} className="text-black">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Password</span>
                <div className="flex items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-white/6">
                  <LockKeyhole size={17} className="text-slate-400" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter password'}
                    required
                    className="w-full bg-transparent outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              {error && (
                <div className="rounded-[18px] border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r from-teal-300 via-cyan-300 to-sky-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{isSubmitting ? 'Please wait...' : copy.cta}</span>
                {!isSubmitting && <ArrowRight size={18} />}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-300">
              {copy.alternateLabel}{' '}
              <Link to={copy.alternateLink} className="font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-200 dark:hover:text-teal-100">
                {copy.alternateText}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AuthForm;
