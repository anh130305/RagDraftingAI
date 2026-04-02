import React from 'react';
import { Link } from 'react-router-dom';

export default function Login() {
  return (
    <div className="bg-background text-on-surface font-body selection:bg-primary selection:text-on-primary-fixed overflow-hidden w-full min-h-screen flex">
      {/* Main Split Layout Container */}
      <main className="flex min-h-screen w-full">
        {/* Left Section: Visuals & Branding (60%) */}
        <section className="hidden lg:flex w-3/5 relative items-end p-16 overflow-hidden">
          {/* Background Image with data-alt */}
          <div className="absolute inset-0 z-0">
            <img alt="Advanced AI Agent illustration, holographic humanoid brain interface with glowing neural networks" className="w-full h-full object-cover" data-alt="Advanced AI Agent illustration, holographic humanoid brain interface with glowing neural networks, futuristic aesthetic" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAL2cmfr3JjsdYYFk_cAhTyEkFrQkL6oya9hqxJHbBkwEaTaUjtU4F24pcOZT0dh80bFhAziCxU7xDE6FaPt3rvYJzHe_dXyT-A1KWOXA7BUrEYq5DPcUnjOD0F81MjOwcECoOOan3vCgbUcHT3QtzyLoIvi7yNqP2HYyVdatYe9KuRyNWmc50VocervUpatCRGxJbSCcnubUzffZPYv7bAOTmrJPMXyrz6AjeyiA8lVSBJlNrr0W4SelsXBP0i-tEUnMfam1BSqxWs"/>
            {/* Overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/40"></div>
          </div>
          {/* Content over visual */}
          <div className="relative z-10 max-w-2xl">
            <h1 className="font-headline text-6xl font-extrabold tracking-tight leading-tight mb-6">
              Khai phá sức mạnh <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Trí tuệ nhân tạo</span>
            </h1>
            <p className="text-on-surface-variant text-xl max-w-lg leading-relaxed">
              Đắm chìm trong không gian làm việc tối ưu với Obsidian Nebula. Nơi kiến thức và sự sáng tạo giao thoa trong sự tĩnh lặng của bóng tối.
            </p>
          </div>
          {/* Decorative Floating Element */}
          <div className="absolute top-1/4 right-10 w-64 h-64 glass-morphism rounded-full ghost-border flex items-center justify-center animate-pulse">
            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-2xl"></div>
            <span className="material-symbols-outlined text-6xl text-primary">star_half</span>
          </div>
        </section>
        {/* Right Section: Login Form (40%) */}
        <section className="w-full lg:w-2/5 flex items-center justify-center p-6 sm:p-12 md:p-20 relative z-10 bg-surface">
          {/* Content Container */}
          <div className="w-full max-w-md space-y-10">
            {/* Header & Logo */}
            <div className="text-center lg:text-left space-y-4">
              <div className="flex items-center justify-center lg:justify-start gap-3">
                <div className="w-10 h-10 rounded-lg primary-gradient flex items-center justify-center glow-shadow">
                  <span className="material-symbols-outlined text-on-primary-fixed font-bold">auto_awesome</span>
                </div>
                <span className="font-headline font-black text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                  Obsidian Nebula
                </span>
              </div>
              <div>
                <h2 className="font-headline text-3xl font-bold text-on-surface">Chào mừng trở lại</h2>
                <p className="text-on-surface-variant mt-2">Vui lòng nhập thông tin để tiếp tục hành trình của bạn.</p>
              </div>
            </div>
            {/* Glassmorphism Form Card */}
            <div className="glass-morphism rounded-xl p-8 ghost-border space-y-6">
              <form className="space-y-5">
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="font-label text-sm font-medium text-on-surface-variant ml-1" htmlFor="email">Email của bạn</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-on-surface-variant text-xl group-focus-within:text-primary transition-colors">mail</span>
                    </div>
                    <input className="block w-full pl-11 pr-4 py-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all" id="email" placeholder="name@company.com" type="email"/>
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
                      <span className="material-symbols-outlined text-on-surface-variant text-xl group-focus-within:text-primary transition-colors">lock</span>
                    </div>
                    <input className="block w-full pl-11 pr-12 py-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all" id="password" placeholder="••••••••" type="password"/>
                    <button className="absolute inset-y-0 right-0 pr-4 flex items-center text-on-surface-variant hover:text-on-surface" type="button">
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                  </div>
                </div>
                {/* Login Button */}
                <button className="w-full primary-gradient text-on-primary-fixed font-bold py-4 rounded-xl glow-shadow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2" type="button">
                  Đăng nhập ngay
                  <span className="material-symbols-outlined text-xl">arrow_forward</span>
                </button>
              </form>
              {/* Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-outline-variant/30"></div>
                <span className="flex-shrink mx-4 text-xs font-label uppercase tracking-widest text-outline">Hoặc đăng nhập với</span>
                <div className="flex-grow border-t border-outline-variant/30"></div>
              </div>
              {/* Social Login */}
              <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center justify-center gap-3 py-3 px-4 bg-surface-container-highest rounded-xl ghost-border hover:bg-surface-bright transition-all text-sm font-medium">
                  <img alt="Google Logo" className="w-5 h-5" data-alt="Official Google multi-color logo icon" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBrn9hzKM7y4NObsaHyoNqVXbmyf0HjqLTRxXN0j_IQMAXptKUoMQFVOz79T4dUmdQeeqiZUczbGq7-jS7D-sdWczf7lQ_8KSb18yJBTV0SguUF0dbZ6hlsEOmbD8x9__3GmtUx83clL65xs78U-3RIgrlMfwlBXvCBbNckvAu7ii_JE77CqutwhDRb4K7PqCEQUF6eD4kXAUuMeXopFuGBSOmDfy8u7gWt8LGgIp8IXFly8t_SdcwDbTIiLUWZycH1r1ObvnH5aPvm"/>
                  Google
                </button>
                <button className="flex items-center justify-center gap-3 py-3 px-4 bg-surface-container-highest rounded-xl ghost-border hover:bg-surface-bright transition-all text-sm font-medium">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.041-1.412-4.041-1.412-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path></svg>
                  GitHub
                </button>
              </div>
            </div>
            {/* Footer */}
            <p className="text-center text-on-surface-variant text-sm">
              Chưa có tài khoản? 
              <Link className="text-primary font-bold hover:underline ml-1" to="/register">Đăng ký ngay</Link>
            </p>
          </div>
        </section>
      </main>
      {/* Universal Footer from JSON mapping */}
      <footer className="fixed bottom-0 w-full flex justify-between items-center px-12 py-8 lg:w-1/2 right-0 z-50 bg-transparent">
        <div className="flex items-center gap-6">
          <a className="font-body text-xs tracking-wide uppercase text-zinc-600 hover:text-zinc-300 transition-colors" href="#">Privacy</a>
          <a className="font-body text-xs tracking-wide uppercase text-zinc-600 hover:text-zinc-300 transition-colors" href="#">Terms</a>
          <a className="font-body text-xs tracking-wide uppercase text-zinc-600 hover:text-zinc-300 transition-colors" href="#">Security</a>
        </div>
        <span className="font-body text-xs tracking-wide uppercase text-zinc-600">
          © 2024 Obsidian Architect. Designed for the deep space.
        </span>
      </footer>
    </div>
  );
}
