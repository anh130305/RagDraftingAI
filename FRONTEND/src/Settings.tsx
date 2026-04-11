import React, { useState, useRef } from 'react';
import { CheckCheck, ChevronDown, Edit2, LogOut, Loader2, Save, X, Mail, Lock, Camera } from 'lucide-react';
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

  // Modal State cho Đổi Mật khẩu
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Modal State cho Email OTP
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'email' | 'otp'>('email');
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState("https://lh3.googleusercontent.com/aida-public/AB6AXuBns5ScLKa66Ok8tDJVg5SkfTUAGzeBGqhYQI4dheTUax5wq899jKZlhigJbwcibDRmxQvTDY0DT64a465wPOgiRc8Eke8um_QZxIEbQYime9MclEumbKgiAyLIMIQXOFZjcRW26kdY5Y6moQi5msJRvJ2VYcEbdfQLY2OcFI6QzmfbJp-uIziGNVeWdadP3KWERDvYt3-XDAZS2lIr-b-2wbkmhvoLDwdPmSlPOU2qjSu07eG-XnjESqY0aUScL1hznpGQ1ABLu8hS");

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
      // NOTE: Call API api.updateMe({ avatar: ... }) here when supported by backend
    }
  };

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

  const handlePasswordSubmit = () => {
    // API logic để thay đổi mật khẩu
    setIsPasswordModalOpen(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleEmailSubmit = () => {
    if (emailStep === 'email') {
      setEmailStep('otp');
    } else {
      // API logic để xác thực OTP
      setIsEmailModalOpen(false);
      setEmailStep('email');
      setNewEmail('');
      setOtp(['', '', '', '', '', '']);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Chỉ cho phép nhập 1 ký tự số
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Tự động chuyển focus sang ô tiếp theo
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      // Khi bấm backspace và ô hiện tại đang trống thì focus về ô trước đó
      const prevRef = inputRefs.current[index - 1];
      if (prevRef) prevRef.focus();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-12 py-10 relative">
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-10">
        <div className="col-span-7 space-y-12">
          <section>
            <h2 className="text-4xl font-extrabold font-headline mb-8 tracking-tight">Cài đặt</h2>

            <div className="space-y-8">
              <>
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Giao diện</h3>
                  <ThemeModeRow />
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
                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
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
                </div>
              </>

              <div className="space-y-4 pt-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Bảo mật</h3>

                <SettingsRow title="Đổi Mật khẩu" description="Cập nhật mật khẩu tài khoản để tăng cường bảo mật.">
                  <button
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="px-6 py-2 rounded-full bg-surface-highest text-on-surface text-sm font-bold border border-outline-variant hover:bg-surface-variant transition-all cursor-pointer"
                  >
                    Đổi Mật khẩu
                  </button>
                </SettingsRow>

                <SettingsRow title="Email" description="Xác thực email để bảo vệ tài khoản của bạn.">
                  {user?.email ? (
                    <span className="px-5 py-2 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-sm font-medium">
                      {user.email}
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setIsEmailModalOpen(true);
                        setEmailStep('email');
                      }}
                      className="px-6 py-2 rounded-full bg-surface-highest text-on-surface text-sm font-bold border border-outline-variant hover:bg-surface-variant transition-all cursor-pointer"
                    >
                      Cập nhật Email
                    </button>
                  )}
                </SettingsRow>
              </div>
            </div>
          </section>
        </div>

        <div className="col-span-5">
          <div className="sticky top-0 space-y-6">
            <div className="glass-panel p-8 rounded-xl border border-outline-variant/10">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-8 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-primary/80 via-tertiary/60 to-primary/20 shadow-2xl shadow-primary/20 transition-all duration-300 group-hover:shadow-primary/40 group-hover:scale-[1.02]">
                    <div className="w-full h-full rounded-full overflow-hidden bg-surface-container border-4 border-background relative">
                      <img
                        alt="User Profile"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        src={avatarPreview}
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Camera className="w-8 h-8 text-white drop-shadow-md" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-1 right-1 bg-surface/80 backdrop-blur-md p-2.5 rounded-full text-on-surface border border-outline-variant/30 shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-surface">
                    <Camera className="w-4 h-4 text-primary" />
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                <h3 className="text-2xl font-bold font-headline mb-1">{user?.username || 'Khách'}</h3>
                <p className="text-on-surface-variant text-sm mb-6">{user?.email || 'Chưa có email'}</p>
                <div className="flex flex-wrap justify-center gap-2 mb-2">
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-secondary/10 border border-secondary/20 text-secondary rounded-full text-xs font-bold uppercase tracking-widest">
                    <CheckCheck className="w-4 h-4" />
                    {user?.role === 'admin' ? 'Admin' : 'Thành viên'}
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-4 border-t border-outline-variant/10 pt-8">
                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 flex items-center justify-between">
                  <span className="text-sm font-medium text-on-surface-variant">Phòng ban</span>
                  <span className="text-sm font-bold text-on-surface">{user?.department || 'Chưa thiết lập'}</span>
                </div>
                <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 flex items-center justify-between">
                  <span className="text-sm font-medium text-on-surface-variant">Ngày tham gia</span>
                  <span className="text-sm font-bold text-on-surface">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : 'Mới đây'}
                  </span>
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

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm px-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-outline-variant/30 p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant text-on-surface-variant transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold font-headline">Đổi Mật Khẩu</h3>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-widest">Mật khẩu cũ</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50 hover:bg-surface-container"
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-widest">Mật khẩu mới</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50 hover:bg-surface-container"
                  placeholder="Nhập mật khẩu mới"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-widest">Nhập lại mật khẩu</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50 hover:bg-surface-container"
                  placeholder="Xác nhận mật khẩu mới"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-variant transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  className="px-6 py-2 bg-primary text-on-primary-fixed rounded-xl text-sm font-bold hover:scale-105 transition-all shadow-lg shadow-primary/20"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm px-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-outline-variant/30 p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsEmailModalOpen(false)}
              className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant text-on-surface-variant transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-secondary/10 text-secondary rounded-xl">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold font-headline">
                {emailStep === 'email' ? 'Cập nhật Email' : 'Xác thực OTP'}
              </h3>
            </div>

            {emailStep === 'email' ? (
              <div className="space-y-6">
                <p className="text-sm text-on-surface-variant">
                  Vui lòng nhập địa chỉ email mới. Chúng tôi sẽ gửi mã gồm 6 chữ số để xác minh email này thuộc về bạn.
                </p>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-widest">Địa chỉ Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-on-surface-variant/50 hover:bg-surface-container"
                    placeholder="ví dụ: admin@example.com"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setIsEmailModalOpen(false)}
                    className="px-5 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-variant transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleEmailSubmit}
                    disabled={!newEmail}
                    className="px-6 py-2 bg-secondary text-on-secondary-fixed rounded-xl text-sm font-bold hover:scale-105 transition-all shadow-lg shadow-secondary/20 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    Xác thực
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-on-surface-variant">
                  Nhập mã 6 chữ số đã được gửi đến <span className="font-bold text-on-surface">{newEmail}</span>
                </p>
                <div className="flex justify-between gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-12 h-14 bg-surface-container-low border border-outline-variant/20 rounded-xl text-center text-xl font-bold focus:ring-2 focus:ring-secondary/20 outline-none transition-all focus:border-transparent hover:bg-surface-container"
                    />
                  ))}
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setEmailStep('email')}
                    className="px-5 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-variant transition-colors"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={handleEmailSubmit}
                    disabled={otp.some(d => d === '')}
                    className="px-6 py-2 bg-primary text-on-primary-fixed rounded-xl text-sm font-bold hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    Xác nhận
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  return (
    <>
      <SettingsContent />

      <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3 glass-panel px-4 py-2 rounded-full border border-outline-variant/20 shadow-2xl">
        <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_rgba(251,180,255,0.8)]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Hệ thống Sẵn sàng</span>
      </div>
    </>
  );
}
