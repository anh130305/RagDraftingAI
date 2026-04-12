import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TerminalSquare, Save, RotateCcw, Variable,
  MessageSquare, Plus, X, Star, Trash2, Loader2,
  Sparkles, ShieldCheck, Eye, EyeOff
} from 'lucide-react';
import { cn } from '../lib/utils';
import * as api from '../lib/api';
import { useToast } from '../lib/ToastContext';

interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
  const [newTpl, setNewTpl] = useState({ label: '', desc: '', content: '' });

  // ── Fetch templates from API ──────────────────────────────
  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const res = await api.getPromptTemplates();
      setTemplates(res.items);

      // Auto-select the default one, or the first one
      const defaultTpl = res.items.find(t => t.is_default) || res.items[0];
      if (defaultTpl) {
        setSelectedId(defaultTpl.id);
        setPromptContent(defaultTpl.content);
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
    setPromptContent(tpl.content);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    try {
      setIsSaving(true);
      await api.updatePromptTemplate(selectedId, { content: promptContent });
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
      setPromptContent(current.content);
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
      });
      showToast(`Đã thêm mẫu "${created.name}"`, 'success');
      setShowAddModal(false);
      setNewTpl({ label: '', desc: '', content: '' });
      await fetchTemplates();
      setSelectedId(created.id);
      setPromptContent(created.content);
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
    if (!window.confirm(`Bạn có chắc muốn xóa mẫu "${tpl.name}"?`)) return;
    try {
      await api.deletePromptTemplate(tpl.id);
      showToast(`Đã xóa mẫu "${tpl.name}"`, 'success');
      if (tpl.id === selectedId) {
        setSelectedId(null);
        setPromptContent('');
      }
      await fetchTemplates();
    } catch (err: any) {
      showToast('Xóa thất bại: ' + (err.message || ''), 'error');
    }
  };

  const handleSetDefault = async (tpl: PromptTemplate) => {
    try {
      await api.setDefaultPromptTemplate(tpl.id);
      showToast(`"${tpl.name}" đã được đặt làm mặc định`, 'success');
      await fetchTemplates();
    } catch (err: any) {
      showToast('Đặt mặc định thất bại: ' + (err.message || ''), 'error');
    }
  };

  const variables = [
    { name: '{context}', desc: 'Dữ liệu tri thức RAG.' },
    { name: '{query}', desc: 'Nội dung câu hỏi người dùng.' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-on-surface-variant font-medium">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-sm">Đang đồng bộ cấu hình...</span>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* --- Premium Header Area --- */}
        <header className="flex justify-between items-end flex-wrap gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">
                Cấu hình Lệnh Mẫu
              </h2>
            </div>
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
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Lưu cấu hình
                </>
              )}
            </button>
          </div>
        </header>

        {/* --- Layout: 8:4 Grid with Glassmorphism --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* LEFT COLUMN: Editor (8) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="glass-card border border-outline-variant/30 flex flex-col overflow-hidden rounded-[1.5rem] shadow-xl relative">
              {/* Card Header */}
              <div className="px-6 py-4 bg-surface-low/50 backdrop-blur-md border-b border-outline-variant/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-xs text-on-surface uppercase tracking-[0.1em]">Trình soạn thảo cao cấp</h3>
                </div>
                {selectedId && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full border border-primary/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] text-primary font-bold">
                      {templates.find(t => t.id === selectedId)?.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Textarea Area */}
              <div className="relative">
                <textarea
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  spellCheck={false}
                  disabled={!selectedId}
                  className="w-full min-h-[520px] p-8 bg-transparent text-on-surface text-[15px] font-mono leading-[1.8] outline-none resize-y selection:bg-primary/20 transition-all custom-scrollbar disabled:opacity-50"
                  placeholder={selectedId ? 'Khởi tạo System Prompt tại đây...' : 'Vui lòng chọn một mẫu từ thư viện để bắt đầu...'}
                />
                {!selectedId && (
                  <div className="absolute inset-0 bg-surface/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                    <p className="text-sm font-bold text-on-surface-variant opacity-60 italic">Chế độ chờ...</p>
                  </div>
                )}
              </div>

              {/* Bottom Info Bar */}
              <div className="px-6 py-3 bg-surface-low/30 border-t border-outline-variant/10 flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Cấu hình được bảo vệ bởi quyền Quản trị viên
                </div>
                <span className="text-[11px] font-bold text-on-surface-variant bg-surface px-2 py-0.5 rounded-lg border border-outline-variant/30">
                  {promptContent.length.toLocaleString()} ký tự
                </span>
              </div>
            </div>

            {/* Premium Variables Guide */}
            <div className="flex items-center gap-6 flex-wrap px-2">
              <div className="flex items-center gap-2 shrink-0">
                <Variable className="w-4 h-4 text-tertiary" />
                <span className="text-xs font-bold text-on-surface uppercase tracking-widest">Biến khả dụng:</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 p-1.5 px-3 rounded-xl bg-surface-highest/40 border border-outline-variant/20 shadow-sm hover:border-tertiary/30 transition-colors group">
                    <code className="text-[13px] font-bold text-tertiary font-mono group-hover:scale-105 transition-transform">
                      {v.name}
                    </code>
                    <span className="text-[11px] text-on-surface-variant font-medium opacity-80">
                      {v.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Library Sidebar (4) */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full">
            <div className="glass-card p-6 rounded-[1.8rem] border border-outline-variant/30 h-full flex flex-col shadow-xl relative overflow-hidden group/sidebar">
              {/* Background Accent */}
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
                  className="w-10 h-10 rounded-2xl bg-primary text-surface hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-[0_5px_15px_rgba(var(--primary-rgb),0.3)]"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              {/* List Container */}
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
                      className={cn(
                        "group p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col h-[145px]",
                        selectedId === tpl.id
                          ? "bg-primary/[0.04] border-primary shadow-[0_8px_20px_rgba(var(--primary-rgb),0.1)] ring-1 ring-primary/20"
                          : "bg-surface border-outline-variant/40 hover:border-primary/40 hover:bg-surface-highest/60"
                      )}
                      onClick={() => handleSelectTemplate(tpl)}
                    >
                      {/* Active indicator bar */}
                      {selectedId === tpl.id && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                      )}

                      <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <span className="text-[8px] font-black text-primary/60 uppercase tracking-[0.15em]">Kịch bản</span>
                          <h5 className={cn(
                            "font-bold text-[13px] truncate transition-colors",
                            selectedId === tpl.id ? "text-primary" : "text-on-surface"
                          )}>
                            {tpl.name}
                          </h5>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mt-1">
                          {tpl.is_default && (
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          )}
                          <span className={cn(
                            "px-1.5 py-0.5 text-[8px] font-black uppercase rounded-md border tracking-tighter",
                            tpl.is_active
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-surface-highest text-on-surface-variant border-outline-variant"
                          )}>
                            {tpl.is_active ? 'Active' : 'Draft'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 flex-1 min-h-0">
                        <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-[0.15em]">Mục đích</span>
                        <p className="text-[10px] text-on-surface-variant leading-relaxed line-clamp-2 font-medium opacity-80">
                          {tpl.description || 'Chưa cung cấp mô tả...'}
                        </p>
                      </div>

                      {/* Action buttons (always visible but subtle, highlight on hover) */}
                      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10 mt-auto">
                        <div className="flex gap-2">
                          {tpl.is_active && !tpl.is_default && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSetDefault(tpl); }}
                              className="text-[9px] font-bold text-amber-600 hover:text-amber-700 transition-colors"
                            >
                              Mặc định
                            </button>
                          )}
                        </div>
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

              <div className="mt-8 pt-6 border-t border-outline-variant/20 relative z-10 italic">
                <p className="text-[10px] text-on-surface-variant leading-relaxed opacity-70">
                  * Hệ thống sẽ luôn ưu tiên kịch bản <strong>Mặc định</strong> nếu người dùng không chọn kịch bản cụ thể.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* --- PREMIUM ADD MODAL (Glassmorphism) --- */}
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
                    className="w-full bg-surface-low border border-outline-variant/40 rounded-2xl px-5 py-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-1">Mô tả mục đích</label>
                  <input
                    type="text"
                    placeholder="Dùng để phân tích số liệu và..."
                    value={newTpl.desc}
                    onChange={(e) => setNewTpl(prev => ({ ...prev, desc: e.target.value }))}
                    className="w-full bg-surface-low border border-outline-variant/40 rounded-2xl px-5 py-3 text-sm focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Cấu hình Prompt</label>
                    <span className="text-[10px] font-bold text-tertiary bg-tertiary/10 px-2 rounded-full border border-tertiary/10">SỬ DỤNG {`{context}`} & {`{query}`}</span>
                  </div>
                  <textarea
                    placeholder="Bạn là một chuyên gia về..."
                    value={newTpl.content}
                    onChange={(e) => setNewTpl(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full h-48 bg-surface-low border border-outline-variant/40 rounded-2xl px-5 py-4 text-sm font-mono focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-inner custom-scrollbar"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 shrink-0">
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreating}
                  className="flex-1 py-4 text-xs font-bold bg-surface border border-outline-variant rounded-[1.2rem] hover:bg-surface-highest hover:shadow-md transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleAddTemplate}
                  disabled={!newTpl.label || !newTpl.content || isCreating}
                  className="flex-1 py-4 text-xs font-bold gradient-primary text-surface rounded-[1.2rem] shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
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
    </div>
  );
}
