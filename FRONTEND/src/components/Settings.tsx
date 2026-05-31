import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Save, Building, Clock, ShieldCheck, Mail, Camera, AlertCircle, Key } from 'lucide-react';
import { cn, parseUTC } from '../lib/utils';
import * as api from '../lib/api';
import { useToast } from '../lib/ToastContext';

const VALID_DEPARTMENTS = ["BackEnd", "FrontEnd", "AI Engineer", "FullStack", "DevOps"];
const DEFAULT_MAX_TOKENS = 8192;
const MIN_LLM_TOKENS = 1;
const MAX_LLM_TOKENS = 32768;
const TOKEN_OPTIONS = [512, 1024, 2048, 4096, 8192, 16384];

function isAdminUser(user: any) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

export default function Settings() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [department, setDepartment] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [llmConfig, setLlmConfig] = useState<api.LLMRuntimeConfig | null>(null);
  const [maxTokens, setMaxTokens] = useState(String(DEFAULT_MAX_TOKENS));

  // Global Toast
  const { showToast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setConfigLoading(false);
      const res = await api.getMe();
      setProfile(res);
      setDepartment(res.department || '');
      setLoading(false);

      if (isAdminUser(res)) {
        try {
          setConfigLoading(true);
          const configRes = await api.getLLMRuntimeConfig();
          setLlmConfig(configRes.config);
          setMaxTokens(String(configRes.config.max_tokens));
        } catch (err: any) {
          showToast(err.message || 'Không thể tải cấu hình LLM runtime', 'warning');
        } finally {
          setConfigLoading(false);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi lấy thông tin hồ sơ', 'error');
      setLoading(false);
      setConfigLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await api.updateMe({ department });
      setProfile(res);
      showToast('Cập nhật hồ sơ thành công!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Có lỗi xảy ra khi lưu thay đổi', 'error');
      if (profile) setDepartment(profile.department || '');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLLMConfig = async () => {
    const nextMaxTokens = Number(maxTokens);
    if (!Number.isInteger(nextMaxTokens) || nextMaxTokens < MIN_LLM_TOKENS || nextMaxTokens > MAX_LLM_TOKENS) {
      showToast(`Số lượng token tối đa phải là số nguyên trong khoảng ${MIN_LLM_TOKENS}..${MAX_LLM_TOKENS}.`, 'warning');
      return;
    }

    try {
      setSavingConfig(true);
      const res = await api.updateLLMRuntimeConfig({ max_tokens: nextMaxTokens });
      setLlmConfig(res.config);
      setMaxTokens(String(res.config.max_tokens));
      showToast('Cập nhật cấu hình LLM runtime thành công!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Có lỗi xảy ra khi lưu cấu hình LLM', 'error');
      if (llmConfig) setMaxTokens(String(llmConfig.max_tokens));
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 opacity-50">
        <User className="w-12 h-12 mb-4 animate-pulse text-on-surface-variant" />
        <p className="text-sm font-bold text-on-surface-variant tracking-widest uppercase mb-2">Đang tải hồ sơ...</p>
        <div className="w-48 h-1 bg-surface-high rounded-full overflow-hidden">
          <div className="w-1/2 h-full bg-primary/50 animate-pulse rounded-full" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isAdmin = isAdminUser(profile);
  const parsedMaxTokens = Number(maxTokens);
  const isMaxTokensValid =
    maxTokens.trim() !== '' &&
    Number.isInteger(parsedMaxTokens) &&
    parsedMaxTokens >= MIN_LLM_TOKENS &&
    parsedMaxTokens <= MAX_LLM_TOKENS;
  const isLLMConfigUnchanged = llmConfig ? parsedMaxTokens === llmConfig.max_tokens : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface mb-1">Cài đặt Hồ sơ</h2>
          <p className="text-xs text-on-surface-variant max-w-2xl font-medium">Quản lý thông tin định danh, quyền hạn và phòng ban của tài khoản trên hệ thống.</p>
        </div>
      </header>

      {/* Grid Layout 4/8 to maintain width balance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left Col: Avatar & Status Summary */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-8 rounded-[2rem] border border-outline-variant flex flex-col items-center text-center relative overflow-hidden bg-surface/50 backdrop-blur-xl shadow-lg">

            <div className="relative group mb-6">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-surface shadow-[0_0_30px_rgba(0,0,0,0.3)] bg-surface-highest flex items-center justify-center relative z-10 transition-transform group-hover:scale-105 duration-300">
                <span className="text-5xl font-extrabold text-on-surface uppercase font-headline">
                  {profile.username.substring(0, 2)}
                </span>
                {/* Overlay for fake upload */}
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-6 h-6 text-white mb-1" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Thay đổi</span>
                </div>
              </div>
              <div className="absolute bottom-0 right-2 w-5 h-5 bg-success rounded-full border-2 border-surface z-20 shadow-[0_0_10px_var(--color-success)]" title="Đang hoạt động" />
            </div>

            <h3 className="text-2xl font-extrabold font-headline text-on-surface mb-1">{profile.username}</h3>
            <p className="text-sm font-medium text-on-surface-variant mb-6">{profile.email || 'Chưa liên kết Email'}</p>

            <div className="w-full flex justify-center gap-3">
              <span className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                {profile.role.toUpperCase()}
              </span>
            </div>

            <div className="w-full mt-6 pt-6 border-t border-outline-variant/50 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Ngày gia nhập
                </span>
                <span className="text-xs font-bold font-mono text-on-surface">
                  {parseUTC(profile.created_at).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" /> Trạng thái
                </span>
                <span className={cn("text-xs font-bold font-mono", profile.is_active ? "text-success" : "text-error")}>
                  {profile.is_active ? "Active" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Editable Settings */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-card p-8 rounded-[2rem] border border-outline-variant">
            <h3 className="text-xl font-bold font-headline text-on-surface mb-8 flex items-center gap-3">
              <User className="w-5 h-5 text-secondary" />
              Chi tiết Tải khoản
            </h3>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Username */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pl-1">
                    Tên định danh (Hệ thống)
                  </label>
                  <input
                    type="text"
                    value={profile.username}
                    disabled
                    className="w-full bg-surface-low border border-outline-variant/50 rounded-xl px-4 py-3 text-sm text-on-surface-variant opacity-60 cursor-not-allowed font-medium shadow-inner"
                  />
                  <p className="text-[10px] text-on-surface-variant/70 pl-2">Tên này được hệ thống cấp định danh duy nhất.</p>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pl-1">
                    Địa chỉ Email liên kết
                  </label>
                  <input
                    type="text"
                    value={profile.email || '—'}
                    disabled
                    className="w-full bg-surface-low border border-outline-variant/50 rounded-xl px-4 py-3 text-sm text-on-surface-variant opacity-60 cursor-not-allowed font-medium shadow-inner"
                  />
                  <p className="text-[10px] text-on-surface-variant/70 pl-2">Email dùng để nhận thông báo từ hệ thống.</p>
                </div>

                {/* Department (Editable) */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pl-1 flex items-center gap-2">
                    <Building className="w-3 h-3" />
                    Phòng ban trực thuộc
                  </label>
                  <div className="relative">
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-surface-high border border-outline-variant rounded-xl pl-4 pr-10 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium appearance-none shadow-sm"
                    >
                      <option value="">-- Chưa thiết lập --</option>
                      {VALID_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-on-surface-variant">
                      ▼
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-outline-variant/30 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving || department === (profile.department || '')}
                  className="gradient-primary text-surface font-extrabold px-8 py-3 rounded-full text-sm shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] hover:opacity-90 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Lưu Thay đổi
                </button>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="glass-card p-8 rounded-[2rem] border border-outline-variant mt-6">
              <h3 className="text-xl font-bold font-headline text-on-surface mb-6 flex items-center gap-3">
                <Key className="w-5 h-5 text-tertiary" />
                Thiết lập Token
              </h3>

              <div className="space-y-2">
                <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
                  <div className="flex-1 w-full space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pl-1">
                      SỐ LƯỢNG TOKEN TỐI ĐA
                    </label>
                    <div className="relative">
                      <select
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(e.target.value)}
                        disabled={configLoading || savingConfig}
                        className="w-full bg-surface-high border border-outline-variant rounded-xl pl-4 pr-10 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium appearance-none shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {!TOKEN_OPTIONS.includes(Number(maxTokens)) && maxTokens !== '' && (
                          <option value={maxTokens}>{maxTokens} (Giá trị hiện tại)</option>
                        )}
                        {TOKEN_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt} tokens
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-on-surface-variant">
                        ▼
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveLLMConfig}
                    disabled={
                      configLoading ||
                      savingConfig ||
                      !isMaxTokensValid ||
                      isLLMConfigUnchanged
                    }
                    className="bg-surface-highest text-on-surface font-extrabold px-8 py-3 rounded-xl text-sm shadow-sm border border-outline-variant hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shrink-0 h-[46px] w-full md:w-auto"
                  >
                    {savingConfig ? (
                      <div className="w-4 h-4 border-2 border-on-surface/30 border-t-on-surface rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Lưu Cấu hình
                  </button>
                </div>

                <p className="text-[10px] text-on-surface-variant/70 pl-2">
                  {configLoading
                    ? 'Đang tải cấu hình LLM runtime...'
                    : `Áp dụng ngay cho các request LLM tiếp theo trong RAG service.${llmConfig ? ` Temperature hiện tại: ${llmConfig.temperature}.` : ''}`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

    </motion.div>
  );
}
