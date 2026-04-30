import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, Database, FileText, X, Trash2,
  CheckCircle2, AlertCircle, Clock, Search,
  HardDrive, Layers, Activity, RefreshCw, Shield,
  Zap, ArrowDownToLine, XCircle, Loader2
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

  useEffect(() => {
    fetchDocuments();
    timerRef.current = setInterval(fetchDocuments, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchDocuments]);

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
    try {
      const res = await api.ingestDocToRAG(doc.id);
      showToast(`Ingest thành công: ${res.chunks_created ?? 0} chunks`, 'success');
      await fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi ingest', 'error');
    } finally {
      setIngestingId(null);
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
    try {
      await api.uningestDocFromRAG(doc.id);
      showToast('Đã gỡ khỏi Vector Database. File vẫn còn trên Cloudinary.', 'success');
      await fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi gỡ', 'error');
    } finally {
      setDeletingId(null);
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
    try {
      await api.hardDeleteDoc(doc.id);
      showToast('Đã xoá vĩnh viễn tài liệu.', 'success');
      await fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xoá', 'error');
    } finally {
      setDeletingId(null);
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
      showToast('Đã xoá tài liệu.', 'success');
      await fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xoá', 'error');
    } finally {
      setDeletingId(null);
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

  const stats = {
    total: documents.length,
    ingested: documents.filter(d => d.rag_ingested).length,
    notIngested: documents.filter(d => !d.rag_ingested).length,
    chunks: documents.reduce((acc, curr) => acc + (curr.chunk_count || 0), 0)
  };

  // ── Render a document row ──
  const renderDocRow = (doc: DocumentResponse, isIngested: boolean) => {
    const isLoading = ingestingId === doc.id || deletingId === doc.id;
    return (
      <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-high border border-transparent hover:border-outline-variant/30 transition-all group">
        <div className="flex items-center gap-3 overflow-hidden">
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
          <RAGPanel />
        </div>

        {/* Right: Document List — Split by ingest status */}
        <div className="lg:col-span-8 flex flex-col h-[800px] bg-surface rounded-xl border border-outline-variant overflow-hidden">
          {/* Header + Search */}
          <div className="p-4 border-b border-outline-variant/50 flex flex-wrap items-center justify-between gap-4 bg-surface-low">
            <h3 className="font-bold text-on-surface flex items-center gap-2">
              Kho lưu trữ Tri thức chung
            </h3>
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
                        Chưa Ingest — chỉ trên Cloudinary ({notIngestedDocs.length})
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
            ) : null /* pendingUploads đang hiển thị ở trên, không cần thêm gì */}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
