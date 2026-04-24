import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  FileSpreadsheet,
  FileText,
  FileUp,
  Image,
  LoaderCircle,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  PlusCircle,
  Sparkles,
  Star,
  X,
  FileQuestion,
  FileEdit,
} from 'lucide-react';
import { useToast } from '../lib/ToastContext';
import * as api from '../lib/api';
import type { PromptTemplateResponse } from '../lib/api';
import { AnimatePresence, motion } from 'motion/react';

interface ChatComposerProps {
  placeholder?: string;
  note?: string;
  statusMessage?: string;
  onSend?: (content: string, mode: 'qa' | 'generate', extras?: string) => string | undefined | void | Promise<string | undefined | void>;
  disabled?: boolean;
  value?: string;
  onValueChange?: (val: string) => void;
  onUploadFile?: (file: File) => void | Promise<void>;
  onUploadImage?: (file: File) => void | Promise<void>;
  chatSessionId?: string;
}

type AttachmentKind = 'image' | 'document';

type AttachmentTypeLabel = 'Word' | 'PDF' | 'Excel' | 'Tệp';
type AttachmentUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

interface PendingAttachment {
  id: string;
  file: File;
  kind: AttachmentKind;
  typeLabel: AttachmentTypeLabel;
  previewUrl?: string;
  uploadStatus: AttachmentUploadStatus;
  extractedText?: string;
  errorMessage?: string;
}

interface UploadProgress {
  current: number;
  total: number;
  fileName: string;
}

