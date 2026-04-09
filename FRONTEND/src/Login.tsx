import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Lock, Mail, Monitor, Moon, Sparkles, Sun } from 'lucide-react';
import './styles/chat-auth.css';

type ThemeMode = 'light' | 'dark' | 'system';

export default function Login() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('auth-theme') as ThemeMode | null;
    return saved || 'dark';
  });

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

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div className="bg-background text-on-surface font-body selection:bg-primary selection:text-on-primary-fixed overflow-hidden w-full min-h-screen flex">
      {/* Main Split Layout Container */}
      <main className="flex min-h-screen w-full">
        {/* Left Section: Visuals & Branding (50%) */}
        <section className="hidden lg:flex lg:w-1/2 relative items-end p-16 overflow-hidden">
          {/* Background Image with data-alt */}
          <div className="absolute inset-0 z-0">
            <img alt="Advanced AI Agent illustration, holographic humanoid brain interface with glowing neural networks" className="w-full h-full object-cover" data-alt="Advanced AI Agent illustration, holographic humanoid brain interface with glowing neural networks, futuristic aesthetic" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAL2cmfr3JjsdYYFk_cAhTyEkFrQkL6oya9hqxJHbBkwEaTaUjtU4F24pcOZT0dh80bFhAziCxU7xDE6FaPt3rvYJzHe_dXyT-A1KWOXA7BUrEYq5DPcUnjOD0F81MjOwcECoOOan3vCgbUcHT3QtzyLoIvi7yNqP2HYyVdatYe9KuRyNWmc50VocervUpatCRGxJbSCcnubUzffZPYv7bAOTmrJPMXyrz6AjeyiA8lVSBJlNrr0W4SelsXBP0i-tEUnMfam1BSqxWs" />
            {/* Overlay for depth */}
            <div className="absolute inset-0 auth-overlay-bottom"></div>
            <div className="absolute inset-0 auth-overlay-right"></div>
          </div>
          {/* Content over visual */}
          <div className="relative z-10 max-w-2xl">
            <h1 className="font-headline text-6xl font-extrabold tracking-tight leading-tight mb-6 text-white">
              Khai phá sức mạnh <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Trí tuệ nhân tạo</span>
            </h1>
            <p className="text-white/70 text-xl max-w-lg leading-relaxed">
              Đắm chìm trong không gian làm việc tối ưu với Obsidian Nebula. Nơi kiến thức và sự sáng tạo giao thoa trong sự tĩnh lặng của bóng tối.
            </p>
          </div>
        </section>
        {/* Right Section: Login Form (50%) */}
        <section className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-16 relative z-10 bg-surface">
          {/* Theme Toggle - Top Right */}
          <button
            onClick={cycleTheme}
            className="absolute top-6 right-6 px-3 py-2 rounded-lg border border-outline-variant/50 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest hover:border-outline transition-all"
            title="Toggle Theme"
          >
            <ThemeIcon className="w-5 h-5" />
          </button>

          {/* Content Container */}
          <div className="w-full max-w-md space-y-10">
            {/* Header & Logo */}
            <div className="text-center lg:text-left space-y-4">
              <div className="flex items-center justify-center lg:justify-start gap-3">
                <div className="w-10 h-10 rounded-lg primary-gradient flex items-center justify-center glow-shadow">
                  <Sparkles className="w-5 h-5 text-on-primary-fixed" />
                </div>
                <span className="font-headline font-black text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-container">
                  Obsidian Nebula
                </span>
              </div>
              <div>
                <h2 className="font-headline text-3xl font-bold text-on-surface">Chào mừng trở lại</h2>
                <p className="text-on-surface-variant mt-2">Vui lòng nhập thông tin để tiếp tục hành trình của bạn.</p>
              </div>
            </div>
            {/* Glassmorphism Form Card */}
            <div className="glass-morphism rounded-2xl p-8 ghost-border space-y-6 shadow-2xl">
              <form className="space-y-5">
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="font-label text-sm font-medium text-on-surface-variant ml-1" htmlFor="email">Email của bạn</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                    </div>
                    <input className="block w-full pl-11 pr-4 py-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all" id="email" placeholder="name@company.com" type="email" />
                  </div>
                </div>
                {/* Password Field */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="font-label text-sm font-medium text-on-surface-variant" htmlFor="password">Mật khẩu</label>
                    <a className="text-xs font-semibold text-secondary hover:text-tertiary transition-colors" href="#">Quên mật khẩu?</a>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                    </div>
                    <input className="block w-full pl-11 pr-12 py-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all" id="password" placeholder="••••••••" type="password" />
                    <button className="absolute inset-y-0 right-0 pr-4 flex items-center text-on-surface-variant hover:text-on-surface" type="button">
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {/* Login Button */}
                <button className="w-full primary-gradient text-on-primary-fixed font-bold py-4 rounded-xl glow-shadow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2" type="button">
                  ĐĂNG NHẬP
                </button>
              </form>
              {/* Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-outline-variant/30"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Hoặc đăng nhập với</span>
                <div className="flex-grow border-t border-outline-variant/30"></div>
              </div>
              {/* Social Login - Google Only */}
              <button className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-surface-container-highest rounded-xl ghost-border hover:bg-surface-bright transition-all text-sm font-medium">
                <img alt="Google Logo" className="w-5 h-5" data-alt="Official Google multi-color logo icon" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBrn9hzKM7y4NObsaHyoNqVXbmyf0HjqLTRxXN0j_IQMAXptKUoMQFVOz79T4dUmdQeeqiZUczbGq7-jS7D-sdWczf7lQ_8KSb18yJBTV0SguUF0dbZ6hlsEOmbD8x9__3GmtUx83clL65xs78U-3RIgrlMfwlBXvCBbNckvAu7ii_JE77CqutwhDRb4K7PqCEQUF6eD4kXAUuMeXopFuGBSOmDfy8u7gWt8LGgIp8IXFly8t_SdcwDbTIiLUWZycH1r1ObvnH5aPvm" />
                Google
              </button>
            </div>
            {/* Footer */}
            <p className="text-center text-on-surface-variant text-sm">
              Chưa có tài khoản?
              <Link className="text-primary font-bold hover:underline ml-1" to="/register">Đăng ký ngay</Link>
            </p>
          </div>
        </section>
      </main>
      {/* Footer - Privacy/Terms/Security only */}
      <footer className="fixed bottom-0 w-full flex justify-center items-center px-12 py-6 lg:w-1/2 right-0 z-50 bg-transparent">
        <div className="flex items-center gap-6">
          <a className="font-body text-xs tracking-wide uppercase text-on-surface-variant/40 hover:text-on-surface-variant transition-colors" href="#">Privacy</a>
          <a className="font-body text-xs tracking-wide uppercase text-on-surface-variant/40 hover:text-on-surface-variant transition-colors" href="#">Terms</a>
          <a className="font-body text-xs tracking-wide uppercase text-on-surface-variant/40 hover:text-on-surface-variant transition-colors" href="#">Security</a>
        </div>
      </footer>
    </div>
  );
}
