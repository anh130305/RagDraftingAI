import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Monitor, Moon, Hexagon, Sun, User, Eye, EyeOff } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { getHomePathByRole, useAuth } from './lib/AuthContext';
import { useToast } from './lib/ToastContext';
import NeuralCanvas from './components/NeuralCanvas';
import './styles/chat-auth.css';

type ThemeMode = 'light' | 'dark' | 'system';


export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('auth-theme') as ThemeMode | null;
    return saved || 'dark';
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
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

  const cycleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!username.trim()) newErrors.username = 'Vui lòng nhập tên đăng nhập';
    if (!password) newErrors.password = 'Vui lòng nhập mật khẩu';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const user = await login(username.trim(), password);
      showToast('Đăng nhập thành công!', 'success');
      navigate(getHomePathByRole(user.role), { replace: true });
    } catch (err: any) {
      showToast(err.message || 'Đăng nhập thất bại', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onGoogleSuccess = async (response: any) => {
    setIsSubmitting(true);
    setErrors({});
    try {
      const { needs_onboarding, user } = await googleLogin(response.credential);
      showToast('Đăng nhập thành công!', 'success');
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (needs_onboarding) {
        navigate('/settings', { replace: true, state: { onboarding: true } });
      } else {
        navigate('/chat', { replace: true });
      }
    } catch (err: any) {
      showToast(err.message || 'Đăng nhập Google thất bại', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div className="bg-background text-on-surface font-body selection:bg-primary selection:text-on-primary-fixed overflow-hidden w-full min-h-screen flex">
      {/* Main Split Layout Container */}
      <main className="flex min-h-screen w-full">

        {/* Left Section: Neural Network Animation (50%) */}
        <section className="hidden lg:flex lg:w-1/2 relative items-end p-16 overflow-hidden">
          {/* ── Neural canvas — replaces the old <img> ── */}
          <div className="absolute inset-0 z-0">
            {/* Dark background so the purple particles pop */}
            <div className="absolute inset-0" style={{ background: 'var(--color-surface, #080818)' }} />
            <NeuralCanvas />
            {/* Subtle vignette so edges blend softly */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(0,0,0,0.45) 100%)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Overlay gradients — unchanged from your original */}
          <div className="absolute inset-0 auth-overlay-bottom" />
          <div className="absolute inset-0 auth-overlay-right" />

          {/* Content over animation — unchanged */}
          <div className="relative z-10 max-w-2xl">
            <h1 className="font-headline text-6xl font-extrabold tracking-tight leading-tight mb-6 text-white">
              Khai phá sức mạnh <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                Trí tuệ nhân tạo
              </span>
            </h1>
            <p className="text-white/70 text-xl max-w-lg leading-relaxed">
              Đắm chìm trong không gian làm việc tối ưu với Rag AI. Nơi kiến thức và sự sáng tạo
              giao thoa trong sự tĩnh lặng của bóng tối.
            </p>
          </div>
        </section>

        {/* Right Section: Login Form (50%) — 100% original, zero changes */}
        <section className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-16 relative z-10 bg-surface">
          {/* Theme Toggle - Top Right */}
          <button
            onClick={cycleTheme}
            className="absolute top-6 right-6 px-3 py-2 rounded-lg border border-outline-variant/50 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest hover:border-outline transition-all"
            title="Đổi giao diện"
          >
            <ThemeIcon className="w-5 h-5" />
          </button>

          {/* Content Container */}
          <div className="w-full max-w-md space-y-6">
            {/* Header & Logo */}
            <div className="text-center lg:text-left space-y-4">
              <Link to="/" className="flex items-center justify-center lg:justify-start gap-3 hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-[#4B91F7] flex items-center justify-center glow-shadow">
                  <Hexagon className="w-6 h-6 text-black" strokeWidth={2.5} />
                </div>
                <span className="font-headline font-black text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-container">
                  RAG AI
                </span>
              </Link>
            </div>

            {/* Glassmorphism Form Card */}
            <div className="glass-morphism rounded-2xl p-6 ghost-border space-y-4 shadow-2xl">
              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Username Field */}
                <div className="space-y-2">
                  <label
                    className="font-label text-sm font-medium text-on-surface-variant ml-1"
                    htmlFor="username"
                  >
                    Tên đăng nhập
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                      className={`block w-full pl-11 pr-4 py-3 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all ${errors.username ? 'ring-1 ring-error/50' : ''}`}
                      id="username"
                      placeholder="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      disabled={isSubmitting}
                      maxLength={255}
                    />
                  </div>
                  {errors.username && (
                    <p className="text-error text-[10px] font-bold uppercase tracking-wider ml-1">
                      {errors.username}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label
                      className="font-label text-sm font-medium text-on-surface-variant"
                      htmlFor="password"
                    >
                      Mật khẩu
                    </label>
                    <a
                      className="text-xs font-semibold text-secondary hover:text-tertiary transition-colors"
                      href="#"
                    >
                      Quên mật khẩu?
                    </a>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                      className={`block w-full pl-11 pr-12 py-3 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all ${errors.password ? 'ring-1 ring-error/50' : ''}`}
                      id="password"
                      placeholder="••••••••"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      maxLength={255}
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

                {/* Login Button */}
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
                    'ĐĂNG NHẬP'
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-outline-variant/30" />
                <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                  Hoặc đăng nhập với
                </span>
                <div className="flex-grow border-t border-outline-variant/30" />
              </div>

              {/* Social Login - Google Only */}
              <div className="w-full flex justify-center">
                <GoogleLogin
                  onSuccess={onGoogleSuccess}
                  onError={() => showToast('Đăng nhập Google thất bại', 'error')}
                  useOneTap
                  theme={theme === 'dark' ? 'filled_black' : 'outline'}
                  shape="pill"
                  size="large"
                  width="320"
                />
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-on-surface-variant text-sm">
              Chưa có tài khoản?
              <Link className="text-primary font-bold hover:underline ml-1" to="/register">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* Footer - Privacy/Terms/Security only */}
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
    </div>
  );
}