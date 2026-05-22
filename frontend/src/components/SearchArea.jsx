import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  History,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  Network,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import api from '../lib/api.js';
import { DEFAULT_LANGUAGE, getTranslation, LANGUAGE_OPTIONS } from '../lib/i18n.js';
import AnswerCard from './AnswerCard.jsx';
import LegalKnowledgeGraph from './LegalKnowledgeGraph.jsx';
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

const SearchArea = ({
  clientId = null,
  clientName = '',
  initialQuery = '',
  autoSubmit = false,
  singleRun = false,
}) => {
  const { user } = useAuth();
  const isSingleRun = singleRun || Boolean(clientId);
  const [query, setQuery] = useState('');
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('preferredMode');
    return (user?.role === 'lawyer' && savedMode === 'lawyer') ? 'lawyer' : 'general';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');
  const [lastSubmittedMode, setLastSubmittedMode] = useState(mode);
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
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  const inputRef = useRef(null);
  const chatViewportRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(288);
  const [sidebarWidth, setSidebarWidth] = useState(288); // 18rem
  const [showSessionGraph, setShowSessionGraph] = useState(false);
  const [isLoadingSessionGraph, setIsLoadingSessionGraph] = useState(false);
  const [sessionGraphData, setSessionGraphData] = useState(null);
  const MIN_SIDEBAR = 180;
  const MAX_SIDEBAR = 480;
  const GRAPH_SIDEBAR_WIDTH = 450;

  const activeSession = useMemo(
    () => chatSessions.find((session) => session.id === activeSessionId) || null,
    [activeSessionId, chatSessions],
  );
  const activeMessages = useMemo(
    () => activeSession?.conversations || [],
    [activeSession],
  );
  const t = getTranslation(selectedLanguage);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode, activeSessionId]);

  useEffect(() => {
    if (user?.role === 'lawyer') {
      localStorage.setItem('preferredMode', mode);
    }
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
    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const delta = e.clientX - dragStartXRef.current;
      const nextWidth = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, dragStartWidthRef.current + delta));
      setSidebarWidth(nextWidth);
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadChatHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const response = await api.get('/api/query/history', {
          params: { language: selectedLanguage, ...(clientId ? { clientId } : {}) },
        });

        if (!isCancelled) {
          const sessions = normalizeChatSessions(response.data.chatSessions || []);
          const visibleSessions = sessions;

          setChatSessions(visibleSessions);
          setActiveSessionId((currentActiveSessionId) => {
            const nextSession = visibleSessions.some((session) => session.id === currentActiveSessionId)
              ? visibleSessions.find((session) => session.id === currentActiveSessionId)
              : visibleSessions[visibleSessions.length - 1];

            if (nextSession) {
              setMode(nextSession.mode || 'general');
            }

            return nextSession?.id || null;
          });
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
  }, [selectedLanguage, clientId]);

  useEffect(() => {
    if (!chatViewportRef.current) return;

    chatViewportRef.current.scrollTo({
      top: chatViewportRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [activeMessages.length, isLoading, activeSessionId]);

  useEffect(() => {
    if (!showSessionGraph || !activeSessionId) return;

    let isCancelled = false;
    const fetchMessageGraph = async () => {
      const activeMessages = chatSessions.find(s => s.id === activeSessionId)?.conversations || [];
      const latestMessage = activeMessages[activeMessages.length - 1];
      
      if (!latestMessage) {
        setSessionGraphData(null);
        return;
      }

      setIsLoadingSessionGraph(true);
      try {
        const hasConflicts = latestMessage.review?.conflicts?.length > 0;
        const endpoint = hasConflicts 
          ? `/api/graph/message/${activeSessionId}/${latestMessage.id}`
          : `/api/graph/session/${activeSessionId}`;
          
        const response = await api.get(endpoint);
        if (!isCancelled) {
          setSessionGraphData(response.data.graph);
        }
      } catch (err) {
        console.error('Failed to load focused graph:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingSessionGraph(false);
        }
      }
    };

    fetchMessageGraph();
    return () => { isCancelled = true; };
  }, [activeSessionId, chatSessions, showSessionGraph]);

  const deleteChatSession = async (sessionId) => {
    if (deletingSessionId) return;
    if (!window.confirm(t.deleteChatConfirm)) return;

    try {
      setDeletingSessionId(sessionId);
      await api.delete(`/api/query/session/${sessionId}`);

      setChatSessions((current) => {
        const remaining = current.filter((s) => s.id !== sessionId);
        if (activeSessionId === sessionId) {
          const next = remaining.length > 0
            ? remaining.sort((a, b) => new Date(b.lastAskedAt || 0) - new Date(a.lastAskedAt || 0))[0]
            : null;
          setActiveSessionId(next?.id || null);
          if (next) setMode(next.mode || 'general');
        }
        return remaining;
      });
    } catch (deleteError) {
      console.error(deleteError);
      setError(t.deleteChatFailed);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const startNewChat = (nextMode = mode) => {
    setActiveSessionId(null);
    setQuery('');
    setError(null);
    setSpeechError('');
    setVoiceDraftNotice('');
    setLastSubmittedQuery('');
    const effectiveMode = nextMode;
    setLastSubmittedMode(effectiveMode);
    setMode(effectiveMode);
    setIsMobileHistoryOpen(false);
    inputRef.current?.focus();
  };

  const handleModeSwitch = (nextMode) => {
    if (mode === nextMode) return;
    startNewChat(nextMode);
  };

  const upsertChatSession = useCallback((nextSession) => {
    setChatSessions((currentSessions) => {
      const existingIndex = currentSessions.findIndex((session) => session.id === nextSession.id);

      if (existingIndex === -1) {
        return [...currentSessions, nextSession];
      }

      const updatedSessions = [...currentSessions];
      updatedSessions[existingIndex] = nextSession;
      return updatedSessions;
    });
  }, []);

  const askQuestion = useCallback(async (questionToAsk, selectedMode = mode) => {
    if (!questionToAsk.trim() || isLoading) return;

    const trimmedQuestion = questionToAsk.trim();
    const effectiveMode = selectedMode;
    const canAppendToActiveSession =
      activeSession
      && (activeSession.mode || 'general') === effectiveMode
      && (activeSession.language || DEFAULT_LANGUAGE) === selectedLanguage;
    const history = canAppendToActiveSession
      ? activeMessages.flatMap((message) => [
        { role: 'user', text: message.question },
        { role: 'model', text: message.answer },
      ])
      : [];

    setLastSubmittedQuery(trimmedQuestion);
    setLastSubmittedMode(effectiveMode);

    try {
      setIsLoading(true);
      setError(null);

      const payload = {
        mode: effectiveMode,
        query: trimmedQuestion,
        history,
        language: selectedLanguage,
        sessionId: canAppendToActiveSession ? activeSession.id : undefined,
        clientId: clientId || undefined,
      };

      const response = await api.post('/api/query', payload);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get answer');
      }

      const nextSession = normalizeChatSessions([response.data.chatSession || {}])[0];
      if (nextSession) {
        upsertChatSession(nextSession);
        setActiveSessionId(nextSession.id);
        setMode(nextSession.mode || effectiveMode);
      }

      setQuery('');
      setIsMobileHistoryOpen(false);
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.error || requestError.message || 'Something went wrong while processing your query.');
    } finally {
      setIsLoading(false);
    }
  }, [
    activeMessages,
    activeSession,
    clientId,
    isLoading,
    mode,
    selectedLanguage,
    upsertChatSession,
  ]);

  const handleSearch = async (event) => {
    event?.preventDefault();
    setVoiceDraftNotice('');
    await askQuestion(query, mode);
  };

  useEffect(() => {
    if (autoSubmit && initialQuery && !hasAutoSubmitted && !isLoadingHistory && !isLoading) {
      if (chatSessions.length === 0) {
        setHasAutoSubmitted(true);
        askQuestion(initialQuery, 'lawyer'); // Force lawyer mode for client analysis
      } else {
        setHasAutoSubmitted(true); // Don't auto-submit if they already have chats
      }
    }
  }, [askQuestion, autoSubmit, initialQuery, hasAutoSubmitted, isLoadingHistory, isLoading, chatSessions.length]);

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
    } catch {
      setSpeechError(t.microphoneBlocked);
      setIsRecording(false);
      stopMediaStream();
    }
  };

  const historyList = (
    <div className="space-y-2">
      {!isSingleRun && (
        <button
          type="button"
          onClick={() => startNewChat(mode)}
          className="premium-btn-primary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <Plus size={15} />
          {t.newChat}
        </button>
      )}

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
            <div
              key={`${session.id}-history`}
              className={`group relative rounded-lg border px-3 py-3 text-left transition ${session.id === activeSessionId
                  ? 'border-[#83b9e7] bg-[#e8f3fb] dark:border-[#4f7391] dark:bg-[#1d3344]'
                  : 'premium-card hover:border-[#b9d8f2] hover:bg-moss-50 dark:hover:border-[#3c5c75] dark:hover:bg-[#1d3344]'
                }`}
            >
              <button
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
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#1a1a1a] dark:text-[#dce8f3]">
                    {session.title || (clientName ? `${clientName} Analysis ${index + 1}` : `Chat ${index + 1}`)}
                  </p>
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-[#6b7280] dark:text-[#a9c3d8]">
                    {session.mode === 'lawyer' ? t.lawyerModeShort : t.generalModeShort}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#6b7280] dark:text-[#a9c3d8]">
                  {session.previewQuestion || t.noMessagesYet}
                </p>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChatSession(session.id);
                }}
                disabled={deletingSessionId === session.id}
                title={t.deleteChat}
                className="absolute bottom-2 right-2 hidden h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-500 opacity-0 transition-all hover:bg-rose-100 hover:text-rose-600 group-hover:flex group-hover:opacity-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 dark:hover:text-rose-300 disabled:opacity-50"
              >
                {deletingSessionId === session.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Trash2 size={13} />
                }
              </button>
            </div>
          ))
      )}
    </div>
  );

  return (
    <section className="premium-surface flex h-full min-h-0 w-full flex-1 overflow-hidden rounded-xl dark:border-[#355269] dark:bg-[#1b2c3a]">
      {/* Resizable history sidebar */}
      {!isSingleRun && (
        <aside
          style={{ width: sidebarWidth }}
          className="hidden shrink-0 border-r border-[#e6e0d6] bg-cream-100 px-4 py-4 dark:border-[#355269] dark:bg-[#1b2c3a] lg:flex lg:flex-col"
        >
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#6b7280] dark:text-[#a9c3d8]">Operator</p>
            <p className="mt-1 text-sm font-semibold text-[#1a1a1a] dark:text-[#dce8f3]">{user?.fullName}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#d7d1c5] bg-cream-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b7280] dark:border-[#355269] dark:bg-[#1d3344] dark:text-[#a9c3d8]">
                General
              </span>
            </div>
          </div>
          {historyList}
        </aside>
      )}

      {/* Resize handle */}
      {!isSingleRun && (
        <div
          onMouseDown={(e) => {
            isDraggingRef.current = true;
            dragStartXRef.current = e.clientX;
            dragStartWidthRef.current = sidebarWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          className="group hidden w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors hover:bg-moss-100 dark:hover:bg-[#26465d] lg:flex"
          title="Drag to resize"
        >
          <div className="h-8 w-0.5 rounded-full bg-[#d8d1c5] opacity-0 transition-opacity group-hover:opacity-100 dark:bg-[#355269]" />
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e6e0d6] bg-cream-50 px-4 dark:border-[#355269] dark:bg-[#1b2c3a]">
          <div className="flex items-center gap-2">
            {!isSingleRun && (
              <button
                type="button"
                onClick={() => setIsMobileHistoryOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2ddd4] text-[#6b7280] lg:hidden dark:border-[#355269] dark:text-[#a9c3d8]"
              >
                <History size={15} />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-[#1a1a1a] dark:text-[#dce8f3]">
                {activeSession?.title || (clientName ? `${clientName} Analysis` : t.newChat)}
              </h2>
              <p className="truncate text-xs text-[#6b7280] dark:text-[#a9c3d8]">
                {activeSession
                  ? (isSingleRun ? 'One-time client analysis' : `${activeSession.mode === 'lawyer' ? t.lawyerModeShort : t.generalModeShort} · ${t.conversations(activeSession.conversationCount)}`)
                  : (isSingleRun ? 'One-time client analysis' : 'General legal Q&A')}
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startNewChat('general')}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e2ddd4] px-2.5 text-sm text-[#6b7280] transition hover:bg-moss-50 dark:border-[#355269] dark:text-[#a9c3d8] dark:hover:bg-[#1d3344]"
                title={t.newButton}
              >
                <Plus size={14} />
                <span className="hidden md:inline">{t.newButton}</span>
              </button>
            </div>
            {user?.role === 'lawyer' && (
              <button
                type="button"
                onClick={() => handleModeSwitch('general')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm transition ${mode === 'general'
                    ? 'premium-btn-primary'
                    : 'premium-btn-secondary dark:text-[#a9c3d8] dark:hover:bg-[#1d3344]'
                  }`}
                title={t.generalModeShort}
              >
                <MessageSquareText size={14} />
                <span className="hidden sm:inline">{t.generalModeShort}</span>
              </button>
            )}
            {user?.role === 'lawyer' && (
              <button
                type="button"
                onClick={() => handleModeSwitch('lawyer')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm transition ${mode === 'lawyer'
                    ? 'premium-btn-primary'
                    : 'premium-btn-secondary dark:text-[#a9c3d8] dark:hover:bg-[#1d3344]'
                  }`}
                title={t.lawyerModeShort}
              >
                <Search size={14} />
                <span className="hidden sm:inline">{t.lawyerModeShort}</span>
              </button>
            )}
            {user?.role === 'lawyer' && (
              <button
                type="button"
                onClick={() => setShowSessionGraph(!showSessionGraph)}
                title="Toggle Legal Knowledge Graph"
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition ${
                  showSessionGraph
                    ? 'bg-moss-100 text-moss-700 shadow-inner dark:bg-[#26465d] dark:text-[#a9d6f7]'
                    : 'premium-btn-secondary dark:text-[#a9c3d8] dark:hover:bg-[#1d3344] shadow-sm'
                }`}
              >
                {isLoadingSessionGraph ? <Loader2 size={14} className="animate-spin" /> : <Network size={14} />}
                <span className="hidden sm:inline">{showSessionGraph ? 'Close' : 'Insights'}</span>
              </button>
            )}
          </div>
        </header>

        <div ref={chatViewportRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-cream-100 px-4 py-5 touch-pan-y dark:bg-[#0f1820] sm:px-6">
          {activeMessages.length === 0 && !isLoading && !error && (
            <div className="premium-card mx-auto mt-8 max-w-xl rounded-xl p-6 text-center">
              <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#dce8f3]">
                {activeSession
                  ? t.welcomeExisting
                  : isSingleRun
                    ? `${clientName || 'Client'} analysis`
                    : t.welcomeNew}
              </h3>
              <p className="mt-2 text-sm text-[#6b7280] dark:text-[#a9c3d8]">
                {isSingleRun
                  ? 'The saved case background will be analyzed once and kept with this client workspace.'
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

          <div className="w-full space-y-8">
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

        {!isSingleRun && (
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
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition ${isRecording
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
        )}
      </div>

      {/* Graph Sidebar (Glass Overlay) */}
      {showSessionGraph && user?.role === 'lawyer' && (
        <aside
          className="fixed inset-0 z-[100] w-full h-full bg-cream-50/95 dark:bg-[#0b1219]/90 backdrop-blur-3xl animate-in zoom-in-95 duration-300 flex flex-col"
        >
          {sessionGraphData ? (
              <div className="h-full w-full relative">
                <LegalKnowledgeGraph
                  graphData={sessionGraphData}
                  onClose={() => setShowSessionGraph(false)}
                  title={`Insights: ${activeSession?.title || 'Selected Chat'}`}
                  clientContext={activeSession?.previewQuestion || ''}
                />
              </div>
          ) : (
            <div className="flex relative h-full flex-col items-center justify-center p-6 text-center">
              <button onClick={() => setShowSessionGraph(false)} className="absolute top-4 right-4 p-2 rounded-lg bg-black/20 hover:bg-black/40 text-white/70 hover:text-white transition z-50"><X size={18}/></button>
              {isLoadingSessionGraph ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={32} className="animate-spin text-moss-600 dark:text-[#a9d6f7]" />
                  <p className="text-sm text-[#6b7280] dark:text-[#a9c3d8]">Analyzing legal connections...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 opacity-50">
                  <Network size={48} className="text-[#6b7280] dark:text-[#a9c3d8]" />
                  <p className="text-sm text-[#6b7280] dark:text-[#a9c3d8]">No relationships mapped yet. Try asking a question.</p>
                </div>
              )}
            </div>
          )}
        </aside>
      )}

      {!isSingleRun && isMobileHistoryOpen && (
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
