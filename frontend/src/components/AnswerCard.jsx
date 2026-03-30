import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const AnswerCard = ({ question, answer, sources, animateTyping = true }) => {
    const [copied, setCopied] = useState(false);
    const [expandedSources, setExpandedSources] = useState(false);
    const [displayedAnswer, setDisplayedAnswer] = useState('');
    const [isTyping, setIsTyping] = useState(true);

    // Typing effect
    useEffect(() => {
        if (!animateTyping) {
            setDisplayedAnswer(answer);
            setIsTyping(false);
            return;
        }

        let i = 0;
        setIsTyping(true);
        setDisplayedAnswer('');

        const speed = 15; // ms per char

        const typeWriter = () => {
            if (i < answer.length) {
                setDisplayedAnswer(answer.substring(0, i + 1));
                i++;
                setTimeout(typeWriter, speed);
            } else {
                setIsTyping(false);
            }
        };

        typeWriter();
        return () => { i = answer.length; }; // cleanup
    }, [answer, animateTyping]);

    const handleCopy = () => {
        navigator.clipboard.writeText(answer);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isNotAvailable = answer === "Not available in rules";

    return (
        <div className="space-y-5">
            <div className="flex justify-end">
                <div className="max-w-[92%] rounded-[20px] rounded-tr-md bg-gradient-to-r from-teal-300 via-cyan-300 to-amber-200 px-4 py-3 text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.2)] sm:max-w-[85%] sm:px-5 sm:py-4">
                    <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6">{question}</p>
                </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-teal-200 bg-white shadow-md dark:border-white/10 dark:bg-white/8 sm:h-11 sm:w-11">
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-200">AI</span>
                </div>

                <div className="group w-full min-w-0 rounded-[22px] rounded-tl-md border border-slate-200 bg-white/85 px-4 py-4 shadow-[0_20px_60px_rgba(2,6,23,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/6 dark:shadow-[0_20px_60px_rgba(2,6,23,0.18)] sm:rounded-[28px] sm:px-6 sm:py-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Response</span>

                        <button
                            onClick={handleCopy}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 sm:h-9 sm:w-9 sm:opacity-0 group-hover:sm:opacity-100 dark:hover:bg-white/8 dark:hover:text-white"
                            aria-label="Copy answer"
                            title="Copy answer"
                        >
                            {copied ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}
                        </button>
                    </div>

                    <div className={`prose prose-sm max-w-none break-words text-sm leading-relaxed dark:prose-invert sm:prose-base ${isNotAvailable ? 'text-slate-500 italic dark:text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                        <ReactMarkdown>{displayedAnswer}</ReactMarkdown>
                        {isTyping && <span className="ml-1 inline-block h-4 w-1.5 animate-pulse align-middle bg-teal-300"></span>}
                    </div>

                    {!isTyping && sources && sources.length > 0 && !isNotAvailable && (
                        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-white/8">
                            <button
                                onClick={() => setExpandedSources(!expandedSources)}
                                className="flex min-h-11 items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-950 focus:outline-none dark:text-slate-300 dark:hover:text-white"
                            >
                                <BookOpen size={16} />
                                <span className="font-medium">View Sources ({sources.length})</span>
                                {expandedSources ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            <AnimatePresence>
                                {expandedSources && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-4 space-y-3">
                                            {sources.map((src, idx) => (
                                                <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-white/8 dark:bg-slate-950/35">
                                                    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700 dark:text-teal-200">Page {src.page}</span>
                                                        <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{src.section}</span>
                                                    </div>
                                                    <p className="line-clamp-4 break-words text-slate-700 transition-all hover:line-clamp-none dark:text-slate-300">{src.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnswerCard;
