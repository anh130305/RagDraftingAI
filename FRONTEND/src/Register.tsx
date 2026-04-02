import React from 'react';
import { Link } from 'react-router-dom';

export default function Register() {
  return (
    <div className="bg-background text-on-surface font-body min-h-screen flex overflow-hidden w-full">
      {/* Left Column: Immersive Visual */}
      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center border-r border-outline-variant/10">
        <div className="absolute inset-0 z-0">
          <img alt="Abstract AI Visual" className="w-full h-full object-cover animate-subtle-drift opacity-60" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnhCLKDPlClpdk5l_CPYZxFa4LH8y2tVNHUVCIDHHVZmhkFJJZVnNd68to2drK7guEqxzJD5MP3ERGuXN0rm3zchxiKhIeZToIBfBQGKEcjPDNQztm-1JrvxPQhNmRpG6eCPl7JqN04aVigRvDhkkQ4ITP8-yy6FSZfQcxFeLeTqpZd6V1y_tLknfl6ET-xjV9WHoL3wRsqFuX0LXjxnLjG6cE9hYLYUv_AajGw6pL39WT7sQHlD0lU8Iq0GBuye3i_b1AXI5U6iz4"/>
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
        </div>
        <div className="relative z-10 p-16 max-w-2xl">
          <div className="mb-8">
            <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-primary font-headline tracking-tighter drop-shadow-[0_0_15px_rgba(133,173,255,0.5)]">Obsidian AI</span>
          </div>
          <h2 className="text-6xl font-extrabold font-headline leading-tight mb-6 drop-shadow-2xl">Định hình tương lai cùng Trí tuệ Nhân tạo.</h2>
          <p className="text-xl text-on-surface-variant leading-relaxed drop-shadow-md">Gia nhập cộng đồng những người tiên phong sử dụng AI để tối ưu hóa quy trình sáng tạo và làm việc chuyên nghiệp.</p>
          <div className="mt-12 flex gap-8">
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-primary">10M+</span>
              <span className="text-sm text-on-surface-variant uppercase tracking-widest font-bold">Người dùng</span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-secondary">99.9%</span>
              <span className="text-sm text-on-surface-variant uppercase tracking-widest font-bold">Uptime</span>
            </div>
          </div>
        </div>
        {/* Decorative Floating Elements */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-primary/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-20 left-20 w-48 h-48 bg-secondary/10 rounded-full blur-[80px]"></div>
      </section>
      {/* Right Column: Registration Form */}
      <main className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto">
        <div className="absolute inset-0 nebula-gradient lg:hidden -z-10"></div>
        <div className="w-full max-w-md">
          {/* Mobile Branding */}
          <div className="lg:hidden text-center mb-8">
            <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-primary font-headline tracking-tighter drop-shadow-[0_0_15px_rgba(133,173,255,0.5)]">Obsidian AI</span>
          </div>
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight mb-2">Bắt đầu hành trình</h1>
            <p className="text-on-surface-variant font-medium">Tạo tài khoản để khám phá sức mạnh AI</p>
          </div>
          <div className="glass-panel p-8 rounded-2xl border border-outline-variant/10 shadow-2xl">
            <form className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 font-label">Họ tên</label>
                <div className="group relative transition-all duration-300">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 group-focus-within:text-primary transition-colors text-xl">person</span>
                  <input className="w-full h-12 pl-12 pr-4 bg-surface-container-high/50 border border-outline-variant/20 rounded-xl text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 focus:border-primary/50 input-glow font-medium transition-all" placeholder="Nhập họ và tên" type="text"/>
                </div>
              </div>
              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 font-label">Email</label>
                <div className="group relative transition-all duration-300">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 group-focus-within:text-primary transition-colors text-xl">mail</span>
                  <input className="w-full h-12 pl-12 pr-4 bg-surface-container-high/50 border border-outline-variant/20 rounded-xl text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 focus:border-primary/50 input-glow font-medium transition-all" placeholder="name@example.com" type="email"/>
                </div>
              </div>
              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 font-label">Mật khẩu</label>
                <div className="group relative transition-all duration-300">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 group-focus-within:text-primary transition-colors text-xl">lock</span>
                  <input className="w-full h-12 pl-12 pr-4 bg-surface-container-high/50 border border-outline-variant/20 rounded-xl text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 focus:border-primary/50 input-glow font-medium transition-all" placeholder="••••••••" type="password"/>
                </div>
              </div>
              {/* Terms */}
              <div className="flex items-start gap-3 py-2">
                <input className="w-4 h-4 mt-0.5 rounded bg-surface-container-highest border-outline-variant/30 text-primary focus:ring-primary/20 cursor-pointer" id="terms" type="checkbox"/>
                <label className="text-[13px] text-on-surface-variant leading-snug cursor-pointer select-none" htmlFor="terms">
                  Tôi đồng ý với <span className="text-primary hover:text-primary-container transition-colors">Điều khoản</span> và <span className="text-primary hover:text-primary-container transition-colors">Chính sách bảo mật</span>.
                </label>
              </div>
              {/* Submit */}
              <button className="w-full h-12 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary-container transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(133,173,255,0.3)] hover:shadow-[0_0_30px_rgba(133,173,255,0.4)]" type="button">
                <span>Đăng ký ngay</span>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
              {/* Divider */}
              <div className="relative py-2 flex items-center">
                <div className="flex-grow border-t border-outline-variant/10"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Hoặc</span>
                <div className="flex-grow border-t border-outline-variant/10"></div>
              </div>
              {/* Social Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button className="flex h-11 bg-surface-container-highest/50 rounded-xl items-center justify-center border border-outline-variant/10 hover:bg-surface-container-highest transition-colors active:scale-95" type="button">
                  <img alt="Google" className="w-5 h-5 mr-2" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJz8MaJvaeJbq_2DB9352Caly06YLWoGCJbrxRgruQu9GfqBfppAhYdlm96MNXroZtj0v0iSh3Nd1yH1JCul61XhAVw8tR0eY6FchNTT3bs5vQvTA5vRAOZz4h773cDy3jH9qe6boOzkMuJqUkAMvb7IlFA_dFHjirJpin6ajdDVuhcGlU8R0Uwe17ehGyZSZMRMVZ6sj9FihEkTTF4o3DIDC0hLW5qzWAkeGYyvSJAiwm5c0qOOe14Olvrc6x3UYTT196-O32DQ71"/>
                  <span className="text-sm font-semibold">Google</span>
                </button>
                <button className="flex h-11 bg-surface-container-highest/50 rounded-xl items-center justify-center border border-outline-variant/10 hover:bg-surface-container-highest transition-colors active:scale-95" type="button">
                  <span className="material-symbols-outlined text-on-surface mr-2 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
                  <span className="text-sm font-semibold">GitHub</span>
                </button>
              </div>
            </form>
          </div>
          {/* Login Redirect */}
          <div className="mt-8 text-center">
            <p className="text-on-surface-variant font-medium text-sm">
              Đã có tài khoản? 
              <Link className="text-primary font-bold hover:underline ml-1" to="/login">Đăng nhập</Link>
            </p>
          </div>
          {/* Minimal Footer */}
          <footer className="mt-12 text-center">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-[0.2em] font-medium opacity-40">© 2024 Obsidian AI • Architecture of Future</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
