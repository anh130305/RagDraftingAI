import React, { useState } from 'react';
import { CheckCheck, ChevronDown, Edit2, LogOut, Loader2, Save } from 'lucide-react';
import UserShell from './components/UserShell';
import ThemeModeRow from './components/ThemeModeRow';
import SettingsRow from './components/SettingsRow';
import { useAuth } from './lib/AuthContext';
import * as api from './lib/api';
import { useLocation } from 'react-router-dom';

function SettingsContent() {
  const { user, refreshUser, logout } = useAuth();
  const location = useLocation();
  const onboarding = location.state?.onboarding;

  const [activeTab, setActiveTab] = useState('account');
  const [department, setDepartment] = useState(user?.department || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    setUpdateStatus('idle');
    try {
      await api.updateMe({ department });
      await refreshUser();
      setUpdateStatus('success');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    } catch (err) {
      setUpdateStatus('error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-12 py-10">
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-10">
        <div className="col-span-7 space-y-12">
          <section>
            <h2 className="text-4xl font-extrabold font-headline mb-8 tracking-tight">Cài đặt</h2>
            <div className="flex flex-wrap gap-2 p-1 bg-surface-container rounded-full w-max mb-10">
              <button
                onClick={() => setActiveTab('account')}
                className={`ui-pill-tab ${activeTab === 'account' ? 'ui-pill-tab-active' : ''}`}
              >
                Tài khoản
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`ui-pill-tab ${activeTab === 'data' ? 'ui-pill-tab-active' : ''}`}
              >
                Dữ liệu &amp; Quyền riêng tư
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`ui-pill-tab ${activeTab === 'security' ? 'ui-pill-tab-active' : ''}`}
              >
                Bảo mật
              </button>
            </div>

            <div className="space-y-8">
              {activeTab === 'account' && (
                <>
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Giao diện</h3>
                    <ThemeModeRow />

                    <SettingsRow title="Hiệu ứng kính mờ (Glassmorphism)" description="Bật hiệu ứng bề mặt trong suốt">
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input defaultChecked className="sr-only peer" type="checkbox" />
                        <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                      </div>
                    </SettingsRow>
                  </div>

                  <div className="space-y-4 pt-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Không gian làm việc</h3>
                    <SettingsRow 
                      title="Phòng ban" 
                      description={onboarding ? "Vui lòng chọn phòng ban của bạn để tiếp tục" : "Đơn vị tổ chức được giao của bạn"}
                    >
                      <div className="flex flex-col gap-3 items-end">
                        <select
                          className={`block w-48 px-4 py-2 bg-surface-container-high border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 ${onboarding ? 'ring-2 ring-primary pulse' : 'border-outline-variant/20'}`}
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          disabled={isUpdating}
                        >
                          <option value="">Chọn Phòng ban</option>
                          <option value="BackEnd">BackEnd</option>
                          <option value="FrontEnd">FrontEnd</option>
                          <option value="AI Engineer">AI Engineer</option>
                          <option value="FullStack">FullStack</option>
                          <option value="DevOps">DevOps</option>
                        </select>
                        <button
                          onClick={handleUpdateProfile}
                          disabled={isUpdating || department === user?.department}
                          className="flex items-center gap-2 px-4 py-1.5 bg-primary text-on-primary-fixed rounded-full text-xs font-bold hover:scale-105 transition-all disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>}
                          {updateStatus === 'success' ? 'Đã lưu!' : 'Lưu thay đổi'}
                        </button>
                      </div>
                    </SettingsRow>
                  </div>

                  <div className="space-y-4 pt-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Cài đặt chung</h3>
                    <SettingsRow title="Ngôn ngữ" description="Ngôn ngữ hiển thị chính">
                      <div className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer px-4 py-2 border border-outline-variant/20 rounded-xl">
                        <span className="text-sm font-medium">Tiếng Việt (VN)</span>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </SettingsRow>

                    <SettingsRow title="Tự động cập nhật" description="Giữ cho các công cụ thiết kế luôn cập nhật">
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input defaultChecked className="sr-only peer" type="checkbox" />
                        <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                      </div>
                    </SettingsRow>
                  </div>
                </>
              )}

              {activeTab === 'data' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Dữ liệu &amp; Quyền riêng tư</h3>

                  <SettingsRow title="Phân tích dữ liệu & Theo dõi" description="Chia sẻ dữ liệu sử dụng ẩn danh để giúp chúng tôi cải thiện mô hình RAG AI.">
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input defaultChecked className="sr-only peer" type="checkbox" />
                      <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                    </div>
                  </SettingsRow>

                  <SettingsRow title="Xuất Dữ liệu" description="Tải xuống bản sao lưu toàn bộ dữ liệu và log dưới định dạng JSON.">
                    <button className="px-6 py-2 rounded-full bg-surface-highest text-on-surface text-sm font-bold border border-outline-variant hover:bg-surface-variant transition-all cursor-pointer">
                      Xuất JSON
                    </button>
                  </SettingsRow>

                  <div className="pt-4 mt-4 border-t border-outline-variant/20">
                    <SettingsRow title="Xoá Tài khoản" description="Xóa vĩnh viễn tài khoản và mọi dữ liệu liên quan. Không thể hoàn tác hành động này.">
                      <button className="px-6 py-2 rounded-full bg-error/10 text-error text-sm font-bold border border-error/20 hover:bg-error hover:text-on-error transition-all cursor-pointer">
                        Xoá Tài khoản
                      </button>
                    </SettingsRow>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Bảo mật</h3>

                  <SettingsRow title="Xác thực Hai yếu tố (2FA)" description="Bảo mật tài khoản thêm một lớp với ứng dụng xác thực.">
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input className="sr-only peer" type="checkbox" />
                      <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                    </div>
                  </SettingsRow>

                  <SettingsRow title="Đổi Mật khẩu" description="Cập nhật mật khẩu tài khoản để tăng cường bảo mật.">
                    <button className="px-6 py-2 rounded-full bg-surface-highest text-on-surface text-sm font-bold border border-outline-variant hover:bg-surface-variant transition-all cursor-pointer">
                      Cập nhật Mật khẩu
                    </button>
                  </SettingsRow>

                  <SettingsRow title="Các Phiên hoạt động" description="Xem và quản lý các phiên đăng nhập trên các thiết bị.">
                    <button className="px-6 py-2 rounded-full bg-surface-highest text-on-surface text-sm font-bold border border-outline-variant hover:bg-surface-variant transition-all cursor-pointer">
                      Quản lý Phiên
                    </button>
                  </SettingsRow>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="col-span-5">
          <div className="sticky top-0 space-y-6">
            <div className="glass-panel p-8 rounded-xl border border-outline-variant/10">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-primary/20 ring-offset-4 ring-offset-background">
                    <img
                      alt="User Profile"
                      className="w-full h-full object-cover"
                      data-alt="Close-up studio portrait of a man with minimalist aesthetic, soft rim lighting, dark high-fashion editorial style"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuBns5ScLKa66Ok8tDJVg5SkfTUAGzeBGqhYQI4dheTUax5wq899jKZlhigJbwcibDRmxQvTDY0DT64a465wPOgiRc8Eke8um_QZxIEbQYime9MclEumbKgiAyLIMIQXOFZjcRW26kdY5Y6moQi5msJRvJ2VYcEbdfQLY2OcFI6QzmfbJp-uIziGNVeWdadP3KWERDvYt3-XDAZS2lIr-b-2wbkmhvoLDwdPmSlPOU2qjSu07eG-XnjESqY0aUScL1hznpGQ1ABLu8hS"
                    />
                  </div>
                  <button className="absolute bottom-1 right-1 bg-primary p-2 rounded-full text-on-primary-fixed shadow-xl">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-2xl font-bold font-headline mb-1">{user?.username || 'Khách'}</h3>
                <p className="text-on-surface-variant text-sm mb-6">{user?.email || 'Chưa có email'}</p>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-secondary/10 border border-secondary/20 text-secondary rounded-full text-xs font-bold uppercase tracking-widest">
                  <CheckCheck className="w-4 h-4" />
                  {user?.role === 'admin' ? 'Admin' : 'Thành viên'}
                </div>
              </div>

              <div className="mt-10 space-y-6 border-t border-outline-variant/10 pt-8">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-on-surface-variant">Dung lượng</span>
                  <span className="text-sm font-semibold">12.4 GB / 100 GB</span>
                </div>
                <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '12.4%' }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 text-center">
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Token Đã sử dụng</p>
                    <p className="text-lg font-bold font-headline">1.2M</p>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 text-center">
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Model Đang hoạt động</p>
                    <p className="text-lg font-bold font-headline">4</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={logout}
                className="w-full mt-10 py-4 bg-surface-container-highest hover:bg-surface-variant transition-colors rounded-xl font-bold text-sm border border-outline-variant/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <UserShell activeNav="settings">
      <SettingsContent />

      <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3 glass-panel px-4 py-2 rounded-full border border-outline-variant/20 shadow-2xl">
        <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_rgba(251,180,255,0.8)]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Hệ thống Sẵn sàng</span>
      </div>
    </UserShell>
  );
}
