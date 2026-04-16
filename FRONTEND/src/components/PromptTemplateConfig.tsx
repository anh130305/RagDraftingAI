import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TerminalSquare, Save, RotateCcw, Variable,
  MessageSquare, Plus, X, Star, Trash2, Loader2,
  Sparkles, ShieldCheck, Eye, EyeOff,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import * as api from '../lib/api';
import { useToast } from '../lib/ToastContext';

interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  query: string;
  extra_instructions: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  mode: 'qa' | 'generate';
}

export default function PromptTemplateConfig() {
  const { showToast } = useToast();

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [promptContent, setPromptContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // States for new template modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
  });

  const [newTpl, setNewTpl] = useState({ label: '', desc: '', content: '', mode: 'qa' as 'qa' | 'generate' });

  // ── Fetch templates from API ──────────────────────────────
  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const res = await api.getPromptTemplates();
      setTemplates(res.items);

      // Tự động chọn mẫu đầu tiên nếu có
      const firstTpl = res.items[0];
      if (firstTpl && !selectedId) {
        setSelectedId(firstTpl.id);
        const combined = firstTpl.extra_instructions
          ? `${firstTpl.query}\n\n${firstTpl.extra_instructions}`
          : firstTpl.query;
        setPromptContent(combined);
      }
    } catch (err: any) {
      showToast('Không thể tải danh sách mẫu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSelectTemplate = (tpl: PromptTemplate) => {
    setSelectedId(tpl.id);
    const combined = tpl.extra_instructions
      ? `${tpl.query}\n\n${tpl.extra_instructions}`
      : tpl.query;
    setPromptContent(combined);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    try {
      setIsSaving(true);
      const current = templates.find(t => t.id === selectedId);
      
      // Gửi toàn bộ nội dung, Backend sẽ tự động phân tách thông minh
      await api.updatePromptTemplate(selectedId, {
        content: promptContent,
        mode: current?.mode
      });
      showToast('Đã lưu cấu hình thành công!', 'success');
      fetchTemplates();
    } catch (err: any) {
      showToast('Lưu thất bại: ' + (err.message || 'Lỗi không xác định'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const current = templates.find(t => t.id === selectedId);
    if (current) {
      const combined = current.extra_instructions
        ? `${current.query}\n\n${current.extra_instructions}`
        : current.query;
      setPromptContent(combined);
      showToast('Đã khôi phục nội dung gốc', 'info');
    }
  };

  const handleAddTemplate = async () => {
    if (!newTpl.label || !newTpl.content) {
      showToast('Vui lòng điền đủ Tên mẫu và Nội dung!', 'warning');
      return;
    }
    try {
      setIsCreating(true);
      const created = await api.createPromptTemplate({
        name: newTpl.label,
        description: newTpl.desc || undefined,
        content: newTpl.content,
        mode: newTpl.mode,
      });
      showToast(`Đã thêm mẫu "${created.name}"`, 'success');
      setShowAddModal(false);
      setNewTpl({ label: '', desc: '', content: '', mode: 'qa' });
      await fetchTemplates();
      setSelectedId(created.id);

      const combined = created.extra_instructions
        ? `${created.query}\n\n${created.extra_instructions}`
        : created.query;
      setPromptContent(combined);
    } catch (err: any) {
      showToast('Thêm mẫu thất bại: ' + (err.message || ''), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (tpl: PromptTemplate) => {
    try {
      await api.updatePromptTemplate(tpl.id, { is_active: !tpl.is_active });
      showToast(`${tpl.is_active ? 'Đã tạm ẩn' : 'Đã kích hoạt'} mẫu "${tpl.name}"`, 'success');
      await fetchTemplates();
    } catch (err: any) {
      showToast('Cập nhật trạng thái thất bại: ' + (err.message || ''), 'error');
    }
  };

  const handleDelete = async (tpl: PromptTemplate) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận xóa',
      message: `Bạn có chắc chắn muốn xóa mẫu kịch bản "${tpl.name}"? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
        try {
          await api.deletePromptTemplate(tpl.id);
          showToast(`Đã xóa mẫu "${tpl.name}"`, 'success');
          if (selectedId === tpl.id) {
            setSelectedId(null);
            setPromptContent('');
          }
          await fetchTemplates();
        } catch (err: any) {
          showToast('Xóa thất bại: ' + (err.message || ''), 'error');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleUpdateMode = (mode: 'qa' | 'generate') => {
    if (!selectedId) return;
    setTemplates(prev => prev.map(t => t.id === selectedId ? { ...t, mode } : t));
  };


  const variables = [
    { name: '{query}', desc: 'Nội dung câu hỏi người dùng.' },
    { name: '{extra-instruction}', desc: 'Thông tin bổ sung / ràng buộc.' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-on-surface-variant font-medium">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-sm">Đang đồng bộ cấu hình...</span>
      </div>
    );
  }

  const selectedTemplate = templates.find(t => t.id === selectedId);

  return (
    <div className="pb-10">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* --- Header Area --- */}
        <header className="flex justify-between items-end flex-wrap gap-8">
          <div className="space-y-2">
            <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">
              Cấu hình Lệnh Mẫu
            </h2>
            <p className="text-sm text-on-surface-variant max-w-2xl font-medium leading-relaxed opacity-80">
              Kiến tạo các kịch bản <span className="text-primary font-bold">System Prompt</span> tinh vi để dẫn dắt AI RAG phản hồi chính xác và thông thái.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleReset}
              disabled={!selectedId}
              className="px-5 py-2.5 bg-surface text-on-surface-variant font-bold rounded-xl border border-outline-variant hover:bg-surface-highest transition-all flex items-center gap-2 text-xs disabled:opacity-30 disabled:cursor-not-allowed group shadow-sm"
            >
              <RotateCcw className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform" />
              Khôi phục mặc định
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !selectedId}
              className="px-8 py-2.5 gradient-primary text-surface font-bold rounded-xl shadow-[0_8px_20px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_12px_25px_rgba(var(--primary-rgb),0.4)] hover:brightness-110 transition-all flex items-center justify-center min-w-[140px] text-xs disabled:opacity-50 disabled:shadow-none"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Lưu cấu hình
                </>
              )}
            </button>
          </div>
        </header>

        {/* --- Main Content Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Editor Area */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="glass-card border border-outline-variant/30 flex flex-col overflow-hidden rounded-[1.5rem] shadow-xl relative">
              <div className="px-6 py-4 bg-surface-low/50 backdrop-blur-md border-b border-outline-variant/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-xs text-on-surface uppercase tracking-[0.1em]">Trình soạn thảo cao cấp</h3>
                </div>

                {selectedId && (
                  <div className="flex items-center gap-4">
                    <div className="flex bg-surface-container-high p-1 rounded-xl border border-outline-variant/30">
                      <button
                        onClick={() => handleUpdateMode('qa')}
                        className={cn(
                          "px-3 py-1 text-[10px] font-bold rounded-lg transition-all",
                          selectedTemplate?.mode === 'qa'
                            ? "bg-primary text-on-primary shadow-sm"
                            : "text-on-surface-variant hover:bg-surface-highest"
                        )}
                      >
                        Hỏi đáp
                      </button>
                      <button
                        onClick={() => handleUpdateMode('generate')}
                        className={cn(
                          "px-3 py-1 text-[10px] font-bold rounded-lg transition-all",
                          selectedTemplate?.mode === 'generate'
                            ? "bg-secondary text-on-secondary shadow-sm"
                            : "text-on-surface-variant hover:bg-surface-highest"
                        )}
                      >
                        Soạn thảo
                      </button>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full border border-primary/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] text-primary font-bold">{selectedTemplate?.name}</span>
                    </div>
                  </div>
                )}
              </div>

              <textarea
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                spellCheck={false}
                disabled={!selectedId}
                className="w-full min-h-[520px] p-8 bg-transparent text-on-surface text-[15px] font-mono leading-[1.8] outline-none resize-y transition-all custom-scrollbar disabled:opacity-50"
                placeholder={selectedId ? 'Khởi tạo System Prompt tại đây...' : 'Vui lòng chọn một mẫu từ thư viện để bắt đầu...'}
              />

              <div className="px-6 py-3 bg-surface-low/30 border-t border-outline-variant/10 flex justify-between items-center text-[11px] text-on-surface-variant font-medium">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Cấu hình được bảo vệ bởi quyền Quản trị viên
                </div>
                <span className="bg-surface px-2 py-0.5 rounded-lg border border-outline-variant/30">
                  {promptContent.length.toLocaleString()} ký tự
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 flex-wrap px-2">
              <div className="flex items-center gap-2 shrink-0">
                <Variable className="w-4 h-4 text-tertiary" />
                <span className="text-xs font-bold text-on-surface uppercase tracking-widest">Biến khả dụng:</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 p-1.5 px-3 rounded-xl bg-surface-highest/40 border border-outline-variant/20 shadow-sm hover:border-tertiary/30 transition-colors group">
                    <code className="text-[13px] font-bold text-tertiary font-mono group-hover:scale-105 transition-transform">{v.name}</code>
                    <span className="text-[11px] text-on-surface-variant font-medium opacity-80">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Library Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full">
            <div className="glass-card p-6 rounded-[1.8rem] border border-outline-variant/30 h-full flex flex-col shadow-xl relative overflow-hidden group/sidebar">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover/sidebar:bg-primary/10 transition-colors duration-500" />
              
              <div className="flex items-center justify-between mb-8 relative z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-on-surface text-lg">Thư viện Mẫu</h4>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-10 h-10 rounded-2xl bg-primary text-surface hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-lg"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3 min-h-0">
                {templates.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3 opacity-60">
                    <Plus className="w-8 h-8 border-2 border-dashed border-outline-variant p-2 rounded-xl" />
                    <p className="text-xs font-bold text-on-surface-variant">Thư viện đang trống</p>
                  </div>
                ) : (
                  templates.map((tpl) => (
                    <motion.div
                      key={tpl.id}
                      whileHover={{ x: 4 }}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={cn(
                        "group p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col h-[145px]",
                        selectedId === tpl.id
                          ? "bg-primary/[0.04] border-primary shadow-sm ring-1 ring-primary/20"
                          : "bg-surface border-outline-variant/40 hover:border-primary/40 hover:bg-surface-highest/60"
                      )}
                    >
                      {selectedId === tpl.id && <div className="absolute top-0 left-0 w-1 h-full bg-primary" />}
                      
                      <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <span className="text-[8px] font-black text-primary/60 uppercase tracking-[0.15em]">Kịch bản</span>
                          <h5 className={cn("font-bold text-[13px] truncate whitespace-nowrap", selectedId === tpl.id ? "text-primary" : "text-on-surface")}>{tpl.name}</h5>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mt-1">
                          <span className={cn(
                            "px-1.5 py-0.5 text-[8px] font-black uppercase rounded-md border tracking-tighter",
                            tpl.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-surface-highest text-on-surface-variant border-outline-variant"
                          )}>
                            {tpl.is_active ? 'Active' : 'Draft'}
                          </span>
                          <span className={cn(
                            "px-1.5 py-0.5 text-[8px] font-black uppercase rounded-md border tracking-tighter",
                            tpl.mode === 'generate' ? "bg-secondary/10 text-secondary border-secondary/20" : "bg-primary/10 text-primary border-primary/20"
                          )}>
                            {tpl.mode === 'generate' ? 'Drafting' : 'Q&A'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 flex-1 min-h-0">
                        <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-[0.15em]">Mục đích</span>
                        <p className="text-[10px] text-on-surface-variant leading-relaxed line-clamp-2 font-medium opacity-80">{tpl.description || 'Chưa cung cấp mô tả...'}</p>
                      </div>

                      <div className="flex items-center justify-end pt-2 border-t border-outline-variant/10 mt-auto">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleActive(tpl); }}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-on-surface-variant/60 hover:text-primary transition-all"
                            title={tpl.is_active ? 'Tạm ẩn' : 'Kích hoạt'}
                          >
                            {tpl.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(tpl); }}
                            className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant/60 hover:text-error transition-all"
                            title="Xóa mẫu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Add Template Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
              onClick={() => !isCreating && setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-xl bg-surface/95 border border-outline-variant/30 rounded-[2.5rem] shadow-2xl p-8 flex flex-col gap-6"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-on-surface tracking-tight">Kịch bản Mới</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreating}
                  className="p-2 rounded-2xl text-on-surface-variant hover:bg-surface-highest transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-1">Tên kịch bản</label>
                  <input
                    type="text"
                    placeholder="VD: Trợ lý Chuyên gia Tài chính"
                    value={newTpl.label}
                    onChange={(e) => setNewTpl(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full bg-surface-low border border-outline-variant/40 rounded-2xl px-5 py-3 text-sm focus:border-primary outline-none transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-1">Mô tả mục đích</label>
                  <input
                    type="text"
                    placeholder="Dùng để phân tích số liệu và..."
                    value={newTpl.desc}
                    onChange={(e) => setNewTpl(prev => ({ ...prev, desc: e.target.value }))}
                    className="w-full bg-surface-low border border-outline-variant/40 rounded-2xl px-5 py-3 text-sm focus:border-primary outline-none transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-1">Chế độ áp dụng</label>
                  <div className="flex bg-surface-low border border-outline-variant/40 rounded-2xl p-1 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setNewTpl(prev => ({ ...prev, mode: 'qa' }))}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                        newTpl.mode === 'qa' ? "bg-primary text-on-primary shadow-md" : "text-on-surface-variant hover:bg-surface-highest"
                      )}
                    >
                      Hỏi đáp Pháp luật
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTpl(prev => ({ ...prev, mode: 'generate' }))}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                        newTpl.mode === 'generate' ? "bg-secondary text-on-secondary shadow-md" : "text-on-surface-variant hover:bg-surface-highest"
                      )}
                    >
                      Soạn thảo Văn bản
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-1">Cấu hình Prompt</label>
                  <textarea
                    placeholder="Nhập nội dung lệnh và hướng dẫn bổ sung (nếu có)..."
                    value={newTpl.content}
                    onChange={(e) => setNewTpl(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full h-48 bg-surface-low border border-outline-variant/40 rounded-2xl px-5 py-4 text-sm font-mono focus:border-primary outline-none transition-all shadow-inner custom-scrollbar"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 shrink-0">
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreating}
                  className="flex-1 py-4 text-xs font-bold bg-surface border border-outline-variant rounded-[1.2rem] hover:bg-surface-highest transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleAddTemplate}
                  disabled={!newTpl.label || !newTpl.content || isCreating}
                  className="flex-1 py-4 text-xs font-bold gradient-primary text-surface rounded-[1.2rem] shadow-lg flex items-center justify-center gap-2"
                >
                  {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <Plus className="w-5 h-5" />
                      Tạo kịch bản
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-surface rounded-[2rem] border border-outline-variant/30 shadow-2xl p-6 overflow-hidden"
            >
              <div className="relative space-y-4">
                <div className="flex items-center gap-3 text-error">
                  <div className="w-10 h-10 rounded-2xl bg-error/10 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">{confirmModal.title}</h3>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed">{confirmModal.message}</p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 py-3 text-xs font-bold bg-surface-highest text-on-surface rounded-2xl hover:brightness-110 transition-all"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    className="flex-1 py-3 text-xs font-bold bg-error text-surface rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
                  >
                    Xác nhận xóa
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