export default function ChatComposer({
  placeholder = 'Nhắn với RAG AI...',
  note = 'RAG AI có thể mắc lỗi. Vui lòng kiểm tra lại thông tin quan trọng.',
  statusMessage,
  onSend,
  disabled = false,
  value = '',
  onValueChange,
  onUploadFile,
  onUploadImage,
  chatSessionId,
}: ChatComposerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const extrasRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const valueRef = useRef(value);
  const attachmentsRef = useRef<PendingAttachment[]>([]);
  const dragCounterRef = useRef(0);
  const { showToast } = useToast();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [isWaitingForAttachments, setIsWaitingForAttachments] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [retryingAttachmentId, setRetryingAttachmentId] = useState<string | null>(null);

  // Prompt template states
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplateResponse[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const promptPickerRef = useRef<HTMLDivElement | null>(null);

  // Mode and Extras state
  const [mode, setMode] = useState<'qa' | 'generate'>('qa');
  const [extras, setExtras] = useState('');
  const [showExtras, setShowExtras] = useState(false);

  useEffect(() => {
    valueRef.current = value;

    // Auto-adjust height for textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 72; // ~3 lines (24px line-height)
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [value]);

  useEffect(() => {
    // Auto-adjust height for extras textarea
    if (extrasRef.current) {
      extrasRef.current.style.height = 'auto';
      const scrollHeight = extrasRef.current.scrollHeight;
      const maxHeight = 72; // ~3 lines (24px line-height)
      extrasRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [extras]);

  useEffect(() => {
    if (attachments.length === 0) {
      setIsWaitingForAttachments(false);
      return;
    }

    if (!attachments.some((attachment) => attachment.uploadStatus === 'uploading')) {
      setIsWaitingForAttachments(false);
    }
  }, [attachments]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, []);

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Vietnamese text averages ~3 chars/token (denser than English's ~4).
  // Using ÷3.0 gives a conservative (slightly high) estimate — safer than underestimating
  // and hitting Groq's 12,000-token per-request limit.
  const estimateTokens = (text: string) => {
    if (!text) return 0;
    return Math.ceil(text.length / 3.0);
  };

  // Safe user-input budget (tokens):
  //   Groq limit: 12,000 total
  //   RAG overhead (5 legal chunks + system prompt): ~4,000
  //   Response allocation (max_tokens):              ~4,096
  //   ─────────────────────────────────────────────  ──────
  //   Available for user input (query + extras + files): 3,500  (leaves ~400 buffer)
  const USER_TOKEN_LIMIT = 3500;

  const buildFinalExtras = (
    selectedMode: 'qa' | 'generate',
    manualExtras: string,
    extractedContent: string,
  ) => {
    const normalizedManualExtras = selectedMode === 'generate' ? manualExtras.trim() : '';
    const normalizedExtracted = extractedContent.trim();

    if (normalizedManualExtras && normalizedExtracted) {
      return `${normalizedManualExtras}\n\n${normalizedExtracted}`;
    }

    return normalizedManualExtras || normalizedExtracted;
  };

  const getAttachmentInfo = (file: File): { kind: AttachmentKind; typeLabel: AttachmentTypeLabel } => {
    const lowerName = file.name.toLowerCase();
    const lowerType = file.type.toLowerCase();

    if (lowerType.startsWith('image/')) {
      return { kind: 'image', typeLabel: 'Tệp' };
    }

    if (lowerName.endsWith('.pdf') || lowerType.includes('pdf')) {
      return { kind: 'document', typeLabel: 'PDF' };
    }

    if (
      lowerName.endsWith('.doc') ||
      lowerName.endsWith('.docx') ||
      lowerType.includes('word') ||
      lowerType.includes('document')
    ) {
      return { kind: 'document', typeLabel: 'Word' };
    }

    if (
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.xlsx') ||
      lowerType.includes('sheet') ||
      lowerType.includes('excel')
    ) {
      return { kind: 'document', typeLabel: 'Excel' };
    }

    return { kind: 'document', typeLabel: 'Tệp' };
  };

  const addAttachments = async (files: FileList | File[]) => {
    const incomingFiles = Array.from(files);
    if (incomingFiles.length === 0) return;

    const nextAttachments = incomingFiles.map((file) => {
      const info = getAttachmentInfo(file);
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        kind: info.kind,
        typeLabel: info.typeLabel,
        previewUrl: info.kind === 'image' ? URL.createObjectURL(file) : undefined,
        uploadStatus: 'uploading' as AttachmentUploadStatus, // set uploading immediately
      } satisfies PendingAttachment;
    });

    const currentAttachments = attachmentsRef.current;
    const existing = new Set(currentAttachments.map((item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`));

    const uniqueNext: PendingAttachment[] = [];
    for (const item of nextAttachments) {
      const key = `${item.file.name}-${item.file.size}-${item.file.lastModified}`;
      if (existing.has(key)) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        continue;
      }
      existing.add(key);
      uniqueNext.push(item);
    }

    const availableSlots = Math.max(0, 5 - currentAttachments.length);
    const acceptedAttachments = uniqueNext.slice(0, availableSlots);
    const droppedAttachments = uniqueNext.slice(availableSlots);

    if (droppedAttachments.length > 0) {
      showToast('Chỉ cho phép tải lên tối đa 5 tệp tin cùng một lúc.', 'warning');
      for (const item of droppedAttachments) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    }

    if (acceptedAttachments.length === 0) {
      setIsMenuOpen(false);
      return;
    }

    setAttachments((current) => [...current, ...acceptedAttachments]);

    setIsMenuOpen(false);

    const manualExtrasTokenBase = estimateTokens((valueRef.current || '') + (mode === 'generate' ? (extras || '') : ''));
    const existingExtractedTokens = attachmentsRef.current
      .filter((item) => item.extractedText)
      .reduce((sum, item) => sum + estimateTokens(item.extractedText || ''), 0);
    let acceptedIncomingExtractedTokens = 0;

    // ONLY extract text for in-context RAG usage.
    for (const attachment of acceptedAttachments) {
      try {
        const res = await api.extractTextFromImage(attachment.file);
        const normalizedText = (res.text || '').trim();

        if (!normalizedText) {
          setAttachments(current => current.map(item =>
            item.id === attachment.id
              ? { ...item, uploadStatus: 'failed', extractedText: undefined, errorMessage: 'Không có nội dung' }
              : item
          ));
          continue;
        }

        const fileTokens = estimateTokens(normalizedText);
        const totalEstimatedTokens = manualExtrasTokenBase + existingExtractedTokens + acceptedIncomingExtractedTokens + fileTokens;

        if (totalEstimatedTokens > USER_TOKEN_LIMIT) {
          setAttachments(current => current.map(item =>
            item.id === attachment.id
              ? {
                ...item,
                uploadStatus: 'failed',
                extractedText: undefined,
                errorMessage: `Quá token (~${totalEstimatedTokens}/${USER_TOKEN_LIMIT})`,
              }
              : item
          ));
          continue;
        }

        acceptedIncomingExtractedTokens += fileTokens;

        setAttachments(current => current.map(item =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'uploaded', extractedText: normalizedText, errorMessage: undefined }
            : item
        ));
      } catch (err) {
        setAttachments(current => current.map(item =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'failed', extractedText: undefined, errorMessage: 'Lỗi OCR' }
            : item
        ));
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const next = current.filter((attachment) => attachment.id !== id);
      const removed = current.find((attachment) => attachment.id === id);

      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return next;
    });
  };

  const clearAttachments = () => {
    setAttachments((current) => {
      current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });

      return [];
    });
  };

  const attachmentSummary = useMemo(() => {
    if (attachments.length === 0) return null;

    if (attachments.length === 1) {
      const item = attachments[0];
      if (item.kind === 'image') {
        return '1 ảnh đã sẵn sàng để xem trước';
      }
      return `${item.typeLabel} đã được chọn`;
    }

    const imageCount = attachments.filter((attachment) => attachment.kind === 'image').length;
    const documentCount = attachments.length - imageCount;
    const parts = [];
    if (documentCount > 0) parts.push(`${documentCount} tài liệu`);
    if (imageCount > 0) parts.push(`${imageCount} ảnh`);
    return `${parts.join(' và ')} đã được chọn`;
  }, [attachments]);

  const imageAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.kind === 'image'),
    [attachments],
  );

  const documentAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.kind === 'document'),
    [attachments],
  );

  const failedAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.uploadStatus === 'failed'),
    [attachments],
  );

  const hasFailedAttachments = failedAttachments.length > 0;

  const uploadSingleAttachment = async (attachment: PendingAttachment) => {
    // Text extraction is already done in addAttachments. This is just a fallback to retry.
    setAttachments((current) =>
      current.map((item) =>
        item.id === attachment.id
          ? { ...item, uploadStatus: 'uploading', errorMessage: undefined }
          : item,
      ),
    );

    try {
      const res = await api.extractTextFromImage(attachment.file);
      const normalizedText = (res.text || '').trim();

      if (!normalizedText) {
        setAttachments((current) =>
          current.map((item) =>
            item.id === attachment.id
              ? { ...item, uploadStatus: 'failed', extractedText: undefined, errorMessage: 'Không có nội dung' }
              : item,
          ),
        );
        return false;
      }

      const manualExtrasTokenBase = estimateTokens((valueRef.current || '') + (mode === 'generate' ? (extras || '') : ''));
      const existingExtractedTokens = attachmentsRef.current
        .filter((item) => item.id !== attachment.id && item.extractedText)
        .reduce((sum, item) => sum + estimateTokens(item.extractedText || ''), 0);
      const fileTokens = estimateTokens(normalizedText);
      const totalEstimatedTokens = manualExtrasTokenBase + existingExtractedTokens + fileTokens;

      if (totalEstimatedTokens > USER_TOKEN_LIMIT) {
        setAttachments((current) =>
          current.map((item) =>
            item.id === attachment.id
              ? {
                ...item,
                uploadStatus: 'failed',
                extractedText: undefined,
                errorMessage: `Quá token (~${totalEstimatedTokens}/${USER_TOKEN_LIMIT})`,
              }
              : item,
          ),
        );
        return false;
      }

      setAttachments((current) =>
        current.map((item) =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'uploaded', extractedText: normalizedText, errorMessage: undefined }
            : item,
        ),
      );
      return true;
    } catch {
      setAttachments((current) =>
        current.map((item) =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'failed', extractedText: undefined, errorMessage: 'Lỗi OCR' }
            : item,
        ),
      );
      return false;
    }
  };

  const handleRetryAttachment = async (id: string) => {
    if (disabled || isUploading) return;
    const target = attachments.find((item) => item.id === id);
    if (!target) return;

    setRetryingAttachmentId(id);
    await uploadSingleAttachment(target);
    setRetryingAttachmentId(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled || isUploading || retryingAttachmentId) return;

    const trimmedValue = value.trim();
    const hasAttachments = attachments.length > 0;
    const uploadedAttachments = attachments.filter(a => a.uploadStatus === 'uploaded');
    const isReady = attachments.every(a => a.uploadStatus === 'uploaded' || a.uploadStatus === 'failed');

    // Text is always required — files alone cannot be sent
    if (!trimmedValue) return;
    if (hasAttachments && !isReady) {
      setIsWaitingForAttachments(true);
      return;
    }
    if (hasFailedAttachments) {
      showToast('Có tệp đang lỗi. Vui lòng xoá hoặc bấm "Lại" để xử lý trước khi gửi.', 'warning');
      return;
    }

    setIsMenuOpen(false);

    // Snapshot file references BEFORE clearing UI (we need them for Cloudinary upload)
    const filesToUpload = uploadedAttachments.map(a => a.file);

    // Build extracted content for AI context
    const extractedContent = uploadedAttachments
      .filter(a => a.extractedText)
      .map(a => `[Nội dung tệp ${a.file.name}]:\n${a.extractedText}`)
      .join('\n\n');

    // Build final message and extras for AI
    const finalMessage = trimmedValue;
    const finalExtras = buildFinalExtras(mode, extras, extractedContent);

    // In QA mode, append compact [Tệp đính kèm: filename] markers to the message content.
    // These markers are recognised by parseMessageContent and rendered as file chips.
    // The full extracted text stays in finalExtras for RAG context only.
    const attachmentMarkers = uploadedAttachments
      .filter(a => a.extractedText)
      .map(a => `[Tệp đính kèm: ${a.file.name}]`)
      .join('\n');
    const finalMessageWithAttachments = mode === 'qa' && attachmentMarkers
      ? `${finalMessage}\n\n${attachmentMarkers}`
      : finalMessage;

    // Token validation
    const totalTokens = estimateTokens(finalMessage + (finalExtras || ''));
    if (totalTokens > USER_TOKEN_LIMIT) {
      showToast(`Nội dung quá dài (~${totalTokens} tokens). Vui lòng giới hạn dưới ${USER_TOKEN_LIMIT} tokens.`, 'warning');
      return;
    }

    setIsUploading(true);

    // Clear UI immediately - don't make user wait
    onValueChange?.('');
    setExtras('');
    setShowExtras(false);
    clearAttachments();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    setIsWaitingForAttachments(false);

    // Upload files to Cloudinary AFTER onSend so we have the resolved session ID
    // (onSend creates the session if it doesn't exist yet and returns its ID).
    try {
      const resolvedSessionId = await onSend?.(finalMessageWithAttachments, mode, finalExtras);

      // Use the session ID returned by onSend (the true session after possible creation),
      // falling back to the prop value if the session already existed.
      const uploadSessionId = (resolvedSessionId as string | undefined) || chatSessionId;
      if (filesToUpload.length > 0) {
        filesToUpload.forEach(file => {
          api.uploadDocument(file, file.name, uploadSessionId).catch(err => {
            console.warn('Cloudinary upload failed:', err);
            showToast(`Lỗi lưu trữ tệp "${file.name}": ${err.message || 'Hệ thống bận'}`, 'system-error');
          });
        });
      }
    } catch {
      // Send failed - UI already cleared, keep it clean
    } finally {
      setIsUploading(false);
    }
  };

  const closeMenu = () => setIsMenuOpen(false);

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragActive(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;

    dragCounterRef.current = 0;
    setIsDragActive(false);
    addAttachments(event.dataTransfer.files);
  };

  const toggleListening = () => {
    if (disabled) return;

    const speechRecognitionCtor =
      (window as typeof window & {
        SpeechRecognition?: new () => any;
        webkitSpeechRecognition?: new () => any;
      }).SpeechRecognition ||
      (window as typeof window & {
        SpeechRecognition?: new () => any;
        webkitSpeechRecognition?: new () => any;
      }).webkitSpeechRecognition;

    if (!speechRecognitionCtor) {
      showToast('Trình duyệt này chưa hỗ trợ nhập liệu bằng giọng nói.', 'warning');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new speechRecognitionCtor();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let transcript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          transcript += result[0]?.transcript || '';
        }
      }

      const trimmedTranscript = transcript.trim();
      if (!trimmedTranscript) return;

      const currentValue = valueRef.current.trim();
      const nextValue = currentValue
        ? `${currentValue} ${trimmedTranscript}`
        : trimmedTranscript;

      onValueChange?.(nextValue);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToPaste: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          filesToPaste.push(file);
        }
      }
    }

    if (filesToPaste.length > 0) {
      addAttachments(filesToPaste);
    }
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closeMenu();
        setShowPromptPicker(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
        setShowPromptPicker(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
      if (recognitionRef.current) {
        recognitionRef.current.abort?.();
        recognitionRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="w-full max-w-3xl shrink-0 flex flex-col sticky bottom-0 pb-0 bg-background/80 backdrop-blur-sm pt-2"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,text/markdown,application/rtf"
        onChange={(event) => {
          addAttachments(event.target.files ?? []);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={imageInputRef}
        className="hidden"
        type="file"
        multiple
        accept="image/*"
        onChange={(event) => {
          addAttachments(event.target.files ?? []);
          event.currentTarget.value = '';
        }}
      />

      {/* Mode Toggle Selection */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <button
          type="button"
          onClick={() => { setMode('qa'); setShowExtras(false); setExtras(''); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'qa'
            ? 'bg-primary text-on-primary shadow-sm'
            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-highest'
            }`}
        >
          <FileQuestion className="w-3.5 h-3.5" />
          Hỏi đáp Pháp luật
        </button>
        <button
          type="button"
          onClick={() => setMode('generate')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'generate'
            ? 'bg-secondary text-on-secondary shadow-sm'
            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-highest'
            }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Soạn thảo Văn bản
        </button>
      </div>

      {attachments.length > 0 && (
        <div className="mb-3 rounded-[26px] border border-outline-variant/15 bg-surface/72 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          {isWaitingForAttachments && (
            <div className="mb-3 flex items-center gap-3 rounded-[18px] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-on-surface-variant">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Đang tải tệp lên. Vui lòng đợi hoàn tất trước khi gửi.</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 px-1 pb-2.5">
            <div className="flex items-center gap-2 text-[13px] text-on-surface-variant">
              <Paperclip className="w-4 h-4" />
              <span>{attachmentSummary}</span>
            </div>
            <button
              type="button"
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              onClick={clearAttachments}
            >
              Xoá tất cả
            </button>
          </div>

          {attachments.length > 0 && (
            <div className="mt-1 flex gap-2 pb-2 overflow-x-auto no-scrollbar items-center">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className={`group inline-flex w-[180px] shrink-0 items-center gap-2 rounded-[14px] border bg-surface-container-high p-1.5 shadow-sm ${attachment.uploadStatus === 'failed' ? 'border-error/60 ring-2 ring-error/15'
                    : attachment.uploadStatus === 'uploading' ? 'border-primary/50 ring-2 ring-primary/20 animate-pulse'
                      : attachment.uploadStatus === 'uploaded' ? 'border-green-500/40 ring-1 ring-green-500/10'
                        : 'border-outline-variant/20'
                    }`}
                >
                  {attachment.kind === 'image' ? (
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[10px] bg-surface-container">
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.file.name}
                        className="h-full w-full object-cover"
                      />
                      {attachment.uploadStatus === 'uploading' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[10px]">
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${attachment.typeLabel === 'Excel'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : attachment.typeLabel === 'Word'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-red-500/10 text-red-600'
                        }`}
                    >
                      {attachment.uploadStatus === 'uploading' ? (
                        <Loader2 className="w-4 h-4 animate-spin opacity-70" />
                      ) : attachment.typeLabel === 'Excel' ? (
                        <FileSpreadsheet className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-on-surface leading-tight">
                      {attachment.file.name}
                    </p>
                    <p className="truncate text-[10px] mt-0.5">
                      {attachment.uploadStatus === 'uploading' ? (
                        <span className="text-primary">Đang đọc...</span>
                      ) : attachment.uploadStatus === 'uploaded' ? (
                        <span className="text-green-600">Đã đọc xong ✓</span>
                      ) : attachment.uploadStatus === 'failed' ? (
                        <span className="text-error">{attachment.errorMessage || 'Lỗi đọc'}</span>
                      ) : (
                        <span className="text-on-surface-variant">{attachment.kind === 'image' ? 'Ảnh' : attachment.typeLabel} • {formatFileSize(attachment.file.size)}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1 items-center justify-center">
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="rounded-full p-1 text-on-surface-variant opacity-70 transition-colors hover:bg-surface hover:text-on-surface group-hover:opacity-100"
                      aria-label="Remove item"
                      disabled={isUploading || !!retryingAttachmentId}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {attachment.uploadStatus === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetryAttachment(attachment.id)}
                        className="rounded-full bg-error text-on-error px-1 py-0.5 text-[9px] font-semibold"
                        disabled={isUploading || !!retryingAttachmentId}
                        title="Thử lại"
                      >
                        {retryingAttachmentId === attachment.id ? '...' : 'Lại'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Extras Field (Only for Generate Mode) */}
      <AnimatePresence>
        {mode === 'generate' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-2"
          >
            <div className="glass-morphism rounded-2xl border border-outline-variant/15 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-secondary">
                  <FileEdit className="w-3.5 h-3.5" />
                  Thông tin bổ sung (Ngày, Người ký, Số hiệu...)
                </div>
                <span className="text-[10px] text-on-surface-variant italic">Không bắt buộc</span>
              </div>
              <textarea
                ref={extrasRef}
                value={extras}
                onChange={(e) => setExtras(e.target.value)}
                placeholder="Ví dụ: Người ký: Nguyễn Văn A, Ngày ký: 20/05/2025, Số hiệu: 123/CV-BTC..."
                rows={1}
                className="w-full bg-transparent border-none focus:ring-0 text-[15px] leading-6 font-body text-on-surface placeholder:text-on-surface-variant/40 resize-none max-h-[72px] custom-scrollbar py-0.5"
                disabled={disabled}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={handleSubmit}
        className={`relative glass-morphism rounded-[30px] p-2 flex items-center gap-2 border border-outline-variant/15 focus-within:ring-4 focus-within:ring-primary/10 transition-all shadow-[0_10px_28px_rgba(0,0,0,0.1)] ${isDragActive ? 'ring-4 ring-primary/25 border-primary/40' : ''} ${disabled ? 'opacity-70' : ''}`}
      >
        {isDragActive && (
          <div className="absolute inset-2 z-10 flex items-center justify-center rounded-[24px] border border-dashed border-primary/45 bg-primary/10 backdrop-blur-sm pointer-events-none">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-primary">
              <FileUp className="w-4 h-4" />
              Kéo thả tệp hoặc ảnh vào đây
            </div>
          </div>
        )}
        <div className="relative">
          <button
            className={`flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors disabled:pointer-events-none ${isMenuOpen ? 'text-primary' : ''}`}
            type="button"
            disabled={disabled}
            onClick={() => setIsMenuOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            title="Thêm tệp"
          >
            <PlusCircle className="w-5 h-5" />
          </button>

          {isMenuOpen && (
            <div className="absolute left-0 bottom-full mb-3 w-64 overflow-hidden rounded-3xl border border-outline-variant/20 bg-surface/95 shadow-[0_20px_45px_rgba(0,0,0,0.12)] backdrop-blur-xl">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-on-surface hover:bg-surface-container-high transition-colors disabled:pointer-events-none"
                disabled={disabled}
                onClick={() => {
                  closeMenu();
                  fileInputRef.current?.click();
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileUp className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">Tải tệp lên</span>
                  <span className="text-[11px] text-on-surface-variant">Word, PDF, Excel, TXT</span>
                </div>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-on-surface hover:bg-surface-container-high transition-colors disabled:pointer-events-none"
                disabled={disabled}
                onClick={() => {
                  closeMenu();
                  imageInputRef.current?.click();
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  <Image className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">Tải ảnh lên</span>
                  <span className="text-[11px] text-on-surface-variant">Xem trước trước khi gửi</span>
                </div>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-on-surface hover:bg-surface-container-high transition-colors disabled:pointer-events-none"
                disabled={disabled}
                onClick={async () => {
                  closeMenu();
                  setShowPromptPicker(true);
                  if (promptTemplates.length === 0) {
                    setIsLoadingTemplates(true);
                    try {
                      const res = await api.getUserPromptTemplates();
                      setPromptTemplates(res.items);
                    } catch {
                      showToast('Không thể tải danh sách mẫu prompt', 'error');
                    } finally {
                      setIsLoadingTemplates(false);
                    }
                  }
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-tertiary/10 text-tertiary">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">Prompt mẫu</span>
                  <span className="text-[11px] text-on-surface-variant">Sử dụng lệnh mẫu có sẵn</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Prompt Template Picker Popup */}
        {showPromptPicker && (
          <div
            ref={promptPickerRef}
            className="absolute left-0 bottom-full mb-3 w-80 overflow-hidden rounded-3xl border border-outline-variant/20 bg-surface/95 shadow-[0_20px_45px_rgba(0,0,0,0.12)] backdrop-blur-xl z-50"
          >
            <div className="px-4 py-3 border-b border-outline-variant/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-tertiary" />
                <span className="text-sm font-bold text-on-surface">Prompt mẫu</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPromptPicker(false)}
                className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-8 gap-2 text-on-surface-variant">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Đang tải...</span>
                </div>
              ) : promptTemplates.length === 0 ? (
                <div className="py-8 text-center text-on-surface-variant text-xs">
                  Chưa có mẫu prompt nào.
                </div>
              ) : (
                promptTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-high transition-colors border-b border-outline-variant/10 last:border-b-0"
                    onClick={() => {
                      onValueChange?.(tpl.query);

                      // Auto-switch mode based on template configuration
                      if (tpl.mode === 'generate') {
                        setMode('generate');
                        if (tpl.extra_instructions) {
                          setExtras(tpl.extra_instructions);
                          setShowExtras(true);
                        }
                      } else {
                        setMode('qa');
                        setShowExtras(false);
                      }

                      setShowPromptPicker(false);
                      showToast(`Đã chèn mẫu "${tpl.name}"`, 'success');
                      // Log usage to backend
                      api.recordPromptTemplateUse(tpl.id).catch((err) => {
                        console.warn('Failed to log template usage:', err);
                      });
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-on-surface truncate">{tpl.name}</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2 leading-relaxed">
                        {tpl.description || tpl.query.slice(0, 80) + '...'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex min-h-14 flex-1 items-end rounded-[24px] bg-surface/70 px-3.5 py-2.5 transition-shadow focus-within:ring-0">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant font-body text-[15px] leading-6 outline-none resize-none py-0.5 max-h-[72px] custom-scrollbar"
            placeholder={placeholder}
            rows={1}
            value={value}
            onChange={(e) => onValueChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled}
          />
          <button
            className={`ml-2 rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors disabled:pointer-events-none ${isListening ? 'text-primary bg-primary/10' : ''}`}
            type="button"
            disabled={disabled}
            onClick={toggleListening}
            aria-pressed={isListening}
            title={isListening ? 'Dừng nhập giọng nói' : 'Nhập bằng giọng nói'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed hover:opacity-90 transition-opacity active:scale-95 disabled:grayscale disabled:opacity-50 disabled:pointer-events-none"
            type="submit"
            disabled={!value.trim() || disabled || isUploading || !!retryingAttachmentId || hasFailedAttachments}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </form>
      {isUploading && uploadProgress && (
        <div className="mt-2 flex items-center gap-2 px-2 text-[11px] text-primary font-medium">
          <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
          <span>
            Đang tải lên {uploadProgress.current}/{uploadProgress.total}: {uploadProgress.fileName}
          </span>
        </div>
      )}
      {hasFailedAttachments && (
        <div className="mt-2 flex items-center gap-2 px-2 text-[11px] text-error font-medium">
          <span>{failedAttachments.length} tệp tải lỗi. Bấm "Thử lại" ngay trên chip để tải lại.</span>
        </div>
      )}
      {statusMessage && (
        <p className="text-center text-[11px] text-primary mt-1 font-medium">
          {statusMessage}
        </p>
      )}
      {note && (
        <p className="text-center text-[10px] text-on-surface-variant/60 mt-1 uppercase tracking-[0.2em] font-label">
          {note}
        </p>
      )}
    </div>
  );
}
