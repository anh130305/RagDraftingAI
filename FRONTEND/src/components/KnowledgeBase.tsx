import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, Database, FileText, X, Trash2,
  CheckCircle2, AlertCircle, Clock, Search,
  HardDrive, Layers, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import * as api from '../lib/api';
import { useToast } from '../lib/ToastContext';
import type { DocumentResponse } from '../lib/api';

export default function KnowledgeBase() {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await api.listDocuments(0, 100);
      setDocuments(data.items);
    } catch (err: any) {
      console.error("Lỗi khi tải danh sách tài liệu", err);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    // Poll every 5 seconds to update document processing status
    timerRef.current = setInterval(fetchDocuments, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchDocuments]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    // Simulate progress for UI UX
    const progressInterval = setInterval(() => {
      setUploadProgress(p => (p >= 90 ? 90 : p + 10));
    }, 200);

    try {
      await api.uploadDocument(file);
      await fetchDocuments();
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải tệp lên');
    } finally {
      clearInterval(progressInterval);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa tài liệu này không? Việc này sẽ xóa toàn bộ vector liên quan.')) return;
    try {
      await api.deleteDocument(id);
      await fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xóa tài liệu', 'error');
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const filteredDocs = documents.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: documents.length,
    ready: documents.filter(d => d.status === 'ready').length,
    processing: documents.filter(d => ['pending', 'processing'].includes(d.status)).length,
    chunks: documents.reduce((acc, curr) => acc + (curr.chunk_count || 0), 0)
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <header className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface mb-1">Cơ sở tri thức (RAG)</h2>
          <p className="text-xs text-on-surface-variant max-w-2xl font-medium">
            Quản lý tài liệu tri thức nội bộ. Các tài liệu tải lên sẽ được tự động trích xuất, phân mảnh và mã hóa vector để phục vụ cho hệ thống AI phản hồi.
          </p>
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
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tổng số Vector (Chunks)</p>
            <p className="text-xl font-extrabold font-headline">{stats.chunks.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-outline-variant/30 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Đã sẵn sàng</p>
            <p className="text-xl font-extrabold font-headline">{stats.ready}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-outline-variant/30 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Đang xử lý</p>
            <p className="text-xl font-extrabold font-headline">{stats.processing}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Upload Area */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className={cn(
              "glass-card p-8 rounded-xl border-dashed border-2 transition-all flex flex-col items-center justify-center text-center min-h-[300px]",
              isUploading ? "border-primary/50 bg-primary/5" : "border-outline-variant hover:border-primary/40 hover:bg-surface-highest/50 cursor-pointer"
            )}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.txt,.docx,.md"
            />

            <AnimatePresence mode="wait">
              {isUploading ? (
                <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full">
                  <div className="w-16 h-16 rounded-full border-4 border-surface-highest border-t-primary animate-spin mb-4" />
                  <h3 className="text-lg font-bold text-primary mb-2">Đang tải lên...</h3>
                  <div className="w-full max-w-[200px] h-2 bg-surface-highest rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-surface-highest rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-on-surface mb-2">Kéo thả Tài liệu</h3>
                  <p className="text-xs text-on-surface-variant mb-6 max-w-[200px] leading-relaxed">
                    Hỗ trợ PDF, DOCX, TXT. Hệ thống sẽ tự động trích xuất và lưu trữ.
                  </p>
                  <button className="px-6 py-2.5 bg-surface-highest hover:bg-primary hover:text-on-primary border border-outline-variant hover:border-primary text-on-surface rounded-full text-xs font-bold transition-all shadow-sm">
                    Chọn Tệp
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 bg-error/10 border border-error/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                <p className="text-xs text-error font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass-card p-5 rounded-xl border border-outline-variant/30 text-xs text-on-surface-variant leading-relaxed">
            <h4 className="font-bold text-on-surface mb-2 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-secondary" /> Hướng dẫn
            </h4>
            <ul className="list-disc pl-4 space-y-1">
              <li>Mỗi tệp không nên vượt quá 50MB.</li>
              <li>Tài liệu sẽ được chunking (phân đoạn) tự động.</li>
              <li>Chỉ các tài liệu ở trạng thái <strong>Sẵn sàng</strong> mới được AI sử dụng để trả lời câu hỏi.</li>
            </ul>
          </div>
        </div>

        {/* Right: Document List */}
        <div className="lg:col-span-8 flex flex-col h-[800px] bg-surface rounded-xl border border-outline-variant overflow-hidden">
          <div className="p-4 border-b border-outline-variant/50 flex flex-wrap items-center justify-between gap-4 bg-surface-low">
            <h3 className="font-bold text-on-surface flex items-center gap-2">
              Danh sách tài liệu
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs w-64 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {filteredDocs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant/50 p-6 text-center">
                <FileText className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Chưa có tài liệu nào</p>
                <p className="text-xs">Tải lên tài liệu ở ô bên trái để bắt đầu xây dựng Cơ sở tri thức.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-high border border-transparent hover:border-outline-variant/30 transition-all group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-lg bg-surface-highest flex items-center justify-center shrink-0">
                        <FileText className={cn("w-5 h-5", doc.title.endsWith('.pdf') ? "text-red-400" : "text-blue-400")} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-on-surface truncate" title={doc.title}>{doc.title}</h4>
                        <div className="flex items-center gap-3 text-[10px] text-on-surface-variant mt-0.5">
                          <span>{formatSize(doc.file_size)}</span>
                          <span>•</span>
                          <span>{new Date(doc.created_at).toLocaleDateString('vi-VN')}</span>
                          <span>•</span>
                          <span>{doc.chunk_count} chunks</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 pl-4">
                      {/* Status badge */}
                      <span className={cn(
                        "px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                        doc.status === 'ready' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                          doc.status === 'failed' ? "bg-error/10 text-error border-error/20" :
                            "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                      )}>
                        {doc.status === 'ready' ? <CheckCircle2 className="w-3 h-3" /> :
                          doc.status === 'failed' ? <AlertCircle className="w-3 h-3" /> :
                            <Clock className="w-3 h-3 animate-pulse" />}
                        {doc.status === 'ready' ? 'Sẵn sàng' :
                          doc.status === 'failed' ? 'Lỗi' :
                            'Đang xử lý'}
                      </span>

                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Xóa tài liệu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
