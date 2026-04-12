import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Monitor, Moon, Sparkles, Sun, User, Building2, Eye, EyeOff } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { getHomePathByRole, useAuth } from './lib/AuthContext';
import { useToast } from './lib/ToastContext';
import NeuralCanvas from './components/NeuralCanvas';
import './styles/chat-auth.css';

type ThemeMode = 'light' | 'dark' | 'system';


export default function Register() {
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('auth-theme') as ThemeMode | null;
    return saved || 'dark';
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
    confirmPassword?: string;
    department?: string;
    agreedTerms?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolvedTheme =
        theme === 'system' ? (systemThemeQuery.matches ? 'dark' : 'light') : theme;
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    };
    applyTheme();
    localStorage.setItem('auth-theme', theme);
    systemThemeQuery.addEventListener('change', applyTheme);
    return () => systemThemeQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  // Re-validate confirmPassword when password changes
  useEffect(() => {
    if (confirmPassword && password !== confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: 'Mật khẩu xác nhận không khớp' }));
    } else {
      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
    }
  }, [password]);

  const cycleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark'));
  };

  const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      newErrors.username = 'Vui lòng nhập tên đăng nhập';
    } else if (trimmedUsername.length < 3) {
      newErrors.username = 'Tên đăng nhập phải có ít nhất 3 ký tự';
    } else if (trimmedUsername.length > 50) {
      newErrors.username = 'Tên đăng nhập không được vượt quá 50 ký tự';
    } else if (!USERNAME_REGEX.test(trimmedUsername)) {
      newErrors.username = 'Chỉ dùng chữ cái, số, _ và -';
    }

    if (!department) {
      newErrors.department = 'Vui lòng chọn phòng ban';
    }

    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 6) {
      newErrors.password = 'Ít nhất 6 ký tự';
    } else if (password.length > 72) {
      newErrors.password = 'Tối đa 72 ký tự';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu không khớp';
    }

    if (!agreedTerms) {
      newErrors.agreedTerms = 'Bạn cần đồng ý với điều khoản';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const createdUser = await register(trimmedUsername, password, department || undefined);
      showToast('Đăng ký thành công!', 'success');
      navigate(getHomePathByRole(createdUser.role), { replace: true });
    } catch (err: any) {
      if (err.status === 409) {
        setErrors({ username: 'Tên đăng nhập đã được sử dụng' });
      } else if (err.status === 422) {
        showToast(err.message || 'Dữ liệu không hợp lệ', 'error');
      } else if (!navigator.onLine || err.message === 'Failed to fetch') {
        showToast('Không thể kết nối đến máy chủ', 'error');
      } else {
        showToast(err.message || 'Đăng ký thất bại', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onGoogleSuccess = async (response: any) => {
    setIsSubmitting(true);
    setErrors({});
    try {
      const { needs_onboarding, user } = await googleLogin(response.credential, department || undefined);
      showToast('Đăng ký thành công!', 'success');
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (needs_onboarding) {
        navigate('/settings', { replace: true, state: { onboarding: true } });
      } else {
        navigate('/chat', { replace: true });
      }
    } catch (err: any) {
      showToast(err.message || 'Đăng ký Google thất bại', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div className="bg-background text-on-surface font-body min-h-screen flex overflow-hidden w-full">

      {/* Left Column: Neural Network Animation */}
      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-end p-16">
        {/* ── Neural canvas — replaces the old <img> ── */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0" style={{ background: 'var(--color-surface, #080818)' }} />
          <NeuralCanvas />
          {/* Subtle vignette */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(0,0,0,0.45) 100%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Overlay gradients — unchanged from original */}
        <div className="absolute inset-0 auth-overlay-bottom" />
        <div className="absolute inset-0 auth-overlay-right" />

        {/* Content — unchanged from original */}
        <div className="relative z-10 max-w-2xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg primary-gradient flex items-center justify-center glow-shadow">
              <Sparkles className="w-5 h-5 text-on-primary-fixed" />
            </div>
            <span className="font-headline font-black text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-container">
              RAG AI
            </span>
          </div>
          <h1 className="font-headline text-5xl font-extrabold tracking-tight leading-tight mb-6 text-white">
            Tham gia cùng <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              Hàng nghìn người dùng
            </span>
          </h1>
          <p className="text-white/70 text-lg max-w-lg leading-relaxed">
            Tạo tài khoản và bắt đầu trải nghiệm sức mạnh AI ngay hôm nay.
          </p>
        </div>
      </section>

      {/* Right Column: Register Form — 100% original */}
      <main className="w-full lg:w-1/2 flex flex-col min-h-screen relative z-10 bg-surface">
        {/* Theme Toggle */}
        <button
          onClick={cycleTheme}
          className="absolute top-6 right-6 px-3 py-2 rounded-lg border border-outline-variant/50 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest hover:border-outline transition-all z-10"
          title="Đổi giao diện"
        >
          <ThemeIcon className="w-5 h-5" />
        </button>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-10 md:p-14">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <div className="w-10 h-10 rounded-lg primary-gradient flex items-center justify-center glow-shadow">
                <Sparkles className="w-5 h-5 text-on-primary-fixed" />
              </div>
              <span className="font-headline font-black text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-container">
                RAG AI
              </span>
            </div>

            {/* Form Card */}
            <div className="glass-morphism rounded-2xl p-6 ghost-border space-y-3.5 shadow-2xl">
              <form className="space-y-3.5" onSubmit={handleSubmit}>

                {/* Username */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 font-label">
                    Tên đăng nhập
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                      className={`block w-full pl-11 pr-4 py-3 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all ${errors.username ? 'ring-1 ring-error/50' : ''}`}
                      placeholder="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      disabled={isSubmitting}
                      maxLength={50}
                    />
                  </div>
                  {errors.username && (
                    <p className="text-error text-[10px] font-bold uppercase tracking-wider ml-1">
                      {errors.username}
                    </p>
                  )}
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 font-label">
                    Phòng ban
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Building2 className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                    </div>
                    <select
                      className={`block w-full pl-11 pr-4 py-3 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface transition-all appearance-none cursor-pointer ${errors.department ? 'ring-1 ring-error/50' : ''}`}
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      disabled={isSubmitting}
                    >
                      <option value="">Chọn Phòng Ban</option>
                      <option value="BackEnd">BackEnd</option>
                      <option value="FrontEnd">FrontEnd</option>
                      <option value="AI Engineer">AI Engineer</option>
                      <option value="FullStack">FullStack</option>
                      <option value="DevOps">DevOps</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {errors.department && (
                    <p className="text-error text-[10px] font-bold uppercase tracking-wider ml-1">
                      {errors.department}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 font-label">
                    Mật khẩu
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                      className={`block w-full pl-11 pr-12 py-3 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all ${errors.password ? 'ring-1 ring-error/50' : ''}`}
                      placeholder="Ít nhất 6 ký tự"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      maxLength={72}
                    />
                    <button
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-on-surface-variant hover:text-on-surface"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-error text-[10px] font-bold uppercase tracking-wider ml-1">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 font-label">
                    Xác nhận mật khẩu
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                      className={`block w-full pl-11 pr-4 py-3 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all ${errors.confirmPassword ? 'ring-1 ring-error/50' : ''}`}
                      placeholder="Nhập lại mật khẩu"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      maxLength={72}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-error text-[10px] font-bold uppercase tracking-wider ml-1">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                {/* Terms */}
                <div className="flex flex-col gap-1 py-1">
                  <div className="flex items-start gap-3">
                    <input
                      className="w-4 h-4 mt-0.5 rounded bg-surface-container-highest border-outline-variant/30 text-primary focus:ring-primary/20 cursor-pointer"
                      id="terms"
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      disabled={isSubmitting}
                    />
                    <label
                      className="text-[13px] text-on-surface-variant leading-snug cursor-pointer select-none"
                      htmlFor="terms"
                    >
                      Tôi đồng ý với{' '}
                      <span className="text-primary hover:text-primary-container transition-colors">
                        Điều khoản
                      </span>{' '}
                      và{' '}
                      <span className="text-primary hover:text-primary-container transition-colors">
                        Chính sách bảo mật
                      </span>
                      .
                    </label>
                  </div>
                  {errors.agreedTerms && (
                    <p className="text-error text-[10px] font-bold uppercase tracking-wider ml-7">
                      {errors.agreedTerms}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  className="w-full primary-gradient text-on-primary-fixed font-bold py-3.5 rounded-xl glow-shadow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ĐANG XỬ LÝ...
                    </>
                  ) : (
                    'ĐĂNG KÝ'
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative py-1 flex items-center">
                <div className="flex-grow border-t border-outline-variant/10" />
                <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                  HOẶC ĐĂNG KÝ VỚI
                </span>
                <div className="flex-grow border-t border-outline-variant/10" />
              </div>

              {/* Social Login - Google Only */}
              <div className="w-full flex justify-center">
                <GoogleLogin
                  onSuccess={onGoogleSuccess}
                  onError={() => showToast('Đăng ký Google thất bại', 'error')}
                  useOneTap
                  theme={theme === 'dark' ? 'filled_black' : 'outline'}
                  shape="pill"
                  size="large"
                  width="320"
                />
              </div>
            </div>

            {/* Login Redirect */}
            <div className="mt-8 text-center">
              <p className="text-on-surface-variant font-medium text-sm">
                Đã có tài khoản?
                <Link className="text-primary font-bold hover:underline ml-1" to="/login">
                  Đăng nhập ngay
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="fixed bottom-0 w-full flex justify-center items-center px-12 py-6 lg:w-1/2 right-0 z-50 bg-transparent">
          <div className="flex items-center gap-6">
            <a
              className="font-body text-xs tracking-wide uppercase text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
              href="#"
            >
              Bảo mật
            </a>
            <a
              className="font-body text-xs tracking-wide uppercase text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
              href="#"
            >
              Điều khoản
            </a>
            <a
              className="font-body text-xs tracking-wide uppercase text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
              href="#"
            >
              An ninh
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}