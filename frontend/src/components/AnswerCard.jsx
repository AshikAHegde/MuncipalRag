import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileSpreadsheet,
  FileText,
  Gavel,
  Info,
  Loader2,
  RefreshCw,
  Scale,
  ShieldAlert,
  Square,
  Volume2,
} from 'lucide-react';
import api from '../lib/api.js';
import { DEFAULT_LANGUAGE, getTranslation } from '../lib/i18n.js';
import LegalKnowledgeGraph from './LegalKnowledgeGraph.jsx';

// ─── Domain configuration (colours + labels) ───────────────────────────────
const DOMAIN_CONFIG = {
  criminal: {
    label: 'Criminal',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    accent: 'border-l-rose-500',
    icon: ShieldAlert,
    dot: 'bg-rose-500',
    consequence: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  },
  civil: {
    label: 'Civil',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    accent: 'border-l-amber-500',
    icon: Scale,
    dot: 'bg-amber-500',
    consequence: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
  corporate: {
    label: 'Corporate',
    badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    accent: 'border-l-sky-500',
    icon: Gavel,
    dot: 'bg-sky-500',
    consequence: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  },
  tax: {
    label: 'Tax',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    accent: 'border-l-emerald-500',
    icon: AlertTriangle,
    dot: 'bg-emerald-500',
    consequence: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  },
};

const DEFAULT_DOMAIN_CONFIG = {
  label: 'Legal',
  badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  accent: 'border-l-slate-500',
  icon: Info,
  dot: 'bg-slate-500',
  consequence: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

// ─── Single Issue Card ────────────────────────────────────────────────────────
const IssueCard = ({ conflict, index }) => {
  const domain = (conflict.domain || '').toLowerCase();
  const config = DOMAIN_CONFIG[domain] || DEFAULT_DOMAIN_CONFIG;
  const DomainIcon = config.icon;

  const sectionLabel = conflict.section
    || (conflict.section_number ? `Section ${conflict.section_number}` : 'Unknown Section');
  const sectionName = conflict.section_name || '';

  return (
    <div
      className={`group relative rounded-2xl border border-white/8 bg-white/4 border-l-4 ${config.accent} p-5 backdrop-blur-sm transition-all duration-200 hover:bg-white/6 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Domain badge + section heading */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${config.badge}`}
          >
            <DomainIcon size={10} />
            {config.label}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            #{index + 1}
          </span>
        </div>
        <div className={`h-2 w-2 rounded-full ${config.dot} mt-1 shrink-0 opacity-70`} />
      </div>

      <h3 className="mb-1 text-base font-bold leading-snug text-white">
        {sectionLabel}
      </h3>
      {sectionName && (
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">
          {sectionName}
        </p>
      )}

      {/* 3 info rows */}
      <div className="space-y-3">
        {/* Issue Meaning */}
        {conflict.issue_meaning && (
          <div className="rounded-xl bg-white/4 px-4 py-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              What this means
            </p>
            <p className="text-sm leading-relaxed text-slate-200">
              {conflict.issue_meaning}
            </p>
          </div>
        )}

        {/* Why Flagged */}
        {conflict.why_flagged && (
          <div className="rounded-xl bg-white/4 px-4 py-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Why AI flagged this
            </p>
            <p className="text-sm leading-relaxed text-slate-200">
              {conflict.why_flagged}
            </p>
          </div>
        )}

        {/* Consequence */}
        {conflict.consequence && (
          <div className={`rounded-xl border px-4 py-3 ${config.consequence}`}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">
              Consequence
            </p>
            <p className="text-sm font-semibold leading-relaxed">
              {conflict.consequence}
            </p>
          </div>
        )}

        {/* Cross-Domain Impact (NEW) */}
        {conflict.cross_domain_impact && conflict.cross_domain_impact !== 'Standard domain-specific issue.' && (
          <div className="rounded-xl border border-[#a9d6f7]/20 bg-[#a9d6f7]/10 px-4 py-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a9d6f7]">
              Cross-Domain Impact
            </p>
            <p className="text-sm leading-relaxed text-[#a9d6f7]/90 italic">
              {conflict.cross_domain_impact}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Conflicts grid header ────────────────────────────────────────────────────
const ConflictsGrid = ({ conflicts, domain }) => {
  const domainCounts = conflicts.reduce((acc, c) => {
    const d = (c.domain || 'unknown').toLowerCase();
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mt-3">
      {/* Stats bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5">
          <ShieldAlert size={12} className="text-rose-400" />
          <span className="text-xs font-semibold text-white">{conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected</span>
        </div>
        {Object.entries(domainCounts).map(([d, count]) => {
          const cfg = DOMAIN_CONFIG[d] || DEFAULT_DOMAIN_CONFIG;
          return (
            <span
              key={d}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${cfg.badge}`}
            >
              {count} {cfg.label}
            </span>
          );
        })}
      </div>

      {/* Cards grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {conflicts.map((conflict, index) => (
          <IssueCard key={`${conflict.domain}-${conflict.section_number || index}`} conflict={conflict} index={index} />
        ))}
      </div>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDetailValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatDetailValue(item)).filter(Boolean).join(' | ');
  }
  if (typeof value === 'object') {
    const preferredKeys = ['title', 'fact', 'reason', 'section', 'note', 'source', 'explanation'];
    const preferredValues = preferredKeys
      .map((key) => value[key])
      .filter((item) => item != null && item !== '')
      .map((item) => formatDetailValue(item))
      .filter(Boolean);

    if (preferredValues.length > 0) {
      return preferredValues.join(' - ');
    }

    return Object.entries(value)
      .map(([key, item]) => `${key}: ${formatDetailValue(item)}`)
      .join(' | ');
  }
  return '';
};

const getFileNameFromDisposition = (dispositionHeader, fallbackFileName) => {
  if (!dispositionHeader) return fallbackFileName;
  const fileNameMatch = dispositionHeader.match(/filename\*?=(?:UTF-8''|\")?([^\";\n]+)/i);
  if (!fileNameMatch?.[1]) return fallbackFileName;
  return decodeURIComponent(fileNameMatch[1]).replace(/\"/g, '').trim() || fallbackFileName;
};

// ─── Main AnswerCard component ────────────────────────────────────────────────
const AnswerCard = ({
  mode = 'general',
  language = DEFAULT_LANGUAGE,
  question,
  answer,
  sources,
  review,
  sessionId,
  messageId,
  animateTyping = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedSources, setExpandedSources] = useState(false);
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechLoading, setIsSpeechLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [exportError, setExportError] = useState('');
  const [showGraph, setShowGraph] = useState(false);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [graphData, setGraphData] = useState(null);
  const audioRef = useRef(null);
  const t = getTranslation(language);

  // Conflicts from multi-domain parallel scan
  const conflicts = Array.isArray(review?.conflicts) ? review.conflicts : [];
  const hasConflicts = mode === 'lawyer' && conflicts.length > 0;

  useEffect(() => {
    if (!animateTyping) {
      setDisplayedAnswer(answer);
      setIsTyping(false);
      return;
    }

    let i = 0;
    setIsTyping(true);
    setDisplayedAnswer('');

    const speed = 8;
    const typeWriter = () => {
      if (i < answer.length) {
        setDisplayedAnswer(answer.substring(0, i + 1));
        i += 1;
        setTimeout(typeWriter, speed);
      } else {
        setIsTyping(false);
      }
    };

    typeWriter();
    return () => {
      i = answer.length;
    };
  }, [answer, animateTyping]);

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const exportReport = async (format) => {
    if (!sessionId || !messageId) {
      setExportError(t.exportUnavailable);
      return;
    }

    if (!review || !Array.isArray(review.lineReviews)) {
      setExportError(t.exportUnavailable);
      return;
    }

    setExportError('');
    const setLoading = format === 'pdf' ? setIsExportingPdf : setIsExportingExcel;
    setLoading(true);

    try {
      const response = await api.get('/api/query/export', {
        params: { sessionId, messageId, format },
        responseType: 'blob',
      });

      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      const fallbackName = `compliance-audit-report.${extension}`;
      const fileName = getFileNameFromDisposition(response.headers['content-disposition'], fallbackName);
      const blobType = response.headers['content-type'] || (format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const blob = new Blob([response.data], { type: blobType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error.response?.data?.error || error.message || t.exportFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = async () => {
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsSpeaking(false);
      return;
    }

    setAudioError('');
    setIsSpeechLoading(true);

    try {
      const response = await api.post('/api/speech/synthesize', { text: answer });
      if (!response.data?.success || !response.data?.audioBase64) {
        throw new Error(response.data?.error || 'Unable to generate speech audio.');
      }

      const src = `data:${response.data.mimeType || 'audio/wav'};base64,${response.data.audioBase64}`;
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setAudioError(t.audioPlaybackFailed);
        setIsSpeaking(false);
        audioRef.current = null;
      };

      await audio.play();
    } catch (error) {
      setAudioError(error.response?.data?.error || error.message || t.audioPlayError);
      setIsSpeaking(false);
    } finally {
      setIsSpeechLoading(false);
    }
  };

  const isNotAvailable =
    answer === 'Not available in rules'
    || answer.trim() === t.missingAnswer
    || answer.trim() === 'No sufficient retrieved legal basis found.';

  const legalReport = mode === 'lawyer' ? review : null;
  const summaryItems = Array.isArray(legalReport?.summary) ? legalReport.summary : (legalReport?.summary ? [legalReport.summary] : []);
  const relevantLegalSections = Array.isArray(legalReport?.relevant_legal_sections) ? legalReport.relevant_legal_sections : [];
  const validIssues = Array.isArray(legalReport?.final_result?.valid_issues) ? legalReport.final_result.valid_issues : [];
  const notApplicableIssues = Array.isArray(legalReport?.final_result?.not_applicable) ? legalReport.final_result.not_applicable : [];

  return (
    <div className="space-y-4">
      {/* User bubble - Compact Anchor Right */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-tr-none bg-[#3b82f6] px-4 py-2.5 text-white shadow-md ring-1 ring-[#3b82f6]/20">
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{question}</p>
        </div>
      </div>

      {/* AI response bubble - Compact Anchor Left */}
      <div className="flex flex-col items-start">
        <div className="premium-card w-full max-w-5xl rounded-xl rounded-tl-none px-4 py-3.5 dark:border-[#355269] dark:bg-[#1b2c3a] shadow-xl relative overflow-hidden">
          {/* Subtle AI Icon - Smaller */}
          <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md bg-moss-600/10 text-[8px] font-black uppercase tracking-widest text-moss-700 dark:bg-[#a9d6f7]/10 dark:text-[#a9d6f7]">
            AI
          </div>
          {/* Header row */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-y-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6b7280] dark:text-[#a9c3d8]">
              {mode === 'lawyer' ? t.lawyerModeShort : t.generalModeShort}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <div className="flex items-center gap-1 rounded-lg bg-moss-50/50 p-0.5 dark:bg-[#1d3344]/50">
                <button
                  type="button"
                  onClick={handleSpeak}
                  disabled={isSpeechLoading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-moss-100 hover:text-moss-700 disabled:opacity-50 dark:text-[#a9c3d8] dark:hover:bg-[#26465d] dark:hover:text-[#dce8f3]"
                  aria-label={isSpeaking ? t.stopSpeaking : t.speakAnswer}
                >
                  {isSpeaking ? <Square size={14} /> : <Volume2 size={14} />}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-moss-100 hover:text-moss-700 dark:text-[#a9c3d8] dark:hover:bg-[#26465d] dark:hover:text-[#dce8f3]"
                  aria-label={t.copyAnswer}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              {mode === 'compliance_review' && review?.lineReviews && (
                <div className="flex items-center gap-1 rounded-lg bg-moss-50/50 p-0.5 dark:bg-[#1d3344]/50">
                  <button
                    type="button"
                    onClick={() => exportReport('pdf')}
                    disabled={isExportingPdf || isExportingExcel}
                    className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6b7280] transition hover:bg-moss-100 hover:text-moss-700 disabled:opacity-50 dark:text-[#a9c3d8] dark:hover:bg-[#26465d] dark:hover:text-[#dce8f3]"
                    aria-label={t.exportPdf}
                  >
                    {isExportingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => exportReport('excel')}
                    disabled={isExportingPdf || isExportingExcel}
                    className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6b7280] transition hover:bg-moss-100 hover:text-moss-700 disabled:opacity-50 dark:text-[#a9c3d8] dark:hover:bg-[#26465d] dark:hover:text-[#dce8f3]"
                    aria-label={t.exportExcel}
                  >
                    {isExportingExcel ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                    XLSX
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── LAWYER MODE: Conflict Cards ────────────────────────────────── */}
          {hasConflicts ? (
            <div>
              {/* Summary text (brief) */}
              {!isNotAvailable && (
                <div className={`prose prose-sm max-w-none dark:prose-invert text-sm leading-relaxed ${isNotAvailable ? 'italic text-slate-500' : 'text-[#dce8f3]'}`}>
                  <ReactMarkdown>{displayedAnswer}</ReactMarkdown>
                  {isTyping && <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[#8ec3e8] dark:bg-[#62abdf]" />}
                </div>
              )}

              {/* Divider + heading */}
              <div className="mt-4 flex items-center gap-3 border-t border-white/8 pt-4">
                <ShieldAlert size={14} className="shrink-0 text-rose-400" />
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Conflict Report — All Domains Scanned
                </p>
              </div>

              <ConflictsGrid conflicts={conflicts} domain={review?.domain} />

              {/* Summary from legalReport */}
              {summaryItems.length > 0 && !isTyping && (
                <div className="mt-5 rounded-xl border border-white/8 bg-white/4 px-4 py-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Summary</p>
                  {summaryItems.map((item, index) => (
                    <p key={index} className={`${index > 0 ? 'mt-2' : ''} text-sm leading-relaxed text-slate-200`}>
                      {formatDetailValue(item)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── GENERAL / LAWYER (no conflicts) — original view ──────────── */
            <div>
              <div className={`prose prose-sm max-w-none dark:prose-invert ${isNotAvailable ? 'text-[#6b7280] italic dark:text-[#a9c3d8]' : 'text-[#1a1a1a] dark:text-[#dce8f3]'}`}>
                <ReactMarkdown>{displayedAnswer}</ReactMarkdown>
                {isTyping && <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[#8ec3e8] dark:bg-[#62abdf]" />}
              </div>

              {!isTyping && legalReport && (
                <div className="mt-4 space-y-3 border-t border-[#e6e0d6] pt-4 dark:border-[#355269]">
                  {legalReport.domain && (
                    <div className="rounded-lg border border-[#e6e0d6] bg-cream-100 px-3 py-2 text-xs uppercase tracking-[0.08em] text-[#6b7280] dark:border-[#355269] dark:bg-[#1d3344] dark:text-[#a9c3d8]">
                      Domain: {legalReport.domain}
                    </div>
                  )}

                  {summaryItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280] dark:text-[#a9c3d8]">Summary</p>
                      <div className="mt-2 rounded-lg border border-[#e6e0d6] bg-cream-100 px-3 py-2 text-sm dark:border-[#355269] dark:bg-[#1d3344]">
                        {summaryItems.map((item, index) => (
                          <p key={`${formatDetailValue(item) || index}-summary`} className={`${index > 0 ? 'mt-2' : ''} text-[#1a1a1a] dark:text-[#dce8f3]`}>
                            {formatDetailValue(item)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {relevantLegalSections.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280] dark:text-[#a9c3d8]">Relevant legal sections</p>
                      <div className="mt-2 space-y-2">
                        {relevantLegalSections.map((item, index) => (
                          <div key={`${formatDetailValue(item?.section) || index}-relevant`} className="rounded-lg border border-[#e6e0d6] bg-cream-100 px-3 py-3 text-sm dark:border-[#355269] dark:bg-[#1d3344]">
                            <p className="font-medium text-[#1a1a1a] dark:text-[#dce8f3]">{formatDetailValue(item?.section) || `Section ${index + 1}`}</p>
                            <div className="mt-2 space-y-2 text-xs text-[#6b7280] dark:text-[#a9c3d8]">
                              <p><span className="font-semibold uppercase tracking-[0.06em]">Why Applicable:</span> {formatDetailValue(item?.why_applicable) || 'Insufficient data'}</p>
                              <div>
                                <p className="font-semibold uppercase tracking-[0.06em]">Key Match:</p>
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                  {(Array.isArray(item?.key_match) ? item.key_match : [item?.key_match]).filter(Boolean).map((match, matchIndex) => (
                                    <li key={`${formatDetailValue(match) || matchIndex}-keymatch`}>{formatDetailValue(match)}</li>
                                  ))}
                                </ul>
                              </div>
                              <p><span className="font-semibold uppercase tracking-[0.06em]">Action / Punishment:</span> {formatDetailValue(item?.action_or_punishment) || 'Depends on court judgment'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(validIssues.length > 0 || notApplicableIssues.length > 0) && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280] dark:text-[#a9c3d8]">Final result</p>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div className="rounded-lg border border-[#e6e0d6] bg-cream-100 px-3 py-3 text-sm dark:border-[#355269] dark:bg-[#1d3344]">
                          <p className="font-medium text-[#1a1a1a] dark:text-[#dce8f3]">Valid issues</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#6b7280] dark:text-[#a9c3d8]">
                            {(validIssues.length > 0 ? validIssues : ['Insufficient data']).map((item, index) => (
                              <li key={`${formatDetailValue(item) || index}-valid`}>{formatDetailValue(item)}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-[#e6e0d6] bg-cream-100 px-3 py-3 text-sm dark:border-[#355269] dark:bg-[#1d3344]">
                          <p className="font-medium text-[#1a1a1a] dark:text-[#dce8f3]">Not applicable</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#6b7280] dark:text-[#a9c3d8]">
                            {(notApplicableIssues.length > 0 ? notApplicableIssues : ['None clearly excluded']).map((item, index) => (
                              <li key={`${formatDetailValue(item) || index}-notapplicable`}>{formatDetailValue(item)}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {audioError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{audioError}</p>}
          {exportError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{exportError}</p>}

          {/* Sources & Graph */}
          {!isTyping && sources && sources.length > 0 && !isNotAvailable && (
            <div className="mt-4 border-t border-[#e6e0d6] pt-3 dark:border-[#355269]">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setExpandedSources((value) => !value)}
                  className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[#6b7280] transition hover:text-moss-700 dark:text-[#a9c3d8] dark:hover:text-[#dce8f3]"
                >
                  <BookOpen size={13} />
                  {t.sources} ({sources.length})
                  {expandedSources ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (showGraph) {
                      setShowGraph(false);
                      return;
                    }
                    if (!sessionId || !messageId) return;
                    setIsLoadingGraph(true);
                    try {
                      // If it's a lawyer conflict report, show a focused conflict graph
                      const endpoint = (hasConflicts) 
                        ? `/api/graph/message/${sessionId}/${messageId}`
                        : `/api/graph/session/${sessionId}`;
                      
                      const response = await api.get(endpoint);
                      setGraphData(response.data.graph);
                      setShowGraph(true);
                    } catch (error) {
                      console.error('Failed to load graph:', error);
                    } finally {
                      setIsLoadingGraph(false);
                    }
                  }}
                  disabled={isLoadingGraph || !sessionId || !messageId}
                  className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[#6b7280] transition hover:text-blue-600 disabled:opacity-50 dark:text-[#a9c3d8] dark:hover:text-[#8ec3e8]"
                >
                  {isLoadingGraph ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Visualize Conflict Graph
                </button>
              </div>

              {expandedSources && (
                <div className="mt-3 space-y-2">
                  {sources.map((src, idx) => (
                    <div key={idx} className="rounded-lg border border-[#e6e0d6] bg-cream-100 px-3 py-2 text-xs dark:border-[#355269] dark:bg-[#1d3344]">
                      <div className="mb-1 flex items-center justify-between text-[#6b7280] dark:text-[#a9c3d8]">
                        <span>{t.page} {src.page}</span>
                        <span>{src.section}</span>
                      </div>
                      <p className="text-[#1a1a1a] dark:text-[#dce8f3]">{src.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {showGraph && graphData && (
                <div className="mt-4 animate-in fade-in zoom-in-95 duration-300">
                  <LegalKnowledgeGraph 
                    graphData={graphData} 
                    onClose={() => setShowGraph(false)}
                    title={`Session Graph: ${question.substring(0, 30)}...`}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnswerCard;
