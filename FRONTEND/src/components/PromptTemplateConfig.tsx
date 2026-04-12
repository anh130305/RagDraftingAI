import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TerminalSquare, Save, RotateCcw, Variable,
  MessageSquare, Plus, X, Star, Trash2, Loader2
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

  // ── Select a template ─────────────────────────────────────
  const handleSelectTemplate = (tpl: PromptTemplate) => {
    setSelectedId(tpl.id);
    setPromptContent(tpl.content);
  };

  // ── Save content of current selected template ─────────────
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

  // ── Reset to original content ─────────────────────────────
  const handleReset = () => {
    const current = templates.find(t => t.id === selectedId);
    if (current) {
      setPromptContent(current.content);
      showToast('Đã khôi phục nội dung gốc', 'info');
    }
  };

  // ── Create new template ───────────────────────────────────
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
      // Select the newly created one
      setSelectedId(created.id);
      setPromptContent(created.content);
    } catch (err: any) {
      showToast('Thêm mẫu thất bại: ' + (err.message || ''), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Toggle Active/Inactive status ──────────────────────────
  const handleToggleActive = async (tpl: PromptTemplate) => {
    try {
      await api.updatePromptTemplate(tpl.id, { is_active: !tpl.is_active });
      showToast(`${tpl.is_active ? 'Đã tạm ẩn' : 'Đã kích hoạt'} mẫu "${tpl.name}"`, 'success');
      await fetchTemplates();
    } catch (err: any) {
      showToast('Cập nhật trạng thái thất bại: ' + (err.message || ''), 'error');
    }
  };

  // ── Delete template (soft or hard depending on intent) ─────
  // Currently service handles delete as soft-delete (is_active=False).
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

  // ── Set default template ──────────────────────────────────
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
    { name: '{context}', desc: 'Nội dung truy xuất được từ Cơ sở tri thức RAG.' },
    { name: '{query}', desc: 'Câu hỏi hiện tại của người dùng.' }
  ];

  // ── Loading state ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-on-surface-variant">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Đang tải mẫu prompt...</span>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 relative"
      >
        <header className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface mb-1">
              Cấu hình Lệnh Mẫu
            </h2>
            <p className="text-xs text-on-surface-variant max-w-2xl font-medium">
              Tùy chỉnh Prompt hệ thống (System Prompt) điều khiển cách AI RAG phân tích ngữ cảnh và trả lời người dùng.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={!selectedId}
              className="px-4 py-2 bg-surface text-on-surface-variant font-bold rounded-xl border border-outline-variant hover:bg-surface-highest transition-colors flex items-center gap-2 text-xs disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Khôi phục mặc định
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || !selectedId}
              className="px-6 py-2 gradient-primary text-surface font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center min-w-[120px] text-xs disabled:opacity-70"
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Editor + Horizontal Variables */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="glass-card border border-outline-variant/30 flex flex-col overflow-hidden px-1 pt-1 pb-1 rounded-[1.25rem]">
              <div className="px-5 py-4 bg-surface-low border-b border-outline-variant/30 flex items-center gap-3 rounded-t-xl">
                <TerminalSquare className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-sm text-on-surface">Editor (System Prompt)</h3>
                {selectedId && (
                  <span className="ml-auto text-[10px] text-on-surface-variant font-medium bg-surface px-2 py-1 rounded-lg border border-outline-variant/30">
                    {templates.find(t => t.id === selectedId)?.name}
                  </span>
                )}
              </div>
              <div className="p-1 flex-1 relative min-h-[460px]">
                <textarea
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  spellCheck={false}
                  disabled={!selectedId}
                  className="w-full h-full min-h-[460px] p-5 bg-surface text-on-surface text-sm font-mono leading-relaxed resize-y outline-none focus:ring-2 focus:ring-primary/20 transition-all rounded-b-xl border-none custom-scrollbar disabled:opacity-50"
                  placeholder={selectedId ? 'Nhập system prompt ở đây...' : 'Chọn một mẫu từ thư viện bên phải...'}
                />
              </div>
            </div>

            {/* Horizontal Variables Guide */}
            <div className="glass-card p-3 px-4 rounded-xl border border-outline-variant/30 flex flex-wrap lg:flex-nowrap items-center gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <Variable className="w-4 h-4 text-tertiary" />
                <h4 className="font-bold text-on-surface text-xs">Biến hệ thống:</h4>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-tertiary/10 text-tertiary font-mono text-[12px] font-bold rounded border border-tertiary/20 shrink-0">
                      {v.name}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-medium">
                      {v.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Library Collection */}
          <div className="lg:col-span-4 h-full">
            <div className="glass-card p-6 rounded-2xl border border-outline-variant/30 h-full flex flex-col">
              <div className="flex items-center justify-between mb-5 shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-secondary" />
                  <h4 className="font-bold text-on-surface">Thư viện Mẫu</h4>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-8 h-8 rounded border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary transition-colors flex items-center justify-center font-bold"
                  title="Thêm Mẫu Mới"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-on-surface-variant mb-4 font-medium leading-relaxed shrink-0 italic">
                Lưu ý: Chỉ những mẫu ở trạng thái <strong>"Đang hoạt động"</strong> mới hiển thị cho người dùng.
              </p>

              {templates.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center text-on-surface-variant">
                  <p className="text-sm">Chưa có mẫu nào. Hãy thêm mẫu mới!</p>
                </div>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden",
                        selectedId === tpl.id
                          ? "bg-primary/5 border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]"
                          : "bg-surface border-outline-variant hover:border-primary/50 hover:bg-surface-highest"
                      )}
                    >
                      {selectedId === tpl.id && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                      )}

                      {/* Clickable area */}
                      <button
                        className="w-full text-left"
                        onClick={() => handleSelectTemplate(tpl)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className={cn(
                            "font-bold text-sm transition-colors flex-1",
                            selectedId === tpl.id ? "text-primary" : "text-on-surface"
                          )}>
                            {tpl.name}
                          </h5>
                          {tpl.is_default && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase rounded border border-amber-500/20 shrink-0">
                              Mặc định
                            </span>
                          )}
                          {!tpl.is_active && (
                            <span className="px-1.5 py-0.5 bg-surface-highest text-on-surface-variant text-[9px] font-bold uppercase rounded border border-outline-variant shrink-0">
                              Bản nháp
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-on-surface-variant leading-relaxed">
                          {tpl.description || 'Không có mô tả'}
                        </p>
                      </button>

                      {/* Actions (visible on hover) */}
                      <div className="flex gap-1 mt-2 pt-2 border-t border-outline-variant/20">
                        {tpl.is_active && !tpl.is_default && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSetDefault(tpl); }}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-amber-600 bg-amber-500/5 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Đặt làm mặc định"
                          >
                            <Star className="w-3 h-3" />
                            Mặc định
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(tpl); }}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg transition-colors",
                            tpl.is_active
                              ? "text-on-surface-variant bg-surface hover:bg-surface-highest"
                              : "text-green-600 bg-green-500/5 hover:bg-green-500/10"
                          )}
                        >
                          {tpl.is_active ? 'Tạm ẩn' : 'Kích hoạt lại'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(tpl); }}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-error bg-error/5 hover:bg-error/10 rounded-lg transition-colors ml-auto"
                          title="Xóa mẫu"
                        >
                          <Trash2 className="w-3 h-3" />
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

      {/* Add Template Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isCreating && setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl p-6 flex flex-col mt-10 max-h-[90vh] overflow-hidden"
            >
              <div className="flex justify-between items-center mb-5 shrink-0">
                <h3 className="text-xl font-bold font-headline text-on-surface">Thêm Mẫu Prompt Mới</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreating}
                  className="p-2 -mr-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-colors disabled:opacity-40"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 pb-2">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Tên mẫu</label>
                  <input
                    type="text"
                    value={newTpl.label}
                    onChange={(e) => setNewTpl(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="VD: Trợ lý Dịch thuật"
                    className="w-full bg-surface-low border border-outline-variant/50 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Mô tả ngắn</label>
                  <input
                    type="text"
                    value={newTpl.desc}
                    onChange={(e) => setNewTpl(prev => ({ ...prev, desc: e.target.value }))}
                    placeholder="VD: Dịch văn bản kỹ thuật sang tiếng Việt"
                    className="w-full bg-surface-low border border-outline-variant/50 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 flex justify-between">
                    <span>Nội dung Prompt</span>
                    <span className="text-[10px] font-normal text-tertiary normal-case">Hỗ trợ biến &#123;context&#125;, &#123;query&#125;</span>
                  </label>
                  <textarea
                    value={newTpl.content}
                    onChange={(e) => setNewTpl(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Bạn là một..."
                    className="w-full h-48 bg-surface-low border border-outline-variant/50 rounded-xl px-4 py-3 text-sm text-on-surface font-mono resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all custom-scrollbar"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 shrink-0 pt-4 border-t border-outline-variant/20">
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreating}
                  className="flex-1 py-2.5 bg-surface text-on-surface font-bold rounded-xl border border-outline-variant hover:bg-surface-highest transition-colors text-sm disabled:opacity-40"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleAddTemplate}
                  disabled={!newTpl.label || !newTpl.content || isCreating}
                  className="flex-1 py-2.5 gradient-primary text-surface font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Thêm vào thư viện'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
