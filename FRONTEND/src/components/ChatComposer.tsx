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
} from 'lucide-react';
import { useToast } from '../lib/ToastContext';
import * as api from '../lib/api';
import type { PromptTemplateResponse } from '../lib/api';

interface ChatComposerProps {
  placeholder?: string;
  note?: string;
  statusMessage?: string;
  onSend?: (content: string) => void | Promise<void>;
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
  const recognitionRef = useRef<any>(null);
  const valueRef = useRef(value);
  const attachmentsRef = useRef<PendingAttachment[]>([]);
  const dragCounterRef = useRef(0);
  const { showToast } = useToast();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [retryingAttachmentId, setRetryingAttachmentId] = useState<string | null>(null);

  // Prompt template states
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplateResponse[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const promptPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

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

    setAttachments((current) => {
      const existing = new Set(current.map((item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`));
      const uniqueNext = nextAttachments.filter((item) => {
        const key = `${item.file.name}-${item.file.size}-${item.file.lastModified}`;
        if (existing.has(key)) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          return false;
        }
        existing.add(key);
        return true;
      });

      const combined = [...current, ...uniqueNext];

      if (combined.length > 5) {
        showToast('Chỉ cho phép tải lên tối đa 5 tệp tin cùng một lúc.', 'warning');
        for (let i = 5; i < combined.length; i++) {
          if (combined[i].previewUrl) URL.revokeObjectURL(combined[i].previewUrl!);
        }
        return combined.slice(0, 5);
      }

      return combined;
    });

    setIsMenuOpen(false);

    // ONLY extract text for in-context RAG usage.
    for (const attachment of nextAttachments) {
      try {
        const res = await api.extractTextFromImage(attachment.file);
        setAttachments(current => current.map(item =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'uploaded', extractedText: res.text }
            : item
        ));
      } catch (err) {
        showToast(`Lỗi khi trích xuất văn bản từ ${attachment.file.name}`, 'error');
        setAttachments(current => current.map(item =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'failed' }
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

  const uploadSingleAttachment = async (attachment: PendingAttachment) => {
    // Text extraction is already done in addAttachments. This is just a fallback to retry.
    setActiveUploadId(attachment.id);
    setAttachments((current) =>
      current.map((item) =>
        item.id === attachment.id
          ? { ...item, uploadStatus: 'uploading' }
          : item,
      ),
    );

    try {
      const res = await api.extractTextFromImage(attachment.file);
      setAttachments((current) =>
        current.map((item) =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'uploaded', extractedText: res.text }
            : item,
        ),
      );
      return true;
    } catch {
      setAttachments((current) =>
        current.map((item) =>
          item.id === attachment.id
            ? { ...item, uploadStatus: 'failed' }
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
    setActiveUploadId(null);
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
      showToast('Vui lòng đợi tệp được xử lý xong.', 'warning');
      return;
    }

    setIsMenuOpen(false);
    setIsUploading(true);

    // Snapshot file references BEFORE clearing UI (we need them for Cloudinary upload)
    const filesToUpload = uploadedAttachments.map(a => a.file);

    // Build extracted content for AI context
    const extractedContent = uploadedAttachments
      .filter(a => a.extractedText)
      .map(a => `[Nội dung tệp ${a.file.name}]:\n${a.extractedText}`)
      .join('\n\n');

    // Build final message for AI
    const finalMessage = trimmedValue
      ? (extractedContent ? trimmedValue + '\n\n' + extractedContent : trimmedValue)
      : extractedContent;

    // Clear UI immediately - don't make user wait
    onValueChange?.('');
    clearAttachments();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';

    // Upload successfully extracted files to Cloudinary.
    filesToUpload.forEach(file => {
      api.uploadDocument(file, file.name, chatSessionId).catch(err => {
        console.warn('Cloudinary upload failed:', err);
        showToast(`Lỗi lưu trữ tệp "${file.name}": ${err.message || 'Hệ thống bận'}`, 'system-error');
      });
    });

    try {
      await onSend?.(finalMessage);
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
      setIsTranscribing(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsTranscribing(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    setIsTranscribing(true);
    recognition.start();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
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
      {attachments.length > 0 && (
        <div className="mb-3 rounded-[26px] border border-outline-variant/15 bg-surface/72 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl">
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
                        <span className="text-error">Lỗi đọc</span>
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
      <form
        onSubmit={handleSubmit}
        className={`relative glass-morphism rounded-[30px] p-2 flex items-center gap-2 border border-outline-variant/15 focus-within:ring-4 focus-within:ring-primary/10 transition-all shadow-[0_10px_28px_rgba(0,0,0,0.1)] ${isDragActive ? 'ring-4 ring-primary/25 border-primary/40' : ''}`}
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
                      onValueChange?.(tpl.content);
                      setShowPromptPicker(false);
                      showToast(`Đã chèn mẫu "${tpl.name}"`, 'success');
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-on-surface truncate">{tpl.name}</span>
                        {tpl.is_default && (
                          <Star className="w-3 h-3 text-amber-500 shrink-0 fill-amber-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2 leading-relaxed">
                        {tpl.description || tpl.content.slice(0, 80) + '...'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex min-h-14 flex-1 items-center rounded-[24px] bg-surface/70 px-3.5 py-1.5 transition-shadow focus-within:ring-0">
          <input
            className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant font-body text-[15px] leading-6 outline-none"
            placeholder={placeholder}
            type="text"
            value={value}
            onChange={(e) => onValueChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
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
            disabled={!value.trim() || disabled || isUploading || !!retryingAttachmentId}
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
      {failedAttachments.length > 0 && (
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
