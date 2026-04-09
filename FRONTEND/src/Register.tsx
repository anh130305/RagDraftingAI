import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Mail, Monitor, Moon, Sparkles, Sun, User } from 'lucide-react';
import './styles/chat-auth.css';

type ThemeMode = 'light' | 'dark' | 'system';

export default function Register() {
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
    <div className="bg-background text-on-surface font-body min-h-screen flex overflow-hidden w-full">
      {/* Left Column: Immersive Visual */}
      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-end p-16">
        <div className="absolute inset-0 z-0">
          <img alt="Abstract AI Visual" className="w-full h-full object-cover animate-subtle-drift" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnhCLKDPlClpdk5l_CPYZxFa4LH8y2tVNHUVCIDHHVZmhkFJJZVnNd68to2drK7guEqxzJD5MP3ERGuXN0rm3zchxiKhIeZToIBfBQGKEcjPDNQztm-1JrvxPQhNmRpG6eCPl7JqN04aVigRvDhkkQ4ITP8-yy6FSZfQcxFeLeTqpZd6V1y_tLknfl6ET-xjV9WHoL3wRsqFuX0LXjxnLjG6cE9hYLYUv_AajGw6pL39WT7sQHlD0lU8Iq0GBuye3i_b1AXI5U6iz4" />
          <div className="absolute inset-0 auth-overlay-bottom"></div>
          <div className="absolute inset-0 auth-overlay-right"></div>
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg primary-gradient flex items-center justify-center glow-shadow">
              <Sparkles className="w-5 h-5 text-on-primary-fixed" />
            </div>
            <span className="text-2xl font-black text-white font-headline tracking-tighter">Obsidian Nebula</span>
          </div>
          <h2 className="text-6xl font-extrabold font-headline leading-tight mb-6 text-white">Định hình tươi lai <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Trí tuệ Nhân tạo</span></h2>
          <p className="text-xl text-white/70 leading-relaxed">Gia nhập cộng đồng những người tiên phong sử dụng AI để tối ưu hóa quy trình sáng tạo và làm việc chuyên nghiệp.</p>
        </div>
      </section>

      {/* Right Column: Registration Form */}
      <main className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-16 relative overflow-y-auto bg-surface">
        <div className="absolute inset-0 nebula-gradient lg:hidden -z-10"></div>

        {/* Theme Toggle - Top Right */}
        <button
          onClick={cycleTheme}
          className="absolute top-6 right-6 px-3 py-2 rounded-lg border border-outline-variant/50 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest hover:border-outline transition-all z-10"
          title="Toggle Theme"
        >
          <ThemeIcon className="w-5 h-5" />
        </button>

        <div className="w-full max-w-md">
          {/* Branding */}
          <div className="text-center lg:text-left space-y-4 mb-10">
            <div className="flex items-center justify-center lg:justify-start gap-3">
              <div className="w-10 h-10 rounded-lg primary-gradient flex items-center justify-center glow-shadow">
                <Sparkles className="w-5 h-5 text-on-primary-fixed" />
              </div>
              <span className="font-headline font-black text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-container">
                Obsidian Nebula
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">Bắt đầu hành trình</h1>
              <p className="text-on-surface-variant mt-2">Tạo tài khoản để khám phá sức mạnh AI</p>
            </div>
          </div>

          <div className="glass-morphism rounded-2xl p-8 ghost-border space-y-6 shadow-2xl">
            <form className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 font-label">Họ tên</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                  </div>
                  <input className="block w-full pl-11 pr-4 py-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all" placeholder="Nhập họ và tên" type="text" />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 font-label">Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                  </div>
                  <input className="block w-full pl-11 pr-4 py-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all" placeholder="name@example.com" type="email" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 font-label">Mật khẩu</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                  </div>
                  <input className="block w-full pl-11 pr-4 py-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all" placeholder="••••••••" type="password" />
                </div>
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3 py-2">
                <input className="w-4 h-4 mt-0.5 rounded bg-surface-container-highest border-outline-variant/30 text-primary focus:ring-primary/20 cursor-pointer" id="terms" type="checkbox" />
                <label className="text-[13px] text-on-surface-variant leading-snug cursor-pointer select-none" htmlFor="terms">
                  Tôi đồng ý với <span className="text-primary hover:text-primary-container transition-colors">Điều khoản</span> và <span className="text-primary hover:text-primary-container transition-colors">Chính sách bảo mật</span>.
                </label>
              </div>

              {/* Submit */}
              <button className="w-full primary-gradient text-on-primary-fixed font-bold py-4 rounded-xl glow-shadow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2" type="button">
                ĐĂNG KÝ
              </button>

              {/* Divider */}
              <div className="relative py-2 flex items-center">
                <div className="flex-grow border-t border-outline-variant/10"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">HOẶC ĐĂNG KÝ VỚI</span>
                <div className="flex-grow border-t border-outline-variant/10"></div>
              </div>

              {/* Social Login - Google Only */}
              <button className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-surface-container-highest rounded-xl ghost-border hover:bg-surface-bright transition-all text-sm font-medium">
                <img alt="Google Logo" className="w-5 h-5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBrn9hzKM7y4NObsaHyoNqVXbmyf0HjqLTRxXN0j_IQMAXptKUoMQFVOz79T4dUmdQeeqiZUczbGq7-jS7D-sdWczf7lQ_8KSb18yJBTV0SguUF0dbZ6hlsEOmbD8x9__3GmtUx83clL65xs78U-3RIgrlMfwlBXvCBbNckvAu7ii_JE77CqutwhDRb4K7PqCEQUF6eD4kXAUuMeXopFuGBSOmDfy8u7gWt8LGgIp8IXFly8t_SdcwDbTIiLUWZycH1r1ObvnH5aPvm" />
                Google
              </button>
            </form>
          </div>

          {/* Login Redirect */}
          <div className="mt-8 text-center">
            <p className="text-on-surface-variant font-medium text-sm">
              Đã có tài khoản?
              <Link className="text-primary font-bold hover:underline ml-1" to="/login">Đăng nhập ngay</Link>
            </p>
          </div>
        </div>

        {/* Footer - Privacy/Terms/Security only */}
        <footer className="fixed bottom-0 w-full flex justify-center items-center px-12 py-6 lg:w-1/2 right-0 z-50 bg-transparent">
          <div className="flex items-center gap-6">
            <a className="font-body text-xs tracking-wide uppercase text-on-surface-variant/40 hover:text-on-surface-variant transition-colors" href="#">Privacy</a>
            <a className="font-body text-xs tracking-wide uppercase text-on-surface-variant/40 hover:text-on-surface-variant transition-colors" href="#">Terms</a>
            <a className="font-body text-xs tracking-wide uppercase text-on-surface-variant/40 hover:text-on-surface-variant transition-colors" href="#">Security</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
