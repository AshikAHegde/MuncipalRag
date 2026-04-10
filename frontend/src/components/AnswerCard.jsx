import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookOpen, Check, ChevronDown, ChevronUp, Copy, FileSpreadsheet, FileText, Loader2, Square, Volume2 } from 'lucide-react';
import api from '../lib/api.js';
import { DEFAULT_LANGUAGE, getTranslation } from '../lib/i18n.js';

const AnswerCard = ({
  mode = 'chat',
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
  const audioRef = useRef(null);
  const t = getTranslation(language);

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

  const getFileNameFromDisposition = (dispositionHeader, fallbackFileName) => {
    if (!dispositionHeader) return fallbackFileName;

    const fileNameMatch = dispositionHeader.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
    if (!fileNameMatch?.[1]) return fallbackFileName;

    return decodeURIComponent(fileNameMatch[1]).replace(/\"/g, '').trim() || fallbackFileName;
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
        params: {
          sessionId,
          messageId,
          format,
        },
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
    || answer.trim() === t.missingAnswer;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="premium-pill max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-sm dark:border-[#3c5c75] dark:bg-[#1d3344] dark:text-[#a9d6f7]">
          <p className="whitespace-pre-wrap break-words">{question}</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-moss-600 text-xs font-semibold text-white dark:bg-[#a9d6f7] dark:text-[#0f2434]">
          AI
        </div>

        <div className="premium-card w-full max-w-[85%] rounded-2xl rounded-tl-md px-4 py-3 dark:border-[#355269] dark:bg-[#1b2c3a]">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6b7280] dark:text-[#a9c3d8]">
              {mode === 'compliance_review' ? t.complianceReview : t.assistant}
            </div>
            <div className="flex items-center gap-1">
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
              {mode === 'compliance_review' && review?.lineReviews && (
                <>
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
                </>
              )}
            </div>
          </div>

          <div className={`prose prose-sm max-w-none dark:prose-invert ${isNotAvailable ? 'text-[#6b7280] italic dark:text-[#a9c3d8]' : 'text-[#1a1a1a] dark:text-[#dce8f3]'}`}>
            <ReactMarkdown>{displayedAnswer}</ReactMarkdown>
            {isTyping && <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[#8ec3e8] dark:bg-[#62abdf]" />}
          </div>

          {audioError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{audioError}</p>}
          {exportError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{exportError}</p>}

          {!isTyping && sources && sources.length > 0 && !isNotAvailable && (
            <div className="mt-4 border-t border-[#e6e0d6] pt-3 dark:border-[#355269]">
              <button
                type="button"
                onClick={() => setExpandedSources((value) => !value)}
                className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-[#6b7280] transition hover:text-moss-700 dark:text-[#a9c3d8] dark:hover:text-[#dce8f3]"
              >
                <BookOpen size={13} />
                {t.sources} ({sources.length})
                {expandedSources ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnswerCard;
