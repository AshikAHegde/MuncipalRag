import React, { useEffect, useRef, useState } from 'react';
import {
  History,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import api from '../lib/api.js';
import { DEFAULT_LANGUAGE, getTranslation, LANGUAGE_OPTIONS } from '../lib/i18n.js';
import AnswerCard from './AnswerCard.jsx';
import { useAuth } from '../hooks/useAuth.js';

const normalizeMode = (mode) => (mode === 'lawyer' ? 'lawyer' : 'general');

const normalizeChatSessions = (sessions = []) =>
  sessions.map((session, sessionIndex) => ({
    id: session.id || `chat-${sessionIndex + 1}`,
    title: session.title || `Chat ${sessionIndex + 1}`,
    mode: normalizeMode(session.mode),
    language: session.language || DEFAULT_LANGUAGE,
    lastAskedAt: session.lastAskedAt || null,
    previewQuestion: session.previewQuestion || '',
    conversationCount: session.conversationCount || (session.conversations || []).length,
    conversations: (session.conversations || []).map((message, messageIndex) => ({
      id: message.id || `${message.askedAt || Date.now()}-${messageIndex}`,
      mode: normalizeMode(message.mode),
      language: message.language || session.language || DEFAULT_LANGUAGE,
      question: message.question || '',
      answer: message.answer || '',
      sources: message.sources || [],
      review: message.review || null,
      askedAt: message.askedAt || null,
    })),
  }));

const SearchArea = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState(user?.role === 'lawyer' ? 'lawyer' : 'general');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');
  const [lastSubmittedMode, setLastSubmittedMode] = useState(user?.role === 'lawyer' ? 'lawyer' : 'general');
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
    return window.localStorage.getItem('muni-rag-language') || DEFAULT_LANGUAGE;
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [voiceDraftNotice, setVoiceDraftNotice] = useState('');
  const inputRef = useRef(null);
  const chatViewportRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);

  const activeSession = chatSessions.find((session) => session.id === activeSessionId) || null;
  const activeMessages = activeSession?.conversations || [];
  const t = getTranslation(selectedLanguage);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode, activeSessionId]);

  useEffect(() => {
    if (user?.role !== 'lawyer' && mode === 'lawyer') {
      setMode('general');
    }
  }, [mode, user?.role]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('muni-rag-language', selectedLanguage);
    }
  }, [selectedLanguage]);

  useEffect(() => {
    const supportsMediaRecording =
      typeof navigator !== 'undefined' &&
      typeof window !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof window.MediaRecorder !== 'undefined';

    setIsSpeechSupported(supportsMediaRecording);

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadChatHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const response = await api.get('/api/query/history', {
          params: { language: selectedLanguage },
        });

        if (!isCancelled) {
          const sessions = normalizeChatSessions(response.data.chatSessions || []);
          setChatSessions(sessions);
          setActiveSessionId((currentActiveSessionId) =>
            sessions.some((session) => session.id === currentActiveSessionId)
              ? currentActiveSessionId
              : (sessions[sessions.length - 1]?.id || null),
          );

          if (sessions.length > 0 && !activeSessionId) {
            setMode(sessions[sessions.length - 1].mode || 'general');
          }
        }
      } catch (historyError) {
        if (!isCancelled) {
          setError(historyError.response?.data?.error || 'Unable to load chat history.');
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
  }, [selectedLanguage]);

  useEffect(() => {
    if (!chatViewportRef.current) return;

    chatViewportRef.current.scrollTo({
      top: chatViewportRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [activeMessages.length, isLoading, activeSessionId]);

  const startNewChat = (nextMode = mode) => {
    setActiveSessionId(null);
    setQuery('');
    setError(null);
    setSpeechError('');
    setVoiceDraftNotice('');
    setLastSubmittedQuery('');
    setLastSubmittedMode(nextMode);
    setMode(nextMode);
    setIsMobileHistoryOpen(false);
    inputRef.current?.focus();
  };

  const handleModeSwitch = (nextMode) => {
    if (mode === nextMode) return;
    startNewChat(nextMode);
  };

  const upsertChatSession = (nextSession) => {
    setChatSessions((currentSessions) => {
      const existingIndex = currentSessions.findIndex((session) => session.id === nextSession.id);

      if (existingIndex === -1) {
        return [...currentSessions, nextSession];
      }

      const updatedSessions = [...currentSessions];
      updatedSessions[existingIndex] = nextSession;
      return updatedSessions;
    });
  };

  const askQuestion = async (questionToAsk, selectedMode = mode) => {
    if (!questionToAsk.trim() || isLoading) return;

    const trimmedQuestion = questionToAsk.trim();
    const canAppendToActiveSession =
      activeSession
      && (activeSession.mode || 'general') === selectedMode
      && (activeSession.language || DEFAULT_LANGUAGE) === selectedLanguage;
    const history = canAppendToActiveSession
      ? activeMessages.flatMap((message) => [
          { role: 'user', text: message.question },
          { role: 'model', text: message.answer },
        ])
      : [];

    setLastSubmittedQuery(trimmedQuestion);
    setLastSubmittedMode(selectedMode);

    try {
      setIsLoading(true);
      setError(null);

      const payload = {
        mode: selectedMode,
        query: trimmedQuestion,
        history,
        language: selectedLanguage,
        sessionId: canAppendToActiveSession ? activeSession.id : undefined,
      };

      const response = await api.post('/api/query', payload);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get answer');
      }

      const nextSession = normalizeChatSessions([response.data.chatSession || {}])[0];
      if (nextSession) {
        upsertChatSession(nextSession);
        setActiveSessionId(nextSession.id);
        setMode(nextSession.mode || selectedMode);
      }

      setQuery('');
      setIsMobileHistoryOpen(false);
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.error || requestError.message || 'Something went wrong while processing your query.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (event) => {
    event?.preventDefault();
    setVoiceDraftNotice('');
    await askQuestion(query, mode);
  };

  const stopMediaStream = () => {
    if (!mediaStreamRef.current) return;
    mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const transcribeAndDraft = async (blob) => {
    setIsTranscribing(true);
    try {
      const audioBase64 = await blobToBase64(blob);
      if (!audioBase64) {
        throw new Error('Failed to read recorded audio.');
      }

      const response = await api.post('/api/speech/transcribe', {
        audioBase64,
        mimeType: blob.type || 'audio/webm',
      });

      const transcript = response.data?.transcript?.trim() || '';
      if (!transcript) {
        throw new Error('No speech was detected in the recording.');
      }

      setQuery(transcript);
      setVoiceDraftNotice(t.voiceDraftNotice);
      inputRef.current?.focus();
    } catch (transcriptionError) {
      setSpeechError(transcriptionError.response?.data?.error || transcriptionError.message || 'Voice transcription failed.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleVoiceInput = async () => {
    if (!isSpeechSupported || isLoading || isTranscribing) return;
    setSpeechError('');

    if (isRecording) {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => setIsRecording(true);
      recorder.onerror = () => {
        setSpeechError(t.microphoneFailed);
        setIsRecording(false);
        stopMediaStream();
      };
      recorder.onstop = async () => {
        setIsRecording(false);
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        stopMediaStream();
        await transcribeAndDraft(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (_error) {
      setSpeechError(t.microphoneBlocked);
      setIsRecording(false);
      stopMediaStream();
    }
  };

  const historyList = (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => startNewChat(mode)}
        className="premium-btn-primary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
      >
        <Plus size={15} />
        {t.newChat}
      </button>

      {isLoadingHistory ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#e6e0d6] bg-cream-100 px-3 py-2 text-sm text-[#6b7280] dark:border-[#355269] dark:bg-[#1b2c3a] dark:text-[#a9c3d8]">
          <Loader2 size={14} className="animate-spin" />
          {t.loadingChats}
        </div>
      ) : chatSessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#d8d1c5] px-3 py-3 text-sm text-[#6b7280] dark:border-[#355269] dark:text-[#a9c3d8]">
          {t.noSavedChats}
        </div>
      ) : (
        chatSessions
          .slice()
          .sort((a, b) => new Date(b.lastAskedAt || 0).getTime() - new Date(a.lastAskedAt || 0).getTime())
          .map((session, index) => (
            <button
              key={`${session.id}-history`}
              type="button"
              onClick={() => {
                setActiveSessionId(session.id);
                setMode(session.mode || 'general');
                setQuery('');
                setError(null);
                setLastSubmittedQuery('');
                setIsMobileHistoryOpen(false);
                inputRef.current?.focus();
              }}
              className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                session.id === activeSessionId
                  ? 'border-[#83b9e7] bg-[#e8f3fb] dark:border-[#4f7391] dark:bg-[#1d3344]'
                  : 'premium-card hover:border-[#b9d8f2] hover:bg-moss-50 dark:hover:border-[#3c5c75] dark:hover:bg-[#1d3344]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#1a1a1a] dark:text-[#dce8f3]">
                  {session.title || `Chat ${index + 1}`}
                </p>
                <span className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-[#6b7280] dark:text-[#a9c3d8]">
                  {session.mode === 'lawyer' ? t.lawyerModeShort : t.generalModeShort}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#6b7280] dark:text-[#a9c3d8]">
                {session.previewQuestion || t.noMessagesYet}
              </p>
            </button>
          ))
      )}
    </div>
  );

  return (
    <section className="premium-surface flex h-full min-h-0 w-full flex-1 overflow-hidden rounded-xl dark:border-[#355269] dark:bg-[#1b2c3a]">
      <aside className="hidden w-72 shrink-0 border-r border-[#e6e0d6] bg-cream-100 px-4 py-4 dark:border-[#355269] dark:bg-[#1b2c3a] lg:flex lg:flex-col">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#6b7280] dark:text-[#a9c3d8]">Operator</p>
          <p className="mt-1 text-sm font-semibold text-[#1a1a1a] dark:text-[#dce8f3]">{user?.fullName}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#d7d1c5] bg-cream-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b7280] dark:border-[#355269] dark:bg-[#1d3344] dark:text-[#a9c3d8]">
              {user?.role}
            </span>
            {user?.domain && (
              <span className="rounded-full border border-[#c5dff3] bg-[#e8f3fb] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-moss-700 dark:border-[#4f7391] dark:bg-[#1d3344] dark:text-[#a9d6f7]">
                {user.domain}
              </span>
            )}
          </div>
        </div>
        {historyList}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e6e0d6] bg-cream-50 px-4 dark:border-[#355269] dark:bg-[#1b2c3a]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileHistoryOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2ddd4] text-[#6b7280] lg:hidden dark:border-[#355269] dark:text-[#a9c3d8]"
            >
              <History size={15} />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-[#1a1a1a] dark:text-[#dce8f3]">
                {activeSession?.title || t.newChat}
              </h2>
              <p className="truncate text-xs text-[#6b7280] dark:text-[#a9c3d8]">
                {activeSession
                  ? `${activeSession.mode === 'lawyer' ? t.lawyerModeShort : t.generalModeShort} · ${t.conversations(activeSession.conversationCount)}`
                  : 'General guidance or lawyer analysis'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="hidden items-center gap-2 rounded-lg border border-[#e2ddd4] px-3 text-sm text-[#6b7280] dark:border-[#355269] dark:text-[#a9c3d8] sm:inline-flex">
              <span>{t.language}</span>
              <select
                value={selectedLanguage}
                onChange={(event) => setSelectedLanguage(event.target.value)}
                className="bg-transparent text-sm outline-none"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code} className="text-black">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => startNewChat(user?.role === 'lawyer' ? 'lawyer' : 'general')}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e2ddd4] px-3 text-sm text-[#6b7280] transition hover:bg-moss-50 dark:border-[#355269] dark:text-[#a9c3d8] dark:hover:bg-[#1d3344]"
            >
              <Plus size={14} />
              {t.newButton}
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('general')}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition ${
                mode === 'general'
                  ? 'premium-btn-primary'
                  : 'premium-btn-secondary dark:text-[#a9c3d8] dark:hover:bg-[#1d3344]'
              }`}
            >
              <MessageSquareText size={14} />
              {t.generalModeShort}
            </button>
            {user?.role === 'lawyer' && (
              <button
                type="button"
                onClick={() => handleModeSwitch('lawyer')}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition ${
                  mode === 'lawyer'
                    ? 'premium-btn-primary'
                    : 'premium-btn-secondary dark:text-[#a9c3d8] dark:hover:bg-[#1d3344]'
                }`}
              >
                <Search size={14} />
                {t.lawyerModeShort}
              </button>
            )}
          </div>
        </header>

        <div ref={chatViewportRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-cream-100 px-4 py-5 touch-pan-y dark:bg-[#0f1820] sm:px-6">
          {activeMessages.length === 0 && !isLoading && !error && (
            <div className="premium-card mx-auto mt-8 max-w-xl rounded-xl p-6 text-center">
              <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#dce8f3]">
                {activeSession ? t.welcomeExisting : (mode === 'lawyer' ? 'Start a lawyer-mode analysis' : t.welcomeNew)}
              </h3>
              <p className="mt-2 text-sm text-[#6b7280] dark:text-[#a9c3d8]">
                {mode === 'lawyer'
                  ? 'Paste a client report to trigger domain-filtered retrieval, legal comparison, and a structured issue report.'
                  : 'Ask for a simple legal explanation. The orchestrator will infer the most relevant domain and retrieve only grounded legal text.'}
              </p>
            </div>
          )}

          {error && (
            <div className="mx-auto mb-4 max-w-2xl rounded-xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-500/40 dark:bg-rose-500/10">
              <p className="text-sm text-rose-700 dark:text-rose-200">{error}</p>
              <button
                type="button"
                onClick={() => askQuestion(lastSubmittedQuery, lastSubmittedMode)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#e2ddd4] bg-cream-50 px-3 py-2 text-sm text-[#6b7280] hover:bg-moss-50 dark:border-[#355269] dark:bg-[#1b2c3a] dark:text-[#a9c3d8] dark:hover:bg-[#1d3344]"
              >
                <RefreshCw size={14} />
                {t.retry}
              </button>
            </div>
          )}

          <div className="mx-auto max-w-3xl space-y-6">
            {activeMessages.map((message, index) => (
              <AnswerCard
                key={message.id}
                mode={message.mode || 'general'}
                question={message.question}
                answer={message.answer}
                sources={message.sources}
                review={message.review}
                sessionId={activeSession?.id || null}
                messageId={message.id}
                language={message.language || activeSession?.language || selectedLanguage}
                animateTyping={index === activeMessages.length - 1}
              />
            ))}

            {isLoading && (
              <div className="space-y-4">
                <div className="premium-pill rounded-xl px-4 py-3 text-center dark:border-[#355269] dark:bg-[#1d3344]">
                  <p className="text-base font-semibold uppercase tracking-[0.08em] text-moss-700 dark:text-[#a9d6f7]">{t.processingTitle}</p>
                  <p className="mt-1 text-sm text-[#6b7280] dark:text-[#a9c3d8]">{t.processingBody}</p>
                </div>
                <div className="h-24 animate-pulse rounded-xl border border-[#e6e0d6] bg-cream-50 dark:border-[#355269] dark:bg-[#1b2c3a]" />
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSearch} className="shrink-0 border-t border-[#e6e0d6] bg-cream-50 px-4 py-3 dark:border-[#355269] dark:bg-[#1b2c3a]">
          <div className="mx-auto max-w-3xl">
            <div className="mb-2 sm:hidden">
              <label className="flex items-center justify-between rounded-lg border border-[#e2ddd4] px-3 py-2 text-sm text-[#6b7280] dark:border-[#355269] dark:text-[#a9c3d8]">
                <span>{t.language}</span>
                <select
                  value={selectedLanguage}
                  onChange={(event) => setSelectedLanguage(event.target.value)}
                  className="bg-transparent text-sm outline-none"
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code} className="text-black">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="premium-input flex items-end gap-2 rounded-xl p-2 dark:bg-[#1b2c3a]">
              {mode === 'lawyer' ? (
                <textarea
                  ref={inputRef}
                  rows={3}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setVoiceDraftNotice('');
                  }}
                  placeholder={t.lawyerPlaceholder}
                  disabled={isLoading}
                  className="max-h-44 min-h-20 flex-1 resize-y border-0 bg-transparent px-2 py-1 text-sm text-[#1a1a1a] outline-none placeholder:text-[#8a8f99] disabled:opacity-50 dark:text-[#dce8f3] dark:placeholder:text-[#95afc4]"
                />
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setVoiceDraftNotice('');
                  }}
                  placeholder={t.generalPlaceholder}
                  disabled={isLoading}
                  className="h-10 flex-1 border-0 bg-transparent px-2 text-sm text-[#1a1a1a] outline-none placeholder:text-[#8a8f99] disabled:opacity-50 dark:text-[#dce8f3] dark:placeholder:text-[#95afc4]"
                />
              )}

              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={!isSpeechSupported || isLoading || isTranscribing}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                  isRecording
                    ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300'
                    : 'border-[#cfdfec] bg-cream-50 text-[#6b7280] hover:bg-moss-50 dark:border-[#355269] dark:bg-[#1b2c3a] dark:text-[#a9c3d8] dark:hover:bg-[#1d3344]'
                } disabled:opacity-50`}
                aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
              >
                {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
              </button>

              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="premium-btn-primary inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                {t.send}
              </button>
            </div>

            {speechError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{speechError}</p>}
            {voiceDraftNotice && <p className="mt-2 text-xs text-moss-700 dark:text-[#a9d6f7]">{voiceDraftNotice}</p>}
            {isTranscribing && <p className="mt-2 text-xs text-[#6b7280] dark:text-[#a9c3d8]">{t.transcribing}</p>}
          </div>
        </form>
      </div>

      {isMobileHistoryOpen && (
        <>
          <button
            type="button"
            onClick={() => setIsMobileHistoryOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label={t.closeHistory}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[86vw] max-w-sm border-r border-[#e6e0d6] bg-cream-50 p-4 lg:hidden dark:border-[#355269] dark:bg-[#1b2c3a]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1a1a1a] dark:text-[#dce8f3]">{t.chatHistory}</h3>
              <button
                type="button"
                onClick={() => setIsMobileHistoryOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2ddd4] text-[#6b7280] dark:border-[#355269] dark:text-[#a9c3d8]"
                aria-label={t.closeHistoryPanel}
              >
                <X size={15} />
              </button>
            </div>
            {historyList}
          </div>
        </>
      )}
    </section>
  );
};

export default SearchArea;
