import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import AnswerCard from './AnswerCard.jsx';

const SearchArea = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
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

      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/query`, {
        query: trimmedQuestion,
        history,
      });

      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to get answer');
      }

      setMessages((currentMessages) => [...currentMessages, {
        id: Date.now(),
        question: trimmedQuestion,
        answer: res.data.answer,
        sources: res.data.sources,
      }]);
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

  return (
    <section className="glass-panel rounded-[32px] p-4 shadow-[0_30px_80px_rgba(2,8,23,0.45)] sm:p-6">
      <div className="flex min-h-[34rem] flex-col rounded-[28px] border border-slate-200/80 bg-white/65 p-4 sm:p-5 dark:border-white/10 dark:bg-slate-950/40">
          <div className="mb-4 flex-1 overflow-y-auto rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(241,245,249,0.95))] p-4 sm:p-6 dark:border-white/6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.45),rgba(2,6,23,0.72))]">
            {messages.length === 0 && !isLoading && !error && (
              <div className="flex h-full min-h-[20rem] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-18 w-18 items-center justify-center rounded-3xl border border-teal-200 bg-white text-teal-600 shadow-[0_18px_40px_rgba(20,184,166,0.12)] dark:border-white/12 dark:bg-white/8 dark:text-teal-200 dark:shadow-[0_18px_40px_rgba(20,184,166,0.15)]">
                  <Search size={34} />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">What would you like to know?</h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-slate-600 dark:text-slate-300">
                  Ask any question about the uploaded municipal documents and the system will answer using the indexed PDF content.
                </p>
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-[24px] border border-rose-300/60 bg-rose-50 p-6 dark:border-rose-400/20 dark:bg-rose-500/10"
                >
                  <p className="text-sm leading-7 text-rose-700 dark:text-rose-100">{error}</p>
                  <button
                    onClick={() => askQuestion(lastSubmittedQuery)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/8 dark:text-white dark:hover:bg-white/12"
                  >
                    <RefreshCw size={14} />
                    Try Again
                  </button>
                </motion.div>
              )}

              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={index > 0 ? 'mt-8' : ''}
                >
                  <AnswerCard
                    question={message.question}
                    answer={message.answer}
                    sources={message.sources}
                    animateTyping={index === messages.length - 1}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <div className={`flex flex-col gap-6 ${messages.length === 0 ? 'min-h-[18rem] justify-center' : 'mt-8'}`}>
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-[24px] rounded-tr-md bg-gradient-to-r from-teal-500 to-cyan-400 px-5 py-4 text-sm font-medium text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.2)]">
                    {lastSubmittedQuery || query}
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-200 bg-white text-teal-600 dark:border-white/10 dark:bg-white/8 dark:text-teal-200">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                  <div className="flex-1 rounded-[24px] rounded-tl-md border border-slate-200 bg-white p-5 dark:border-white/8 dark:bg-white/6">
                    <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-white/12" />
                    <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-slate-100 dark:bg-white/8" />
                    <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-slate-100 dark:bg-white/8" />
                    <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-slate-100 dark:bg-white/8" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSearch} className="rounded-[24px] border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/6 dark:shadow-[0_20px_50px_rgba(15,23,42,0.22)]">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask about permits, taxes, zoning, water supply rules..."
                disabled={isLoading}
                className="min-w-0 flex-1 rounded-[18px] border border-slate-200 bg-white px-5 py-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-400 disabled:opacity-50 dark:border-white/8 dark:bg-slate-950/45 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-teal-300/40"
              />
              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-teal-300 via-cyan-300 to-amber-200 px-5 py-4 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                Ask Now
              </button>
            </div>
            <p className="mt-3 px-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">RAG system powered by Gemini embeddings and Pinecone retrieval</p>
          </form>
      </div>
    </section>
  );
};

export default SearchArea;
