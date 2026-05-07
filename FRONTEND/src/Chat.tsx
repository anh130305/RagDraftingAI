import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Code2,
  Compass,
  History,
  MessageSquare,
  Palette,
  Plus,
  Settings,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Copy,
  Pencil,
  Hexagon,
  Check,
  FileText,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from './lib/api';
import type { ChatMessage } from './lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from './lib/ToastContext';
import ChatComposer from './components/ChatComposer';
import DocumentPreviewModal from './components/DocumentPreviewModal';
import {
  clearChatProcessingState,
  emitChatAssistantResponseReady,
  emitChatMessagesUpdated,
  readChatProcessingState,
  subscribeChatMessagesUpdated,
  subscribeChatProcessingState,
  writeChatProcessingState,
} from './lib/chatActivityStore';

type PreviewFileState = {
  name: string;
  url?: string;
  fileType?: string | null;
  isLoading?: boolean;
  error?: string | null;
};

export default function Chat() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isLanding = !sessionId;
  const currentSessionKey = sessionId || 'new';

  // Parse message content: separate typed text from [Nội dung tệp X]: blocks
  const parseMessageContent = (content: string): { text: string; fileNames: string[] } => {
    const fileNames: string[] = [];
    // Match [Nội dung tệp ...]: blocks
    const extractPattern = /\[Nội dung tệp (.+?)\]:[\s\S]*?(?=\[Nội dung tệp |$)/g;
    // Match [Tệp đính kèm: ...] placeholders (when no extraction happened)
    const attachPattern = /\[Tệp đính kèm: (.+?)\]/g;
    let match;
    while ((match = extractPattern.exec(content)) !== null) fileNames.push(match[1]);
    // Reset to check attach pattern only if nothing from extract
    if (fileNames.length === 0) {
      while ((match = attachPattern.exec(content)) !== null) fileNames.push(match[1]);
    }
    // Remove file blocks from visible text
    let text = content
      .replace(/\[Nội dung tệp .+?\]:[\s\S]*?(?=\[Nội dung tệp |$)/g, '')
      .replace(/\[Tệp đính kèm: .+?\]/g, '')
      .trim();
    return { text, fileNames };
  };

  // Get icon/color info for a file chip based on its extension
  const getFileChipInfo = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const baseName = fileName.includes('.') ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
    const typeMap: Record<string, { label: string; iconBg: string; iconColor: string }> = {
      pdf: { label: 'PDF', iconBg: 'bg-red-500/15', iconColor: 'text-red-400' },
      docx: { label: 'DOCX', iconBg: 'bg-blue-500/15', iconColor: 'text-blue-400' },
      doc: { label: 'DOC', iconBg: 'bg-blue-500/15', iconColor: 'text-blue-400' },
      xlsx: { label: 'XLSX', iconBg: 'bg-green-500/15', iconColor: 'text-green-400' },
      xls: { label: 'XLS', iconBg: 'bg-green-500/15', iconColor: 'text-green-400' },
      ipynb: { label: 'IPYNB', iconBg: 'bg-red-500/15', iconColor: 'text-red-400' },
      txt: { label: 'TXT', iconBg: 'bg-gray-500/15', iconColor: 'text-gray-400' },
      png: { label: 'PNG', iconBg: 'bg-purple-500/15', iconColor: 'text-purple-400' },
      jpg: { label: 'JPG', iconBg: 'bg-purple-500/15', iconColor: 'text-purple-400' },
      jpeg: { label: 'JPEG', iconBg: 'bg-purple-500/15', iconColor: 'text-purple-400' },
      md: { label: 'MD', iconBg: 'bg-sky-500/15', iconColor: 'text-sky-400' },
    };
    const info = typeMap[ext] || { label: ext.toUpperCase() || 'FILE', iconBg: 'bg-primary/15', iconColor: 'text-primary' };
    return { baseName, ext: ext.toUpperCase(), ...info };
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null);
  const [submittingSessionId, setSubmittingSessionId] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState('');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  // File preview state
  const [previewFile, setPreviewFile] = useState<PreviewFileState | null>(null);
  const [lookingUpFile, setLookingUpFile] = useState(false);
  const lookupAbortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const pollingIntervalRef = useRef<number | null>(null);
  const pollingRetryRef = useRef(0);
  const pollingInFlightRef = useRef(false);
  const pollingActiveRef = useRef(false);
  const pollingSessionIdRef = useRef<string | null>(null);
  const pollingTargetUserMessageIdRef = useRef<string | null>(null);
  const autoResumeAttemptedUserMessageIdRef = useRef<string | null>(null);
  const pollingTerminatedUserMessageIdRef = useRef<string | null>(null);
  const pendingPollingRequestRef = useRef<{ sid: string; targetUserMessageId: string | null } | null>(null);
  const hydratedBusySessionIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const activeSessionIdRef = useRef<string | null>(sessionId || null);
  const activeBusySessionIdRef = useRef<string | null>(null);
  const processingTargetUserMessageIdRef = useRef<string | null>(null);

  // Local submit state must take precedence so the status appears instantly on send,
  // even if a stale restored busy session exists in storage.
  const activeBusySessionId = submittingSessionId || sendingSessionId;
  const isBusyCurrentSession = activeBusySessionId === currentSessionKey;
  const isBusyAnotherSession = !!activeBusySessionId && activeBusySessionId !== currentSessionKey;
  const composerStatus = isBusyAnotherSession
    ? 'AI đang bận xử lý ở một đoạn chat khác...'
    : undefined;

  // Auto-scroll to bottom when messages or status changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusText]);

  useEffect(() => {
    activeSessionIdRef.current = sessionId || null;
  }, [sessionId]);

  useEffect(() => {
    const persisted = readChatProcessingState();
    hydratedBusySessionIdRef.current = persisted.busySessionId;
    activeBusySessionIdRef.current = persisted.busySessionId;
    setSendingSessionId(persisted.busySessionId);
    setStatusText(persisted.busySessionId ? (persisted.statusText || 'AI đang suy nghĩ...') : '');

    const unsubscribe = subscribeChatProcessingState((state) => {
      hydratedBusySessionIdRef.current = state.busySessionId;
      activeBusySessionIdRef.current = state.busySessionId;
      setSendingSessionId(state.busySessionId);
      setStatusText(state.busySessionId ? (state.statusText || 'AI đang suy nghĩ...') : '');
    });

    return unsubscribe;
  }, []);

  const isViewingSession = (sid: string) => (
    isMountedRef.current && activeSessionIdRef.current === sid
  );

  const normalizeStatusPreview = (value: string) => {
    const previewText = value || 'AI đang suy nghĩ...';
    return previewText.length > 240 ? previewText.slice(-240) : previewText;
  };

  const updateProcessingState = (
    busySessionId: string,
    status: string,
    targetUserMessageId: string | null = processingTargetUserMessageIdRef.current,
  ) => {
    const statusPreview = normalizeStatusPreview(status);
    activeBusySessionIdRef.current = busySessionId;
    processingTargetUserMessageIdRef.current = targetUserMessageId;
    hydratedBusySessionIdRef.current = busySessionId;

    writeChatProcessingState({
      busySessionId,
      targetUserMessageId,
      statusText: statusPreview,
    });

    if (!isMountedRef.current) return;
    setSendingSessionId(busySessionId);
    setStatusText(statusPreview);
  };

  const clearProcessingStateForSession = (sid?: string) => {
    const current = readChatProcessingState();
    const shouldClear = !sid || current.busySessionId === sid;
    if (!shouldClear) return;

    clearChatProcessingState();
    activeBusySessionIdRef.current = null;
    processingTargetUserMessageIdRef.current = null;
    hydratedBusySessionIdRef.current = null;

    if (!isMountedRef.current) return;
    setSendingSessionId(null);
    setSubmittingSessionId(null);
    setStatusText('');
  };

  const removeOptimisticMessage = (optimisticMessageId: string | null) => {
    if (!optimisticMessageId) return;
    if (!isMountedRef.current) return;
    setMessages((prev) => prev.filter((message) => message.id !== optimisticMessageId));
  };

  const replaceOptimisticMessage = (optimisticMessageId: string | null, nextMessage: ChatMessage) => {
    if (!optimisticMessageId) return;
    if (!isMountedRef.current) return;
    setMessages((prev) => {
      const withoutOptimistic = prev.filter((message) => message.id !== optimisticMessageId);
      if (withoutOptimistic.some((message) => message.id === nextMessage.id)) {
        return withoutOptimistic;
      }
      return [...withoutOptimistic, nextMessage];
    });
  };

  const clearSendRuntimeState = () => {
    stopPolling();
    clearProcessingStateForSession();
  };

  // Look up file URL from DB and open preview
  const handleFileChipClick = async (fileName: string) => {
    if (!sessionId) {
      showToast('Không xác định được phiên chat hiện tại để tìm tệp.', 'warning');
      return;
    }

    // Cancel any previous in-flight lookup before starting a new one
    lookupAbortRef.current.aborted = true;
    const abortToken = { aborted: false };
    lookupAbortRef.current = abortToken;

    setPreviewFile({ name: fileName, isLoading: true, error: null });
    setLookingUpFile(true);
    try {
      const normalize = (value: string) => value.trim().toLowerCase();
      const stripExt = (value: string) => value.replace(/\.[^/.]+$/, '');
      const safeDecode = (value: string) => {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      };

      const target = normalize(fileName);
      const targetWithoutExt = stripExt(target);

      // Retry up to 10 times with 2s delay between attempts = ~20s total window.
      // Covers the Cloudinary upload + DB write time in parallel send flow.
      const MAX_RETRIES = 10;
      const RETRY_DELAY_MS = 2000;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        // Modal was closed — stop silently, do NOT update any state
        if (abortToken.aborted) return;

        // Search only documents attached to this chat session.
        const docs = await api.listDocuments(0, 100, sessionId);

        // Re-check after the await: user may have closed the modal while fetching
        if (abortToken.aborted) return;

        // Find the document whose title or file_path matches the filename
        const match = docs.items.find((d) => {
          const title = normalize(d.title);
          const titleWithoutExt = stripExt(title);

          const filePathName = d.file_path.split('/').pop() || d.file_path;
          const decodedPathName = normalize(safeDecode(filePathName));
          const pathWithoutExt = stripExt(decodedPathName);

          const filePathRaw = normalize(d.file_path);

          return (
            title === target ||
            titleWithoutExt === targetWithoutExt ||
            decodedPathName === target ||
            pathWithoutExt === targetWithoutExt ||
            filePathRaw.includes(target)
          );
        });

        if (match) {
          const url = api.resolveDocumentFileUrl(match.file_path);
          if (!abortToken.aborted) {
            setPreviewFile({ name: match.title, url, fileType: match.file_type, isLoading: false, error: null });
          }
          return;
        }

        // Don't delay after the last attempt
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
        }
      }

      // Lookup exhausted — only show error if modal is still open
      if (!abortToken.aborted) {
        setPreviewFile({
          name: fileName,
          isLoading: false,
          error: 'Chưa tìm thấy tệp để xem trước. Vui lòng thử lại sau vài giây.',
        });
      }
    } catch (err) {
      if (!abortToken.aborted) {
        setPreviewFile({ name: fileName, isLoading: false, error: 'Không thể tải liên kết xem trước tệp.' });
        showToast('Không thể tải liên kết xem trước tệp.', 'error');
      }
      console.error('Failed to look up file:', err);
    } finally {
      if (!abortToken.aborted) {
        setLookingUpFile(false);
      }
    }
  };

  // Find the index of the latest user message
  const latestUserMsgIndex = [...messages].reverse().findIndex(m => m.role === 'user');
  const latestUserMsgId = latestUserMsgIndex !== -1 ? messages[messages.length - 1 - latestUserMsgIndex].id : null;

  // ── Load messages when sessionId changes ───────────────────
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadMessages = async (showOverlay = true) => {
      if (showOverlay) setIsLoading(true);
      try {
        const data = await api.getMessages(sessionId);
        if (!isCancelled) setMessages(data);
      } catch (err) {
        if (!isCancelled) console.error('Failed to load messages:', err);
      } finally {
        if (!isCancelled && showOverlay) setIsLoading(false);
      }
    };

    void loadMessages();

    const unsubscribeMessagesUpdated = subscribeChatMessagesUpdated((detail) => {
      if (detail.sessionId === sessionId) {
        void loadMessages(false);
      }
    });

    return () => {
      isCancelled = true;
      unsubscribeMessagesUpdated();
    };
  }, [sessionId]);

  const stopPolling = (options: { drainPending?: boolean } = {}) => {
    if (pollingIntervalRef.current !== null) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    const pending = options.drainPending ? pendingPollingRequestRef.current : null;
    pendingPollingRequestRef.current = null;
    pollingRetryRef.current = 0;
    pollingInFlightRef.current = false;
    pollingActiveRef.current = false;
    pollingSessionIdRef.current = null;
    pollingTargetUserMessageIdRef.current = null;

    if (pending) {
      window.setTimeout(() => {
        startPolling(pending.sid, pending.targetUserMessageId || undefined);
      }, 0);
    }
  };

  const clearPollingUiState = (options: { drainPending?: boolean } = {}, sid?: string) => {
    stopPolling(options);
    clearProcessingStateForSession(sid);
  };

  useEffect(() => {
    autoResumeAttemptedUserMessageIdRef.current = null;
  }, [sessionId]);

  const startPolling = (sid: string, targetUserMessageId?: string) => {
    if (!sid) return;
    if (pollingActiveRef.current) {
      if (pollingSessionIdRef.current === sid) return;

      pendingPollingRequestRef.current = {
        sid,
        targetUserMessageId: targetUserMessageId || null,
      };
      return;
    }

    pendingPollingRequestRef.current = null;

    stopPolling();
    pollingActiveRef.current = true;
    pollingSessionIdRef.current = sid;
    pollingRetryRef.current = 0;
    pollingTargetUserMessageIdRef.current = targetUserMessageId || null;
    processingTargetUserMessageIdRef.current = targetUserMessageId || null;

    const maxRetries = 150; // 150 retries * 2s = 300s max wait
    const statuses = [
      'AI đang suy nghĩ...',
      'Đang phân tích yêu cầu...',
      'Đang trích xuất dữ liệu...',
      'Đang chuẩn bị phản hồi...',
    ];

    const tick = async () => {
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      updateProcessingState(
        sid,
        statuses[pollingRetryRef.current % statuses.length],
        pollingTargetUserMessageIdRef.current,
      );

      try {
        const updatedMessages = await api.getMessages(sid);
        if (isViewingSession(sid)) {
          setMessages(updatedMessages);
        }

        const latestUserMessageId = [...updatedMessages]
          .reverse()
          .find((m) => m.role === 'user')?.id || null;

        const targetId = pollingTargetUserMessageIdRef.current;
        const assistantMessageAfterTarget = (() => {
          if (!targetId) {
            const lastMsg = updatedMessages[updatedMessages.length - 1];
            return lastMsg?.role === 'assistant' ? lastMsg : null;
          }

          const targetIndex = updatedMessages.findIndex((m) => m.id === targetId);
          if (targetIndex === -1) return null;

          return updatedMessages
            .slice(targetIndex + 1)
            .find((m) => m.role === 'assistant') || null;
        })();

        if (assistantMessageAfterTarget) {
          pollingTerminatedUserMessageIdRef.current = null;
          clearPollingUiState({ drainPending: true }, sid);
          emitChatMessagesUpdated(sid);
          emitChatAssistantResponseReady(sid, assistantMessageAfterTarget.id);
          return;
        }

        pollingRetryRef.current += 1;
        if (pollingRetryRef.current >= maxRetries) {
          pollingTerminatedUserMessageIdRef.current = targetId || latestUserMessageId;
          clearPollingUiState({ drainPending: true }, sid);
          showToast('Quá thời gian phản hồi. Vui lòng thử lại.', 'warning');
        }
      } catch (err) {
        console.error('Polling error:', err);
        pollingRetryRef.current += 1;
        if (pollingRetryRef.current >= maxRetries) {
          pollingTerminatedUserMessageIdRef.current = pollingTargetUserMessageIdRef.current;
          clearPollingUiState({ drainPending: true }, sid);
          showToast('Không thể đồng bộ phản hồi từ máy chủ. Vui lòng thử lại.', 'error');
        }
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    void tick();
    pollingIntervalRef.current = window.setInterval(() => {
      void tick();
    }, 2000);
  };

  // ── Handle sending message ──────────────────────────────────
  const handleSend = async (content: string, mode: 'qa' | 'generate' = 'qa', extras?: string): Promise<string | undefined> => {
    if (activeBusySessionIdRef.current) return;

    let currentId = sessionId;
    let optimisticMessageId: string | null = null;

    // Clear thanh nhập Input ngay sau khi sendMessage
    activeBusySessionIdRef.current = currentSessionKey;
    setComposerValue('');
    setSubmittingSessionId(currentSessionKey);
    setStatusText('Đang gửi tin nhắn...');

    const formattedExtras = extras ? extras.replace(/\n/g, '  \n') : '';
    const combinedContent = mode === 'generate' && extras
      ? `${content}\n\n---\n**Thông tin bổ sung:**\n\n${formattedExtras}`
      : content;

    try {
      // Nếu chưa có session, tạo session mới trước
      if (!currentId) {
        const title = content.length > 30 ? `${content.slice(0, 30)}...` : content;
        const newSession = await api.createSession(title);
        currentId = newSession.id;
        if (isMountedRef.current) setSubmittingSessionId(currentId);
        activeBusySessionIdRef.current = currentId;
        activeSessionIdRef.current = currentId;
        if (isMountedRef.current) navigate(`/chat/${currentId}`, { replace: true });
        emitChatMessagesUpdated(currentId);
      }

      if (!currentId) {
        throw new Error('Không thể xác định session hiện tại');
      }

      const resolvedSessionId = currentId;
      activeSessionIdRef.current = resolvedSessionId;

      // Render ngay lập tức để UI phản hồi tức thì, không phụ thuộc độ trễ API
      optimisticMessageId = `temp-${Date.now()}`;
      const optimisticMessage: ChatMessage = {
        id: optimisticMessageId,
        session_id: resolvedSessionId,
        role: 'user',
        content: combinedContent,
        mode,
        feedback: null,
        token_count: null,
        created_at: new Date().toISOString(),
      };
      if (isViewingSession(resolvedSessionId)) {
        setMessages((prev) => [...prev, optimisticMessage]);
      }
      emitChatMessagesUpdated(resolvedSessionId);

      // Gửi tin nhắn thực tế để backend lưu và xử lý AI trong nền
      if (mode === 'qa') {
        updateProcessingState(resolvedSessionId, 'Đang gửi tin nhắn...', optimisticMessageId);
        pollingTerminatedUserMessageIdRef.current = null;
        autoResumeAttemptedUserMessageIdRef.current = null;

        const userMessage = await api.sendMessage(resolvedSessionId, combinedContent, mode, extras);
        processingTargetUserMessageIdRef.current = userMessage.id;
        if (isViewingSession(resolvedSessionId)) {
          replaceOptimisticMessage(optimisticMessageId, userMessage);
        }
        emitChatMessagesUpdated(resolvedSessionId);
        updateProcessingState(resolvedSessionId, 'AI đang suy nghĩ...', userMessage.id);
        startPolling(resolvedSessionId, userMessage.id);
        return resolvedSessionId;
      } else {
        // Send combinedContent (includes file blocks & Thông tin bổ sung heading) so the DB
        // stores the full display content — file chips will appear correctly in history on reload.
        const userMessage = await api.sendMessage(resolvedSessionId, combinedContent, mode, extras);
        if (isViewingSession(resolvedSessionId)) {
          replaceOptimisticMessage(optimisticMessageId, userMessage);
        }
        emitChatMessagesUpdated(resolvedSessionId);
        updateProcessingState(resolvedSessionId, 'Đang thực hiện soạn thảo văn bản...', userMessage.id);

        void (async () => {
          try {
            const draftRes = await api.generateDraftDocx({
              query: content,
              extras: extras,
              session_id: resolvedSessionId,
            });

            if (draftRes.status === 'ok') {
              const assistantMsg: ChatMessage = {
                id: `draft-${Date.now()}`,
                session_id: resolvedSessionId,
                role: 'assistant',
                content: `Tôi đã soạn thảo xong bản thảo "${draftRes.meta.form_type}" dựa trên yêu cầu của bạn.`,
                feedback: null,
                token_count: null,
                created_at: new Date().toISOString(),
              };

              if (draftRes.document) {
                assistantMsg.content += `\n\n[Tệp đính kèm: ${draftRes.document.title}]`;
              }

              if (isViewingSession(resolvedSessionId)) {
                setMessages((prev) => [...prev, assistantMsg]);
              }
              emitChatMessagesUpdated(resolvedSessionId);
              emitChatAssistantResponseReady(resolvedSessionId, assistantMsg.id);
            }
          } catch (err: any) {
            showToast(`Lỗi khi soạn thảo: ${err.message}`, 'error');
          } finally {
            clearSendRuntimeState();
          }
        })();

        return resolvedSessionId;
      }
    } catch (err: any) {
      removeOptimisticMessage(optimisticMessageId);
      clearSendRuntimeState();
      if (err?.name !== 'AbortError') {
        console.error('Failed to send message:', err);
        showToast('Có lỗi xảy ra khi gửi tin nhắn.', 'system-error');
      }
    }
  };

  // Handle reloads / page revisits: if last message is from user, resume polling automatically
  useEffect(() => {
    if (!sessionId || isLoading || activeBusySessionId) return;
    if (pollingActiveRef.current) return;
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    // Only auto-resume polling for 'qa' mode messages. 
    // 'generate' mode is typically synchronous or handled in one go.
    if (lastMsg.role !== 'user' || lastMsg.mode !== 'qa') return;

    // After timeout/error, do not auto-restart polling for the same user message.
    if (pollingTerminatedUserMessageIdRef.current === lastMsg.id) return;

    // Only auto-resume once per unresolved user message to avoid infinite loop restarts.
    if (autoResumeAttemptedUserMessageIdRef.current === lastMsg.id) return;

    autoResumeAttemptedUserMessageIdRef.current = lastMsg.id;
    startPolling(sessionId, lastMsg.id);
  }, [messages, isLoading, activeBusySessionId, sessionId]);

  useEffect(() => {
    if (!sessionId || isLoading) return;
    if (submittingSessionId || pollingActiveRef.current) return;
    if (hydratedBusySessionIdRef.current !== sessionId) return;
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    if (lastMsg.role === 'assistant') {
      clearProcessingStateForSession(sessionId);
      return;
    }

    if (lastMsg.role === 'user' && lastMsg.mode === 'qa') {
      hydratedBusySessionIdRef.current = null;
      startPolling(sessionId, lastMsg.id);
    }
  }, [messages, isLoading, sessionId, submittingSessionId]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleEdit = (content: string) => {
    setComposerValue(content);
  };

  const handleReload = () => {
    if (activeBusySessionId) return; // Prevent spam clicks
    if (messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        const reloadMode = lastUserMsg.mode === 'generate' ? 'generate' : 'qa';
        void handleSend(lastUserMsg.content, reloadMode);
      }
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'like' | 'dislike') => {
    // Optimistic UI update
    const currentMsg = messages.find(m => m.id === messageId);
    if (!currentMsg) return;
    const newFeedback = currentMsg.feedback === feedback ? null : feedback;

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, feedback: newFeedback } : m
    ));

    try {
      await api.submitMessageFeedback(messageId, newFeedback);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      // Revert on error
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, feedback: currentMsg.feedback } : m
      ));
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      lookupAbortRef.current.aborted = true;
      pendingPollingRequestRef.current = null;
      if (!readChatProcessingState().busySessionId) {
        stopPolling();
      }
    };
  }, []);

  return (
    <>
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* Inline loading overlay when switching sessions */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-on-surface-variant font-medium">Đang tải đoạn chat...</span>
            </div>
          </div>
        )}
        {/* Chat Area */}
        <section className="flex-1 flex flex-col items-center px-2 md:px-12 pb-4 overflow-y-auto w-full relative no-scrollbar">
          <AnimatePresence mode="wait">
            {isLanding ? (
              <motion.div
                key="landing-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
                className="w-full flex-1 flex flex-col items-center justify-center min-h-[60vh] py-12"
              >
                <div className="w-full max-w-4xl text-center mb-12">
                  <h1 className="text-5xl md:text-6xl font-extrabold font-headline mb-4 bg-gradient-to-r from-on-surface via-on-surface to-primary bg-clip-text text-transparent">
                    Tôi có thể giúp gì cho bạn hôm nay?
                  </h1>
                  <p className="text-on-surface-variant text-lg max-w-2xl mx-auto font-body">
                    Khai phá sức mạnh của RAG AI để xây dựng, sáng tạo và giải quyết vấn đề. Bạn đang nghĩ gì?
                  </p>
                </div>
                {/* Suggestion Bento Grid */}
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
                  <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                      <Palette className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-sm mb-1">Tạo hình ảnh</p>
                    <p className="text-on-surface-variant text-xs leading-relaxed">Trực quan hoá ý tưởng</p>
                  </div>
                  <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center mb-4 text-secondary group-hover:scale-110 transition-transform">
                      <Code2 className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-sm mb-1">Trợ lý lập trình</p>
                    <p className="text-on-surface-variant text-xs leading-relaxed">Tìm kiếm lỗi và tối ưu kiến trúc</p>
                  </div>
                  <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
                    <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center mb-4 text-tertiary group-hover:scale-110 transition-transform">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-sm mb-1">Viết nội dung</p>
                    <p className="text-on-surface-variant text-xs leading-relaxed">Lên bản nháp chuyên nghiệp</p>
                  </div>
                  <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
                    <div className="w-10 h-10 rounded-full bg-primary-fixed-dim/10 flex items-center justify-center mb-4 text-primary-fixed-dim group-hover:scale-110 transition-transform">
                      <Compass className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-sm mb-1">Lên kế hoạch</p>
                    <p className="text-on-surface-variant text-xs leading-relaxed">Sắp xếp các lịch trình chi tiết</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="session-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full flex-1 flex flex-col space-y-6 pt-6"
              >
                <div className="flex flex-col gap-8 w-full">
                  {messages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    const isLatestUser = msg.id === latestUserMsgId;

                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex w-full group animate-in fade-in slide-in-from-bottom-2 duration-300 ${isUser ? 'justify-end' : 'justify-start gap-4'}`}
                      >
                        {!isUser && (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shrink-0 mt-1 shadow-sm border border-primary/20">
                            <Hexagon className="w-4 h-4 text-on-primary-fixed" />
                          </div>
                        )}

                        <div className={`flex flex-col gap-2 max-w-[85%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                          {(() => {
                            const { text, fileNames } = parseMessageContent(msg.content);
                            return (
                              <>
                                {/* File attachment bubbles - each as its own card */}
                                {fileNames.map((name, i) => {
                                  const chipInfo = getFileChipInfo(name);
                                  return (
                                    <div
                                      key={i}
                                      onClick={() => handleFileChipClick(name)}
                                      className={`flex items-center gap-3 px-4 py-3 bg-surface-container-high border border-outline-variant/20 rounded-2xl shadow-sm min-w-[180px] max-w-[260px] cursor-pointer hover:border-primary/40 hover:bg-surface-highest transition-colors ${isUser ? 'rounded-br-none self-end' : 'rounded-bl-none self-start'}`}
                                    >
                                      <div className={`w-9 h-9 rounded-xl ${chipInfo.iconBg} flex items-center justify-center shrink-0`}>
                                        {lookingUpFile
                                          ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
                                          : <FileText className={`w-4.5 h-4.5 ${chipInfo.iconColor}`} />}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-on-surface truncate" title={name}>{chipInfo.baseName}</p>
                                        <p className={`text-xs font-bold mt-0.5 ${chipInfo.iconColor}`}>{chipInfo.label}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* Text bubble */}
                                {text && (
                                  <div className={`px-5 py-3 rounded-2xl shadow-sm ${isUser
                                    ? 'bg-[#0084FF] text-white rounded-tr-none'
                                    : 'bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/10'
                                    }`}>
                                    {isUser ? (
                                      <div className="chat-markdown user-markdown text-sm md:text-[15px] leading-relaxed font-body">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                          {text}
                                        </ReactMarkdown>
                                      </div>
                                    ) : (
                                      <div className="chat-markdown text-sm md:text-[15px] leading-relaxed font-body">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                          {text}
                                        </ReactMarkdown>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Fallback if only files with no typed text and no extract */}
                                {!text && fileNames.length === 0 && (
                                  <div className="px-5 py-3 rounded-2xl shadow-sm bg-[#0084FF] text-white rounded-tr-none">
                                    <div className="chat-markdown user-markdown text-sm md:text-[15px] leading-relaxed font-body">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {msg.content}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {/* Toolbar */}
                          <div className={`flex items-center gap-1 mt-2 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
                            {/* Mode Indicator Badge */}
                            {(msg.mode === 'generate' || msg.mode === 'qa') && (
                              <div className={`mr-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${msg.mode === 'generate'
                                ? 'bg-secondary/10 text-secondary border border-secondary/20'
                                : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                {msg.mode === 'generate' ? (
                                  <>
                                    <Sparkles className="w-2.5 h-2.5" />
                                    Soạn thảo
                                  </>
                                ) : (
                                  <>
                                    <Compass className="w-2.5 h-2.5" />
                                    Hỏi đáp
                                  </>
                                )}
                              </div>
                            )}

                            {isUser ? (
                              <>
                                <button
                                  onClick={() => handleCopy(msg.content, msg.id)}
                                  className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-md transition-all group/btn relative"
                                  title="Sao chép"
                                >
                                  {copyStatus === msg.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                {isLatestUser && (
                                  <button
                                    onClick={() => handleEdit(msg.content)}
                                    className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-md transition-all"
                                    title="Chỉnh sửa"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'like')}
                                  className={`p-1.5 rounded-md transition-all ${msg.feedback === 'like' ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-primary hover:bg-primary/5'}`}
                                  title="Câu trả lời tốt"
                                >
                                  <ThumbsUp className={`w-3.5 h-3.5 ${msg.feedback === 'like' ? 'fill-primary' : ''}`} />
                                </button>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'dislike')}
                                  className={`p-1.5 rounded-md transition-all ${msg.feedback === 'dislike' ? 'text-error bg-error/10' : 'text-on-surface-variant hover:text-error hover:bg-error/5'}`}
                                  title="Câu trả lời tệ"
                                >
                                  <ThumbsDown className={`w-3.5 h-3.5 ${msg.feedback === 'dislike' ? 'fill-error' : ''}`} />
                                </button>
                                <button
                                  onClick={handleReload}
                                  className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-md transition-all"
                                  title="Tạo lại"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleCopy(msg.content, msg.id)}
                                  className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-md transition-all"
                                  title="Sao chép"
                                >
                                  {copyStatus === msg.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isBusyCurrentSession && (
                    <div className="flex justify-start mb-4 animate-in fade-in duration-300 gap-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shrink-0 mt-1 shadow-sm border border-primary/20">
                        <Hexagon className="w-4 h-4 text-on-primary-fixed" />
                      </div>
                      <div className="bg-surface-container-high text-on-surface px-6 py-4 rounded-3xl rounded-tl-none border border-outline-variant/10 shadow-sm flex items-center gap-3">
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={statusText}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{
                              opacity: [0, 1, 0.8, 1],
                              scale: [0.98, 1, 0.99, 1],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              repeatType: "reverse",
                              ease: "easeInOut"
                            }}
                            className="text-sm font-bold text-primary bg-gradient-to-r from-primary via-primary/70 to-primary bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent min-w-[180px]"
                          >
                            {statusText || 'Đang chuẩn bị...'}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} className="h-10 shrink-0" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Fixed Composer Area */}
        <div className="w-full shrink-0 flex justify-center px-2 md:px-12 pb-1">
          <ChatComposer
            onSend={handleSend}
            disabled={!!activeBusySessionId}
            value={composerValue}
            onValueChange={setComposerValue}
            statusMessage={composerStatus}
          />
        </div>
        {/* Subtle Ambient Background Decorations */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-tertiary/5 rounded-full blur-[120px] -z-10"></div>
      </div>

      <DocumentPreviewModal
        file={previewFile}
        onClose={() => {
          // Cancel any in-flight lookup — prevents the ghost modal re-open after retry exhaustion
          lookupAbortRef.current.aborted = true;
          setLookingUpFile(false);
          setPreviewFile(null);
        }}
      />
      {/* Mobile BottomNavBar (Visible only on mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full glass-morphism border-t border-outline-variant/10 flex justify-around items-center h-20 px-4 z-50">
        <a className="flex flex-col items-center gap-1 text-primary" href="#">
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-bold">Trò chuyện</span>
        </a>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <History className="w-5 h-5" />
          <span className="text-[10px] font-bold">Lịch sử</span>
        </a>
        <div className="relative -top-6">
          <button className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-container shadow-xl shadow-primary/20 flex items-center justify-center text-on-primary-fixed">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] font-bold">Khám phá</span>
        </a>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-bold">Danh mục</span>
        </a>
      </nav>
    </>
  );
}
