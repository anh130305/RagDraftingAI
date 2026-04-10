import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Save, Building, Clock, ShieldCheck, Mail, Camera, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import * as api from '../lib/api';
import { useToast } from '../lib/ToastContext';

const VALID_DEPARTMENTS = ["BackEnd", "FrontEnd", "AI Engineer", "FullStack", "DevOps"];

export default function Settings() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [department, setDepartment] = useState('');

  // Global Toast
  const { showToast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.getMe();
      setProfile(res);
      setDepartment(res.department || '');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi lấy thông tin hồ sơ', 'error');
    } finally {
      setLoading(false);
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
                  {new Date(profile.created_at).toLocaleDateString('vi-VN')}
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

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mt-8">
                <h4 className="text-xs font-bold text-primary mb-1">Cấu hình Phòng ban</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Thiết lập phòng ban sẽ giúp hệ thống định tuyến các truy vấn RAG chính xác hơn theo lĩnh vực chuyên môn (Backend/DevOps/AI). Bạn có thể thay đổi bất cứ lúc nào.
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-outline-variant/30 flex justify-end">
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
        </div>
      </div>

    </motion.div>
  );
}
