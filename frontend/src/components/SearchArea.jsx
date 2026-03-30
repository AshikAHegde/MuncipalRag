import React, { useEffect, useRef, useState } from 'react';
import { History, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import api from '../lib/api.js';
import AnswerCard from './AnswerCard.jsx';
import { useAuth } from '../hooks/useAuth.js';

const SearchArea = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadChatHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const response = await api.get('/api/query/history');

        if (!isCancelled) {
          const chats = (response.data.chats || []).map((chat, index) => ({
            id: `${chat.askedAt || Date.now()}-${index}`,
            question: chat.question,
            answer: chat.answer,
            sources: chat.sources || [],
            askedAt: chat.askedAt,
          }));

          setMessages(chats);
        }
      } catch (historyError) {
        if (!isCancelled) {
          setError(historyError.response?.data?.error || 'Unable to load your saved chat history.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadChatHistory();

    return () => {
      isCancelled = true;
    };
  }, []);

  const askQuestion = async (questionToAsk) => {
    if (!questionToAsk.trim() || isLoading) return;

    const trimmedQuestion = questionToAsk.trim();
    const history = messages.flatMap((message) => [
      { role: 'user', text: message.question },
      { role: 'model', text: message.answer },
    ]);

    setLastSubmittedQuery(trimmedQuestion);

    try {
      setIsLoading(true);
      setError(null);

      const res = await api.post('/api/query', {
        query: trimmedQuestion,
        history,
      });

      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to get answer');
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: res.data.chat?.askedAt || Date.now(),
          question: trimmedQuestion,
          answer: res.data.answer,
          sources: res.data.sources,
          askedAt: res.data.chat?.askedAt,
        },
      ]);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Something went wrong while searching the knowledge base.');
    } finally {
      setIsLoading(false);
      setQuery('');
    }
  };

  const handleSearch = async (event) => {
    event?.preventDefault();
    await askQuestion(query);
  };

  const historyPanel = (
    <>
      <div className="rounded-[20px] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs uppercase tracking-[0.28em] text-teal-700/75 dark:text-teal-200/75">Common User Area</p>
        <h2 className="mt-2.5 text-lg font-semibold text-slate-900 dark:text-white">{user?.fullName}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Ask questions about the uploaded PDFs and revisit your own saved conversations any time.
        </p>
      </div>

      <div className="mt-4 rounded-[20px] border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
            <History size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Your chat history</p>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              {messages.length} conversation{messages.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {isLoadingHistory ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/8 dark:bg-white/5 dark:text-slate-300">
              <Loader2 size={16} className="animate-spin" />
              Loading your chats...
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:text-slate-300">
              Your account does not have any saved conversations yet.
            </div>
          ) : (
            messages
              .slice()
              .reverse()
              .map((message) => (
                <button
                  key={`${message.id}-history`}
                  type="button"
                  onClick={() => {
                    setQuery(message.question);
                    setLastSubmittedQuery(message.question);
                    setIsMobileHistoryOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50/50 dark:border-white/8 dark:bg-white/5 dark:hover:border-teal-200/30 dark:hover:bg-white/8"
                >
                  <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">{message.question}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{message.answer}</p>
                </button>
              ))
          )}
        </div>
      </div>
    </>
  );

  return (
    <section className="glass-panel rounded-[28px] p-3.5 shadow-[0_24px_64px_rgba(2,8,23,0.4)] sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
        <aside className="hidden rounded-[24px] border border-slate-200/80 bg-white/65 p-4 dark:border-white/10 dark:bg-slate-950/40 lg:block">
          {historyPanel}
        </aside>

        <div className="order-1 flex min-h-[26rem] flex-col rounded-[24px] border border-slate-200/80 bg-white/65 p-3.5 dark:border-white/10 dark:bg-slate-950/40 sm:p-4 lg:order-2 lg:min-h-[30rem]">
          <div className="mb-3 lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileHistoryOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-[16px] border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:border-teal-300 hover:bg-teal-50 dark:border-white/10 dark:bg-white/6 dark:text-white dark:hover:bg-white/10"
            >
              <History size={17} />
              Open history
            </button>
          </div>

          <div className="mb-4 flex-1 overflow-y-auto rounded-[20px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(241,245,249,0.95))] p-4 sm:p-5 dark:border-white/6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.45),rgba(2,6,23,0.72))]">
            {messages.length === 0 && !isLoading && !isLoadingHistory && !error && (
              <div className="flex h-full min-h-[14rem] flex-col items-center justify-center text-center sm:min-h-[16rem]">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-teal-200 bg-white text-teal-600 shadow-[0_18px_40px_rgba(20,184,166,0.12)] dark:border-white/12 dark:bg-white/8 dark:text-teal-200 dark:shadow-[0_18px_40px_rgba(20,184,166,0.15)]">
                  <Search size={30} />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">What would you like to know?</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Ask any question about the uploaded municipal documents and the system will answer using the indexed PDF content.
                </p>
              </div>
            )}

            <AnimatePresence>
              {error && (
                <div
                  key="error"
                  className="rounded-[20px] border border-rose-300/60 bg-rose-50 p-5 dark:border-rose-400/20 dark:bg-rose-500/10"
                >
                  <p className="text-sm leading-6 text-rose-700 dark:text-rose-100">{error}</p>
                  <button
                    onClick={() => askQuestion(lastSubmittedQuery)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/8 dark:text-white dark:hover:bg-white/12"
                  >
                    <RefreshCw size={14} />
                    Try Again
                  </button>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={index > 0 ? 'mt-8' : ''}
                >
                  <AnswerCard
                    question={message.question}
                    answer={message.answer}
                    sources={message.sources}
                    animateTyping={index === messages.length - 1}
                  />
                </div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <div className={`flex flex-col gap-5 ${messages.length === 0 ? 'min-h-[14rem] justify-center sm:min-h-[16rem]' : 'mt-8'}`}>
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-[20px] rounded-tr-md bg-gradient-to-r from-teal-500 to-cyan-400 px-4 py-3.5 text-sm font-medium text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.2)]">
                    {lastSubmittedQuery || query}
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-teal-200 bg-white text-teal-600 dark:border-white/10 dark:bg-white/8 dark:text-teal-200">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                  <div className="flex-1 rounded-[20px] rounded-tl-md border border-slate-200 bg-white p-4 dark:border-white/8 dark:bg-white/6">
                    <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-white/12" />
                    <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-slate-100 dark:bg-white/8" />
                    <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-slate-100 dark:bg-white/8" />
                    <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-slate-100 dark:bg-white/8" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSearch} className="rounded-[20px] border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/6 dark:shadow-[0_20px_50px_rgba(15,23,42,0.22)]">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask about permits, taxes, zoning, water supply rules..."
                disabled={isLoading}
                className="min-h-11 min-w-0 flex-1 rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 disabled:opacity-50 dark:border-white/8 dark:bg-slate-950/45 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-teal-300/40"
              />
              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r from-teal-300 via-cyan-300 to-amber-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                Ask Now
              </button>
            </div>
            <p className="mt-3 px-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">RAG system powered by Gemini embeddings and Pinecone retrieval</p>
          </form>
        </div>
      </div>

      <AnimatePresence>
        {isMobileHistoryOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
              onClick={() => setIsMobileHistoryOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-[86vw] max-w-sm border-r border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(237,247,245,0.96))] p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(7,17,31,0.98),rgba(5,11,20,0.96))] lg:hidden">
              <div className="glass-panel flex h-full flex-col rounded-[24px] p-3.5">
                <div className="mb-3 flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-white/6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-teal-700/75 dark:text-teal-200/75">Chat Panel</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">History</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileHistoryOpen(false)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/6 dark:text-slate-200 dark:hover:bg-white/10"
                    aria-label="Close history"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto rounded-[20px] border border-slate-200/80 bg-white/55 p-3 dark:border-white/10 dark:bg-white/5">
                  {historyPanel}
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
};

export default SearchArea;
