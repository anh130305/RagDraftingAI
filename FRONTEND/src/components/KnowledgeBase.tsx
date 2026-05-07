import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, Database, FileText, X, Trash2,
  CheckCircle2, AlertCircle, Clock, Search,
  HardDrive, Layers, Activity, RefreshCw, Shield,
  Zap, ArrowDownToLine, XCircle, Loader2, Square, CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import * as api from '../lib/api';
import { useToast } from '../lib/ToastContext';
import { useConfirm } from '../lib/ConfirmContext';
import type { DocumentResponse } from '../lib/api';
import RAGPanel from './RAGPanel';

interface PendingUpload {
  id: string;
  fileName: string;
  status: 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

export default function KnowledgeBase() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Action states ──
  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [batchAction, setBatchAction] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [ragRefreshSignal, setRagRefreshSignal] = useState(0);
  const [ragSyncing, setRagSyncing] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await api.getAdminKnowledgeBase(0, 200);
      setDocuments(data.items);
    } catch (err: any) {
      console.error("Lỗi khi tải danh sách tri thức", err);
    }
  }, []);

  // Pause/resume interval khi upload để tránh race condition
  const pausePolling = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  const resumePolling = () => {
    if (!timerRef.current) {
      timerRef.current = setInterval(fetchDocuments, 5000);
    }
  };

  const refreshRagStatus = () => {
    setRagRefreshSignal(signal => signal + 1);
  };

  const finishRagSync = () => {
    setRagSyncing(false);
    window.setTimeout(refreshRagStatus, 0);
  };

  useEffect(() => {
    fetchDocuments();
    timerRef.current = setInterval(fetchDocuments, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchDocuments]);

  useEffect(() => {
    const validIds = new Set(documents.map(doc => doc.id));
    setSelectedIds(prev => {
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [documents]);

  // ── Upload (multi-file) ──
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadMultiple(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadMultiple(Array.from(e.target.files));
    }
  };

  const handleUploadMultiple = async (files: File[]) => {
    if (files.length === 0) return;

    // Tạm dừng polling tránh race condition
    pausePolling();
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    // Create pending entries for all files
    const newPending: PendingUpload[] = files.map((f, i) => ({
      id: `pending-${Date.now()}-${i}`,
      fileName: f.name,
      status: 'uploading' as const,
    }));
    setPendingUploads(prev => [...prev, ...newPending]);

    const progressInterval = setInterval(() => {
      setUploadProgress(p => (p >= 90 ? 90 : p + 5));
    }, 300);

    // Upload files concurrently — lấy kết quả trực tiếp từ allSettled
    const results = await Promise.allSettled(
      files.map(async (file, i) => {
        try {
          await api.uploadAdminKnowledgeBaseDocument(file);
          // Mark this file as success
          setPendingUploads(prev =>
            prev.map(p => p.id === newPending[i].id ? { ...p, status: 'success' as const } : p)
          );
        } catch (err: any) {
          // Mark this file as error
          setPendingUploads(prev =>
            prev.map(p => p.id === newPending[i].id
              ? { ...p, status: 'error' as const, errorMessage: err.message || 'Lỗi' }
              : p
            )
          );
          // Re-throw để allSettled ghi nhận là rejected
          throw err;
        }
      })
    );

    clearInterval(progressInterval);
    setUploadProgress(100);

    // Đếm kết quả từ allSettled results
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const errorCount = results.filter(r => r.status === 'rejected').length;

    // Refresh document list
    await fetchDocuments();

    // Show summary toast
    if (successCount > 0 && errorCount === 0) {
      showToast(`Đã tải lên thành công ${successCount} tệp`, 'success');
    } else if (successCount > 0 && errorCount > 0) {
      showToast(`Tải lên: ${successCount} thành công, ${errorCount} thất bại`, 'warning');
    } else if (errorCount > 0 && successCount === 0) {
      setError(`Không thể tải lên ${errorCount} tệp. Vui lòng thử lại.`);
    }

    // Xoá pending rows sau 2 giây (để user thấy trạng thái success/error)
    setTimeout(() => {
      const pendingIds = new Set(newPending.map(p => p.id));
      setPendingUploads(prev => prev.filter(p => !pendingIds.has(p.id)));
    }, 2000);

    setTimeout(() => setUploadProgress(0), 1000);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Khởi động lại polling sau khi upload xong
    resumePolling();
  };

  // ── Ingest to ChromaDB ──
  const handleIngest = async (doc: DocumentResponse) => {
    const ok = await confirm({
      title: 'Nạp tri thức vào Vector Database',
      message: `Hệ thống sẽ xử lý file "${doc.title}" và nạp vào Vector Database. Quá trình có thể mất vài phút.`,
      confirmLabel: 'Bắt đầu Ingest',
      variant: 'info',
    });
    if (!ok) return;

    setIngestingId(doc.id);
    setRagSyncing(true);
    try {
      const res = await api.ingestDocToRAG(doc.id);
      showToast(`Ingest thành công "${doc.title}": ${res.chunks_created ?? 0} chunks`, 'success');
      await fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi ingest', 'error');
    } finally {
      setIngestingId(null);
      finishRagSync();
    }
  };

  // ── Remove from Vector Database only (soft) ──
  const handleUningest = async (doc: DocumentResponse) => {
    const ok = await confirm({
      title: 'Gỡ khỏi Vector Database',
      message: `Xoá tất cả chunks của "${doc.title}" khỏi vector database? File vẫn giữ trên Cloudinary.`,
      confirmLabel: 'Gỡ khỏi RAG',
      variant: 'danger',
    });
    if (!ok) return;

    setDeletingId(doc.id);
    setRagSyncing(true);
    try {
      await api.uningestDocFromRAG(doc.id);
      showToast(`Đã gỡ "${doc.title}" khỏi Vector Database. File gốc vẫn còn.`, 'warning');
      await fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi gỡ', 'error');
    } finally {
      setDeletingId(null);
      finishRagSync();
    }
  };

  // ── Hard delete (ChromaDB + Cloudinary + DB) ──
  const handleHardDelete = async (doc: DocumentResponse) => {
    const ok = await confirm({
      title: 'XOÁ VĨNH VIỄN tài liệu',
      message: `Xoá "${doc.title}" khỏi Vector Database, Cloudinary và CSDL. Không thể hoàn tác!`,
      confirmLabel: 'Xoá vĩnh viễn',
      variant: 'danger',
    });
    if (!ok) return;

    setDeletingId(doc.id);
    setRagSyncing(true);
    try {
      await api.hardDeleteDoc(doc.id);
      showToast(`Đã xoá vĩnh viễn tài liệu "${doc.title}".`, 'success');
      await fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xoá', 'error');
    } finally {
      setDeletingId(null);
      finishRagSync();
    }
  };

  // ── Delete from Cloudinary only (not ingested docs) ──
  const handleDeleteCloud = async (doc: DocumentResponse) => {
    const ok = await confirm({
      title: 'Xoá tài liệu khỏi hệ thống',
      message: `Xoá "${doc.title}" khỏi Cloudinary và cơ sở dữ liệu?`,
      confirmLabel: 'Xoá',
      variant: 'danger',
    });
    if (!ok) return;

    setDeletingId(doc.id);
    try {
      await api.deleteAdminKnowledgeBase(doc.id);
      showToast(`Đã xoá tài liệu "${doc.title}".`, 'success');
      await fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xoá', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const summarizeBatch = (items: api.RAGBatchItem[]) => {
    const ok = items.filter(item => item.status === 'ok').length;
    const skipped = items.filter(item => item.status === 'skipped').length;
    const errors = items.filter(item => item.status === 'error').length;
    return { ok, skipped, errors };
  };

  const runBatchAction = async (
    action: string,
    docsToProcess: DocumentResponse[],
    runner: (ids: string[]) => Promise<api.RAGBatchResponse>,
    successLabel: string,
  ) => {
    if (docsToProcess.length === 0) return;
    setBatchAction(action);
    setRagSyncing(true);
    try {
      const result = await runner(docsToProcess.map(doc => doc.id));
      const { ok, skipped, errors } = summarizeBatch(result.items);
      const toastType: 'warning' | 'success' = errors > 0 ? 'warning' : 'success';
      showToast(`${successLabel}: ${ok} thành công${skipped ? `, ${skipped} bỏ qua` : ''}${errors ? `, ${errors} lỗi` : ''}`, toastType);
      setSelectedIds(new Set());
      await fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xử lý hàng loạt', 'error');
    } finally {
      setBatchAction(null);
      finishRagSync();
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  // ── Split documents ──
  const ingestedDocs = documents.filter(d =>
    d.rag_ingested && d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const notIngestedDocs = documents.filter(d =>
    !d.rag_ingested && d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const visibleDocs = [...ingestedDocs, ...notIngestedDocs];
  const selectedDocs = documents.filter(d => selectedIds.has(d.id));
  const selectedIngestedDocs = selectedDocs.filter(d => d.rag_ingested);
  const selectedNotIngestedDocs = selectedDocs.filter(d => !d.rag_ingested);
  const allVisibleSelected = visibleDocs.length > 0 && visibleDocs.every(doc => selectedIds.has(doc.id));

  const stats = {
    total: documents.length,
    ingested: documents.filter(d => d.rag_ingested).length,
    notIngested: documents.filter(d => !d.rag_ingested).length,
    chunks: documents.reduce((acc, curr) => acc + (curr.chunk_count || 0), 0)
  };

  const hasSelection = selectedDocs.length > 0;
  const isBatchBusy = batchAction !== null;
  const bulkDisabled = isBatchBusy || ragSyncing || isUploading;

  const toggleDocSelection = (docId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleDocs.forEach(doc => next.delete(doc.id));
      } else {
        visibleDocs.forEach(doc => next.add(doc.id));
      }
      return next;
    });
  };

  const handleBatchIngest = async () => {
    const ok = await confirm({
      title: 'Ingest hàng loạt',
      message: `Nạp ${selectedNotIngestedDocs.length} tài liệu vào Vector Database và rebuild BM25 một lần sau khi hoàn tất?`,
      confirmLabel: 'Ingest đã chọn',
      variant: 'info',
    });
    if (!ok) return;
    await runBatchAction('ingest', selectedNotIngestedDocs, api.batchIngestDocsToRAG, 'Ingest hàng loạt');
  };

  const handleBatchUningest = async () => {
    const ok = await confirm({
      title: 'Gỡ RAG hàng loạt',
      message: `Gỡ ${selectedIngestedDocs.length} tài liệu khỏi Vector Database và rebuild BM25 một lần sau khi hoàn tất? File gốc vẫn giữ trên Cloudinary.`,
      confirmLabel: 'Gỡ RAG đã chọn',
      variant: 'danger',
    });
    if (!ok) return;
    await runBatchAction('uningest', selectedIngestedDocs, api.batchUningestDocsFromRAG, 'Gỡ RAG hàng loạt');
  };

  const handleBatchHardDelete = async () => {
    const ok = await confirm({
      title: 'Xoá hàng loạt',
      message: `Xoá vĩnh viễn ${selectedDocs.length} tài liệu đã chọn khỏi RAG, Cloudinary và CSDL nếu có. Không thể hoàn tác.`,
      confirmLabel: 'Xoá đã chọn',
      variant: 'danger',
    });
    if (!ok) return;
    await runBatchAction('delete', selectedDocs, api.batchHardDeleteDocs, 'Xoá hàng loạt');
  };

  // ── Render a document row ──
  const renderDocRow = (doc: DocumentResponse, isIngested: boolean) => {
    const isSelected = selectedIds.has(doc.id);
    const isLoading = ingestingId === doc.id || deletingId === doc.id || (isBatchBusy && isSelected);
    return (
      <div key={doc.id} className={cn(
        "flex items-center justify-between p-3 rounded-lg hover:bg-surface-high border transition-all group",
        isSelected ? "bg-primary/5 border-primary/20" : "border-transparent hover:border-outline-variant/30"
      )}>
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleDocSelection(doc.id)}
            className="p-1 rounded-md text-on-surface-variant hover:text-primary focus:text-primary transition-colors shrink-0"
            title={isSelected ? 'Bỏ chọn' : 'Chọn tài liệu'}
            disabled={isBatchBusy}
          >
            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
          <div className="w-10 h-10 rounded-lg bg-surface-highest flex items-center justify-center shrink-0 border border-outline-variant/30">
            <FileText className={cn("w-5 h-5", doc.title.endsWith('.pdf') ? "text-red-400" : "text-blue-400")} />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-on-surface truncate" title={doc.title}>{doc.title}</h4>
            <div className="flex items-center gap-3 text-[10px] text-on-surface-variant mt-0.5">
              <span className="font-bold">{formatSize(doc.file_size)}</span>
              <span>•</span>
              <span>{new Date(doc.created_at).toLocaleDateString('vi-VN')}</span>
              {isIngested && (
                <>
                  <span>•</span>
                  <span className="px-1.5 py-0.5 bg-secondary/10 text-secondary rounded border border-secondary/20">{doc.chunk_count} chunks</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pl-4">
          {isLoading ? (
            <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] text-primary font-bold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang xử lý...
            </div>
          ) : isIngested ? (
            <>
              {/* Uningest — remove from ChromaDB only */}
              <button
                onClick={() => handleUningest(doc)}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-outline-variant text-on-surface-variant hover:text-yellow-600 hover:border-yellow-500/30 hover:bg-yellow-500/5 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Gỡ khỏi ChromaDB (giữ file)"
              >
                <ArrowDownToLine className="w-3 h-3" /> Gỡ RAG
              </button>
              {/* Hard delete — remove all */}
              <button
                onClick={() => handleHardDelete(doc)}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-error/20 text-error/70 hover:text-error hover:bg-error/10 hover:border-error/30 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Xoá vĩnh viễn (ChromaDB + Cloudinary)"
              >
                <XCircle className="w-3 h-3" /> Xoá hết
              </button>
            </>
          ) : (
            <>
              {/* Ingest to ChromaDB */}
              <button
                onClick={() => handleIngest(doc)}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-on-primary transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Nạp vào ChromaDB"
              >
                <Zap className="w-3 h-3" /> Ingest
              </button>
              {/* Delete from Cloudinary */}
              <button
                onClick={() => handleDeleteCloud(doc)}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-error/20 text-error/70 hover:text-error hover:bg-error/10 hover:border-error/30 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Xoá khỏi Cloudinary"
              >
                <Trash2 className="w-3 h-3" /> Xoá
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <header className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface mb-1">
            Cơ sở tri thức (RAG)
          </h2>
          <p className="text-xs text-on-surface-variant max-w-2xl font-medium">
            Quản lý tài liệu tri thức nội bộ và cơ sở dữ liệu vector ChromaDB.
          </p>
        </div>
        <div className="px-3 py-1 bg-tertiary/10 border border-tertiary/20 rounded-lg text-[10px] font-bold text-tertiary uppercase tracking-wider">
          CHẾ ĐỘ QUẢN TRỊ VIÊN
        </div>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-outline-variant/30 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tổng tài liệu</p>
            <p className="text-xl font-extrabold font-headline">{stats.total}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-outline-variant/30 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Đã Ingest</p>
            <p className="text-xl font-extrabold font-headline">{stats.ingested}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-outline-variant/30 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Chưa Ingest</p>
            <p className="text-xl font-extrabold font-headline">{stats.notIngested}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-outline-variant/30 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tổng Chunks</p>
            <p className="text-xl font-extrabold font-headline">{stats.chunks.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Upload + RAG Status */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Upload Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className={cn(
              "glass-card p-8 rounded-xl border-dashed border-2 transition-all flex flex-col items-center justify-center text-center min-h-[240px]",
              isUploading ? "border-primary/50 bg-primary/5" : "border-outline-variant hover:border-primary/40 hover:bg-surface-highest/50 cursor-pointer"
            )}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept=".pdf,.txt,.docx,.md" multiple />
            <AnimatePresence mode="wait">
              {isUploading ? (
                <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full">
                  <div className="w-16 h-16 rounded-full border-4 border-surface-highest border-t-primary animate-spin mb-4" />
                  <h3 className="text-lg font-bold text-primary mb-2">Đang nạp tri thức...</h3>
                  <div className="w-full max-w-[200px] h-2 bg-surface-highest rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-surface-highest rounded-full flex items-center justify-center mb-4 shadow-xl border border-outline-variant/30">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-on-surface mb-2">Thêm tri thức mới</h3>
                  <p className="text-xs text-on-surface-variant mb-6 max-w-[200px] leading-relaxed">
                    Upload file → Cloudinary. Sau đó bấm Ingest để nạp vào ChromaDB.
                  </p>
                  <button className="px-6 py-2.5 bg-surface-highest hover:bg-primary hover:text-on-primary border border-outline-variant hover:border-primary text-on-surface rounded-full text-xs font-bold transition-all shadow-sm">
                    Chọn Tệp
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RAG Panel — ChromaDB Status only */}
          <RAGPanel refreshSignal={ragRefreshSignal} syncing={ragSyncing} />
        </div>

        {/* Right: Document List — Split by ingest status */}
        <div className="lg:col-span-8 flex flex-col h-[800px] bg-surface rounded-xl border border-outline-variant overflow-hidden">
          {/* Header + Search */}
          <div className="border-b border-outline-variant/50 bg-surface-low">
            <div className="p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleVisibleSelection}
                  disabled={visibleDocs.length === 0 || isBatchBusy}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-highest disabled:opacity-40 transition-colors"
                  title={allVisibleSelected ? 'Bỏ chọn tất cả đang hiển thị' : 'Chọn tất cả đang hiển thị'}
                >
                  {allVisibleSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </button>
                <h3 className="font-bold text-on-surface flex items-center gap-2">
                  Kho lưu trữ Tri thức chung
                </h3>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Tìm kiếm tri thức..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs w-64 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
                />
              </div>
            </div>
            {hasSelection && (
              <div className="px-4 pb-4 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-on-surface-variant mr-1">
                  Đã chọn {selectedDocs.length}
                </span>
                <button
                  type="button"
                  onClick={handleBatchIngest}
                  disabled={bulkDisabled || selectedNotIngestedDocs.length === 0}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-on-primary disabled:opacity-40 disabled:hover:bg-primary/10 disabled:hover:text-primary transition-all"
                >
                  {batchAction === 'ingest' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Ingest {selectedNotIngestedDocs.length}
                </button>
                <button
                  type="button"
                  onClick={handleBatchUningest}
                  disabled={bulkDisabled || selectedIngestedDocs.length === 0}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-yellow-500/25 text-yellow-600 hover:bg-yellow-500/10 disabled:opacity-40 transition-all"
                >
                  {batchAction === 'uningest' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownToLine className="w-3.5 h-3.5" />}
                  Gỡ RAG {selectedIngestedDocs.length}
                </button>
                <button
                  type="button"
                  onClick={handleBatchHardDelete}
                  disabled={bulkDisabled || selectedDocs.length === 0}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-error/25 text-error hover:bg-error/10 disabled:opacity-40 transition-all"
                >
                  {batchAction === 'delete' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Xoá {selectedDocs.length}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={isBatchBusy}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-on-surface-variant hover:bg-surface-highest disabled:opacity-40 transition-all"
                >
                  Bỏ chọn
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* ── Pending uploads (ghost rows) ── */}
            {pendingUploads.length > 0 && (
              <div>
                <div className="sticky top-0 z-20 px-4 py-2 bg-primary/5 border-b border-primary/10 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                    Đang tải lên ({pendingUploads.filter(p => p.status === 'uploading').length} tệp)
                  </span>
                </div>
                <div className="p-2 space-y-1">
                  <AnimatePresence>
                    {pendingUploads.map(pending => (
                      <motion.div
                        key={pending.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 20, transition: { duration: 0.3 } }}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-all",
                          pending.status === 'uploading' && "bg-primary/5 border-primary/15 animate-pulse",
                          pending.status === 'success' && "bg-green-500/5 border-green-500/20",
                          pending.status === 'error' && "bg-red-500/5 border-red-500/20"
                        )}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border",
                            pending.status === 'uploading' && "bg-primary/10 border-primary/20",
                            pending.status === 'success' && "bg-green-500/10 border-green-500/20",
                            pending.status === 'error' && "bg-red-500/10 border-red-500/20"
                          )}>
                            {pending.status === 'uploading' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                            {pending.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                            {pending.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className={cn(
                              "text-sm font-semibold truncate",
                              pending.status === 'uploading' && "text-on-surface/60",
                              pending.status === 'success' && "text-green-600",
                              pending.status === 'error' && "text-red-600"
                            )} title={pending.fileName}>
                              {pending.fileName}
                            </h4>
                            <p className={cn(
                              "text-[10px] font-medium mt-0.5",
                              pending.status === 'uploading' && "text-primary",
                              pending.status === 'success' && "text-green-500",
                              pending.status === 'error' && "text-red-500"
                            )}>
                              {pending.status === 'uploading' && 'Đang tải lên Cloudinary...'}
                              {pending.status === 'success' && 'Tải lên thành công!'}
                              {pending.status === 'error' && (pending.errorMessage || 'Lỗi khi tải lên')}
                            </p>
                          </div>
                        </div>
                        {pending.status === 'uploading' && (
                          <div className="w-20 h-1.5 bg-surface-highest rounded-full overflow-hidden shrink-0">
                            <div className="h-full bg-primary rounded-full animate-upload-pulse" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                {documents.length > 0 && (
                  <div className="border-t-2 border-dashed border-primary/20 mx-4" />
                )}
              </div>
            )}

            {documents.length === 0 && pendingUploads.length === 0 ? (
              // Hoàn toàn trống: chưa có file nào và không có upload đang chờ
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant/50 p-6 text-center">
                <FileText className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Chưa có tri thức nào</p>
                <p className="text-xs">Bắt đầu nạp tri thức chung cho hệ thống AI từ khung bên trái.</p>
              </div>
            ) : documents.length > 0 ? (
              // Có documents: hiển thị danh sách bình thường
              <>
                {/* ── Section: Đã Ingest vào ChromaDB ── */}
                {ingestedDocs.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-4 py-2 bg-green-500/5 border-b border-green-500/10 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-[11px] font-bold text-green-600 uppercase tracking-wider">
                        Đã Ingest vào ChromaDB ({ingestedDocs.length})
                      </span>
                    </div>
                    <div className="p-2 space-y-1">
                      {ingestedDocs.map(doc => renderDocRow(doc, true))}
                    </div>
                  </div>
                )}

                {/* ── Divider ── */}
                {ingestedDocs.length > 0 && notIngestedDocs.length > 0 && (
                  <div className="border-t-2 border-dashed border-outline-variant/40 mx-4" />
                )}

                {/* ── Section: Chưa Ingest ── */}
                {notIngestedDocs.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-4 py-2 bg-yellow-500/5 border-b border-yellow-500/10 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="text-[11px] font-bold text-yellow-600 uppercase tracking-wider">
                        Chưa Nạp Vào Vector DataBase — chỉ trên Cloud ({notIngestedDocs.length})
                      </span>
                    </div>
                    <div className="p-2 space-y-1">
                      {notIngestedDocs.map(doc => renderDocRow(doc, false))}
                    </div>
                  </div>
                )}

                {ingestedDocs.length === 0 && notIngestedDocs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-on-surface-variant/50 p-6 text-center">
                    <Search className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium">Không tìm thấy kết quả</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
