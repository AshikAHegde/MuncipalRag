import React, { useEffect, useState } from 'react';
import { ArrowRight, FileStack, LayoutDashboard, MessageSquareText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

const DashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ chats: 0, documents: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const loadStats = async () => {
      try {
        setIsLoading(true);
        const requests = [api.get('/api/query/history')];

        if (user?.role === 'admin') {
          requests.push(api.get('/api/admin/documents'));
        }

        const [historyResponse, documentsResponse] = await Promise.all(requests);

        if (!isCancelled) {
          setStats({
            chats: historyResponse.data.chats?.length || 0,
            documents: documentsResponse?.data?.documents?.length || 0,
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      isCancelled = true;
    };
  }, [user?.role]);

  const quickLinks = [
    {
      to: '/chat',
      title: 'Open chat workspace',
      description: 'Ask questions, continue user conversations, and review saved answers.',
      icon: MessageSquareText,
    },
    ...(user?.role === 'admin'
      ? [
          {
            to: '/admin',
            title: 'Open admin uploads',
            description: 'Upload fresh PDFs and manage the indexed municipal knowledge base.',
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  return (
    <section className="space-y-4">
      <div className="glass-panel rounded-[26px] p-3.5 sm:p-4">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[22px] border border-slate-200/80 bg-white/70 p-4.5 dark:border-white/10 dark:bg-slate-950/35 sm:p-5">
            <p className="text-xs uppercase tracking-[0.32em] text-teal-700/75 dark:text-teal-200/80">Dashboard</p>
            <h2 className="mt-2.5 text-[1.8rem] font-semibold tracking-[0.01em] text-slate-900 dark:text-white sm:text-[2rem]">
              Workspace overview for {user?.fullName}
            </h2>
            <p className="mt-3 max-w-none text-sm leading-6 text-slate-600 dark:text-slate-300">
              Use the navbar to move between your dashboard, chat assistant, and admin tools. The portal now separates common user and admin flows while keeping chat history linked to the logged-in account.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/chat"
                className="inline-flex items-center gap-2 rounded-[15px] bg-slate-900 px-4.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                Go to chat
                <ArrowRight size={16} />
              </Link>
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 rounded-[15px] border border-slate-200 bg-white px-4.5 py-2 text-sm font-semibold text-slate-900 transition hover:border-teal-300 hover:bg-teal-50 dark:border-white/10 dark:bg-white/6 dark:text-white dark:hover:bg-white/10"
                >
                  Open admin panel
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[22px] border border-slate-200/80 bg-white/70 p-4.5 dark:border-white/10 dark:bg-slate-950/35">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300 via-cyan-300 to-amber-200 text-slate-950">
                  <MessageSquareText size={20} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Saved Chats</p>
                  <p className="text-[1.65rem] font-semibold text-slate-900 dark:text-white">{isLoading ? '...' : stats.chats}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-200/80 bg-white/70 p-4.5 dark:border-white/10 dark:bg-slate-950/35">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
                  {user?.role === 'admin' ? <FileStack size={20} /> : <LayoutDashboard size={20} />}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    {user?.role === 'admin' ? 'Indexed PDFs' : 'Role'}
                  </p>
                  <p className="text-[1.65rem] font-semibold text-slate-900 dark:text-white">
                    {user?.role === 'admin' ? (isLoading ? '...' : stats.documents) : user?.role}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="glass-panel rounded-[26px] p-4">
          <h3 className="text-[1.02rem] font-semibold tracking-[0.01em] text-slate-900 dark:text-white">Quick navigation</h3>
          <div className="mt-3.5 space-y-3">
            {quickLinks.map(({ to, title, description, icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-start justify-between gap-4 rounded-[18px] border border-slate-200/80 bg-white/75 p-3.5 transition hover:border-teal-300 hover:bg-teal-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-teal-200/25 dark:hover:bg-white/8"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
                    {React.createElement(icon, { size: 18 })}
                  </div>
                  <div>
                    <p className="text-[0.95rem] font-semibold tracking-[0.01em] text-slate-900 dark:text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
                  </div>
                </div>
                <ArrowRight size={16} className="mt-1 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[26px] p-4">
          <h3 className="text-[1.02rem] font-semibold tracking-[0.01em] text-slate-900 dark:text-white">Navigation guide</h3>
          <div className="mt-3.5 grid gap-3">
            {[
              'Dashboard gives a summary of your account and workspace activity.',
              'Chat is where common users and admins can ask questions from the indexed files.',
              user?.role === 'admin'
                ? 'Admin Uploads lets admins upload and process new PDFs.'
                : 'Admin tools stay hidden for normal users.',
            ].map((item) => (
              <div key={item} className="rounded-[20px] border border-slate-200/80 bg-white/75 px-4 py-3.5 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardPage;
