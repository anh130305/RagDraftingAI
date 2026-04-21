import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Moon, Sun, Hexagon, Sparkles, ShieldCheck } from 'lucide-react';
import { useTheme } from './lib/ThemeContext';
import NeuralCanvas from './components/NeuralCanvas';

export default function Landing() {
  const [activeSection, setActiveSection] = useState('platform');
  const { theme, setTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, { threshold: 0.5 });

    const sections = ['platform', 'solutions', 'compliance', 'security'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div className="bg-background text-on-surface font-body selection:bg-primary selection:text-on-primary min-h-screen transition-colors duration-300">
      {/* TopNavBar */}
      <header className="sticky top-0 w-full z-50 bg-background/70 backdrop-blur-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.1)] dark:shadow-[0px_24px_48px_rgba(0,0,0,0.4)] transition-colors duration-300">
        <div className="flex items-center justify-between px-10 py-5 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/favicon.svg" alt="RAG AI Logo" className="w-10 h-10 drop-shadow-[0_0_8px_rgba(75,145,247,0.4)] group-hover:scale-110 transition-transform duration-300" />
            <div className="text-2xl font-bold font-headline text-on-surface tracking-tighter group-hover:text-primary transition-colors">RAG AI</div>
          </div>
          <nav className="hidden md:flex items-center space-x-8 font-headline font-semibold tracking-tight">
            {[
              { id: 'platform', label: 'Nền tảng' },
              { id: 'solutions', label: 'Giải pháp' },
              { id: 'compliance', label: 'Quy chuẩn' },
              { id: 'security', label: 'Bảo mật' }
            ].map(({ id, label }) => (
              <a
                key={id}
                className={`relative font-bold transition-all duration-300 capitalize py-1 ${activeSection === id ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                href={`#${id}`}
                onClick={(e) => scrollTo(id, e)}
              >
                {label}
                {/* Hover / Active underline effect */}
                <span className={`absolute left-0 bottom-0 w-full h-[2px] bg-primary rounded-full transition-transform duration-300 ${activeSection === id ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
                  }`}></span>
              </a>
            ))}
          </nav>
          <div className="flex items-center space-x-4">
            <div className="relative" ref={themeMenuRef}>
              <button
                className="p-2.5 rounded-full border border-outline-variant/50 text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all"
                title="Đổi giao diện"
                onClick={() => setShowThemeMenu((prev) => !prev)}
              >
                <ThemeIcon className="w-5 h-5" />
              </button>

              {showThemeMenu && (
                <div className="absolute right-0 mt-2 w-36 bg-surface border border-outline-variant/50 rounded-xl shadow-xl overflow-hidden py-1 z-50">
                  <button
                    onClick={() => { setTheme('light'); setShowThemeMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-high transition-colors ${theme === 'light' ? 'text-primary font-bold' : 'text-on-surface font-medium'}`}
                  >
                    <Sun className="w-4 h-4" /> Sáng
                  </button>
                  <button
                    onClick={() => { setTheme('dark'); setShowThemeMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-high transition-colors ${theme === 'dark' ? 'text-primary font-bold' : 'text-on-surface font-medium'}`}
                  >
                    <Moon className="w-4 h-4" /> Tối
                  </button>
                  <button
                    onClick={() => { setTheme('system'); setShowThemeMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-high transition-colors ${theme === 'system' ? 'text-primary font-bold' : 'text-on-surface font-medium'}`}
                  >
                    <Monitor className="w-4 h-4" /> Hệ thống
                  </button>
                </div>
              )}
            </div>
            <Link to="/register" className="text-on-surface font-bold bg-surface-container-low/50 backdrop-blur-md border border-outline-variant/50 hover:bg-surface-container-high hover:border-primary/50 px-6 py-2.5 rounded-full transition-all duration-300 active:scale-95 shadow-sm hover:shadow-md">
              Đăng ký
            </Link>
            <Link to="/login" className="bg-primary text-on-primary-fixed px-8 py-2.5 rounded-full font-headline font-bold hover:shadow-[0_0_30px_rgba(66,133,244,0.4)] hover:scale-105 transition-all duration-300 active:scale-95 relative overflow-hidden group/btn">
              <span className="relative z-10">Đăng nhập</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO SECTION */}
        <section id="platform" className="relative min-h-[921px] flex items-center overflow-hidden px-10 pt-20 pb-32">
          <div className="absolute inset-0 nebula-bg pointer-events-none"></div>
          <NeuralCanvas
            opacity={theme === 'dark' ? 0.7 : 0.4}
            nodeCount={120}
            speed={0.8}
            lineColor={theme === 'dark' ? 'rgba(66, 133, 244, 0.5)' : 'rgba(66, 133, 244, 0.25)'}
            nodeColor={theme === 'dark' ? 'rgba(66, 133, 244, 0.8)' : 'rgba(66, 133, 244, 0.5)'}
            glowColor={theme === 'dark' ? 'rgba(66, 133, 244, 0.2)' : 'rgba(66, 133, 244, 0.1)'}
          />
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10">
            {/* Left Content */}
            <div className="lg:col-span-5 flex flex-col items-start">
              <span className="text-primary font-bold tracking-widest text-xs uppercase mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_#fbb4ff]"></span>
                Hệ thống AI Agent Thông minh
              </span>
              <h1 className="font-headline text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-tighter text-on-surface mb-8">
                Soạn thảo văn bản <span className="text-gradient">chuẩn xác</span> bằng AI.
              </h1>
              <p className="text-on-surface-variant text-lg md:text-xl leading-relaxed mb-10 max-w-lg">
                Tự động hóa quy trình soạn thảo văn bản hành chính với công nghệ RAG. Nhận diện yêu cầu, truy xuất mẫu chuẩn và hoàn thiện file .docx chỉ trong vài giây.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/register" className="bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed px-8 py-4 rounded-full font-headline font-bold text-lg hover:shadow-[0_0_30px_rgba(133,173,255,0.3)] transition-all active:scale-95">
                  Trải nghiệm ngay
                </Link>
                <button className="bg-surface-container-highest/50 border border-outline-variant/20 text-on-surface px-8 py-4 rounded-full font-headline font-bold text-lg hover:bg-surface-container-highest transition-all active:scale-95 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">play_circle</span>
                  Xem Demo
                </button>
              </div>
            </div>

            {/* Right Mockup */}
            <div className="lg:col-span-7 relative">
              <div className="glass-panel rounded-xl p-4 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                <img
                  alt="Obsidian Dashboard"
                  className="rounded-lg w-full opacity-90 group-hover:opacity-100 transition-opacity duration-700"
                  data-alt="Modern dark UI dashboard for legal analysis featuring complex data charts, document preview panes, and a sleek sidebar interface"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCe30BKNuxGIQDOV-LplmJXzao_7-8fmrdB-LiXAmCP4QCKnQz1T7a6gxte6zMfAY4vgjqmUhg9Wd7552V5f0KQF31ujjN6fSEhHVlusilDSI5QC-TKRi5L0l9Q6R-EQx-g0_btoOnXlsDPsrn4dmYZilW-viF4YUypbNEPgsh_3VbXjxkeOS9uqiOZ92HfRk6-tMGkppDrMt_P2UbRRjpa7a2I_RcZLooAc3_KmifnulujoLA5OJW_dphTwEEtkA8gtVx5rV5lu8QE"
                />

                {/* Floating Accent UI - Refined & Elegant */}
                <div className="absolute bottom-6 right-6 glass-panel pl-4 pr-6 py-2.5 rounded-2xl shadow-2xl border-t border-l border-primary/40 hidden md:flex items-center gap-3 animate-float group/accent backdrop-blur-xl">
                  <div className="relative w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(66,133,244,0.3)]">
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                  <div className="relative">
                    <div className="text-[12px] font-bold text-on-surface flex items-center gap-1.5 whitespace-nowrap">
                      Đã đối chiếu mẫu
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-tertiary"></span>
                      </span>
                    </div>
                    <div className="text-[9px] text-on-surface-variant uppercase tracking-[0.05em] font-bold opacity-80 whitespace-nowrap">Nghị định 30/2020/NĐ-CP</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="bg-surface-container-lowest py-12 px-10 border-y border-outline-variant/10">
          <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            <span className="font-headline font-extrabold text-xl tracking-tighter text-on-surface">Cơ quan Nhà nước</span>
            <span className="font-headline font-extrabold text-xl tracking-tighter text-on-surface">Văn phòng Công chứng</span>
            <span className="font-headline font-extrabold text-xl tracking-tighter text-on-surface">Phòng Pháp chế Doanh nghiệp</span>
            <span className="font-headline font-extrabold text-xl tracking-tighter text-on-surface">Đơn vị Hành chính Công</span>
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section id="solutions" className="py-32 px-10 relative">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="font-headline text-4xl md:text-5xl font-bold text-on-surface mb-4">Quy trình thông minh</h2>
              <div className="w-24 h-1 bg-primary mx-auto rounded-full"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="glass-panel p-10 rounded-xl hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500 group">
                <div className="w-14 h-14 bg-primary-container/10 rounded-lg flex items-center justify-center mb-8 group-hover:bg-primary-container/20 transition-colors">
                  <span className="material-symbols-outlined text-primary text-3xl">psychology</span>
                </div>
                <h3 className="font-headline text-2xl font-bold text-on-surface mb-4">Nhận diện yêu cầu</h3>
                <p className="text-on-surface-variant leading-relaxed">Sử dụng NLP để phân tích ý định của người dùng, xác định chính xác loại văn bản hành chính cần soạn thảo.</p>
              </div>

              {/* Feature 2 */}
              <div className="glass-panel p-10 rounded-xl translate-y-4 hover:translate-y-[-4px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500 group">
                <div className="w-14 h-14 bg-secondary-container/10 rounded-lg flex items-center justify-center mb-8 group-hover:bg-secondary-container/20 transition-colors">
                  <span className="material-symbols-outlined text-secondary text-3xl">hub</span>
                </div>
                <h3 className="font-headline text-2xl font-bold text-on-surface mb-4">Truy xuất RAG</h3>
                <p className="text-on-surface-variant leading-relaxed">Tự động tìm kiếm mẫu văn bản và quy định pháp luật liên quan từ Vector Database để đảm bảo tính pháp lý.</p>
              </div>

              {/* Feature 3 */}
              <div className="glass-panel p-10 rounded-xl hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500 group">
                <div className="w-14 h-14 bg-tertiary-container/10 rounded-lg flex items-center justify-center mb-8 group-hover:bg-tertiary-container/20 transition-colors">
                  <span className="material-symbols-outlined text-tertiary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
                <h3 className="font-headline text-2xl font-bold text-on-surface mb-4">Tự động hoàn thiện</h3>
                <p className="text-on-surface-variant leading-relaxed">AI Agent trích xuất thông tin và điền vào biểu mẫu, sau đó xuất ra file .docx đúng quy chuẩn hành chính.</p>
              </div>
            </div>
          </div>
        </section>

        {/* BENEFITS GRID */}
        <section id="compliance" className="py-32 px-10 bg-surface-container-low">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Large Card: Focused Search */}
              <div className="md:col-span-8 glass-panel rounded-xl p-12 overflow-hidden relative group">
                <div className="relative z-10">
                  <h3 className="font-headline text-3xl font-bold text-on-surface mb-6">Tìm kiếm thông minh</h3>
                  <p className="text-on-surface-variant text-lg mb-8 max-w-md">Truy vấn toàn bộ kho dữ liệu văn bản bằng ngôn ngữ tự nhiên. Nhận câu trả lời tổng hợp chỉ trong vài giây.</p>
                  <div className="bg-surface-container-high rounded-lg p-4 border border-outline-variant/10 shadow-inner">
                    <div className="flex items-center gap-3 text-on-surface-variant text-sm mb-4">
                      <span className="material-symbols-outlined text-primary sm">search</span>
                      "Tìm các quyết định khen thưởng trong năm 2023"
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 w-3/4 bg-primary/20 rounded-full"></div>
                      <div className="h-2 w-full bg-primary/10 rounded-full"></div>
                      <div className="h-2 w-1/2 bg-primary/10 rounded-full"></div>
                    </div>
                  </div>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-20 pointer-events-none translate-x-1/4 translate-y-1/4 group-hover:scale-110 transition-transform duration-1000">
                  <img
                    alt="Network"
                    className="w-full h-full object-cover rounded-full"
                    data-alt="Abstract digital network visualization with glowing nodes and interconnecting lines representing complex data structures"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJB3su4nM6MBxrvljsHBqCMHVtwXJKhFfDVP-zy0ZKtOEoUgcaxppokvLq12-sNzEdGkei4bFz0oKXHiLzpylEAhRmm0N32MA5Jsj0H6JnfWkEnUWr-xtmTLr2i2joBj7aBLkKJfNALxBQ7pf19QqHvrKg4SUIc68ECXcUJFW5IB4MyYjIOL6NfLwy8yFK3-3w4KQKo4Smbyim7i4-zyrl3F7ewMlYbdcy4Ys8qNdla6R9sxb3CYV-qZKmX-ukuPGJ2wdn-e-uw-C-"
                  />
                </div>
              </div>

              {/* Medium Card: Organized History */}
              <div className="md:col-span-4 bg-surface-container-highest rounded-xl p-10 flex flex-col justify-between">
                <div>
                  <span className="material-symbols-outlined text-secondary mb-6">history</span>
                  <h3 className="font-headline text-2xl font-bold text-on-surface mb-4">Lịch sử tổ chức</h3>
                </div>
                <p className="text-on-surface-variant">Truy cập mọi bản phân tích trước đó, nhật ký rà soát và trạng thái workspace với độ chính xác cao.</p>
              </div>

              {/* Medium Card: Fast Workflow */}
              <div className="md:col-span-4 bg-surface-container-highest rounded-xl p-10 flex flex-col justify-between">
                <div>
                  <span className="material-symbols-outlined text-tertiary mb-6">monitoring</span>
                  <h3 className="font-headline text-2xl font-bold text-on-surface mb-4">Quy trình thần tốc</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-end gap-1 h-12">
                    <div className="w-full bg-tertiary/20 h-1/4 rounded-sm"></div>
                    <div className="w-full bg-tertiary/40 h-2/4 rounded-sm"></div>
                    <div className="w-full bg-tertiary/60 h-3/4 rounded-sm"></div>
                    <div className="w-full bg-tertiary h-full rounded-sm"></div>
                  </div>
                  <p className="text-on-surface-variant">Tăng tốc chu kỳ soạn thảo và rà soát văn bản lên đến 70% với sự hỗ trợ của AI.</p>
                </div>
              </div>

              {/* Large Card: Traceable References */}
              <div className="md:col-span-8 glass-panel rounded-xl p-12 overflow-hidden flex flex-col md:flex-row gap-12 items-center">
                <div className="flex-1">
                  <h3 className="font-headline text-3xl font-bold text-on-surface mb-6">Minh bạch nguồn gốc</h3>
                  <p className="text-on-surface-variant text-lg">Click vào bất kỳ tóm tắt nào do AI tạo ra để xem ngay văn bản nguồn trong PDF gốc. Tin tưởng nhưng có đối chiếu.</p>
                </div>
                <div className="flex-1 relative">
                  <div className="bg-surface-container-high p-4 rounded-lg border border-outline-variant/10 rotate-3 shadow-xl">
                    <div className="text-[10px] text-on-surface-variant space-y-1 mb-4">
                      <div className="bg-primary/20 p-1 px-2 rounded">...the indemnification clause shall be limited to...</div>
                      <div className="bg-surface-container p-1 px-2 rounded opacity-50">...notwithstanding any prior agreements between...</div>
                      <div className="bg-surface-container p-1 px-2 rounded opacity-30">...this contract is governed by the laws of...</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-[12px] text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>anchor</span>
                      </div>
                      <span className="text-[10px] text-on-surface font-bold">Ref: Page 42, Para 4</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* METRICS SECTION */}
        <section id="security" className="py-24 px-10">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="font-headline text-6xl font-black text-primary mb-2">70%</div>
              <div className="text-on-surface-variant uppercase tracking-[0.2em] font-bold text-xs">Tiết kiệm thời gian</div>
            </div>
            <div>
              <div className="font-headline text-6xl font-black text-secondary mb-2">100%</div>
              <div className="text-on-surface-variant uppercase tracking-[0.2em] font-bold text-xs">Đúng thể thức</div>
            </div>
            <div>
              <div className="font-headline text-6xl font-black text-tertiary mb-2">50+</div>
              <div className="text-on-surface-variant uppercase tracking-[0.2em] font-bold text-xs">Mẫu văn bản chuẩn</div>
            </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="px-10 pb-32">
          <div className="max-w-7xl mx-auto rounded-xl bg-gradient-to-br from-surface-container-high to-surface-container-lowest p-20 text-center relative overflow-hidden border border-outline-variant/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50"></div>
            <NeuralCanvas
              opacity={0.6}
              nodeCount={60}
              speed={1.2}
              lineColor="rgba(66, 133, 244, 0.4)"
              nodeColor="rgba(66, 133, 244, 0.7)"
              glowColor="rgba(66, 133, 244, 0.15)"
            />
            <div className="relative z-10">
              <h2 className="font-headline text-4xl md:text-6xl font-extrabold text-on-surface mb-10 max-w-3xl mx-auto leading-tight">
                Sẵn sàng hiện đại hóa quy trình soạn thảo của bạn?
              </h2>
              <Link to="/login" className="bg-primary text-on-primary-fixed hover:shadow-[0_0_50px_rgba(66,133,244,0.4)] hover:scale-105 transition-all duration-300 font-headline font-black px-12 py-5 rounded-full text-xl active:scale-95 inline-block relative overflow-hidden group/cta">
                <span className="relative z-10">Đăng nhập ngay</span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/cta:translate-y-0 transition-transform duration-300"></div>
              </Link>
              <p className="mt-8 text-on-surface-variant font-medium">Hỗ trợ triển khai cho cơ quan nhà nước và doanh nghiệp.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-low w-full py-20 px-10 border-t border-outline-variant/10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-7xl mx-auto">
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <img src="/favicon.svg" alt="RAG AI Logo" className="w-8 h-8 opacity-90" />
              <div className="text-xl font-black font-headline text-on-surface">RAG AI</div>
            </div>
            <p className="text-on-surface-variant font-body text-sm tracking-wide max-w-xs">
              Kiến tạo tương lai hành chính số với trí tuệ nhân tạo chuẩn xác và bảo mật tuyệt đối.
            </p>
            <div className="text-on-surface-variant font-body text-sm tracking-wide mt-10">
              © 2026 RagDrafting AI. Một sản phẩm của khóa học Quản lý dự án.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <h4 className="text-on-surface font-bold font-headline">Sản phẩm</h4>
              <a className="text-on-surface-variant font-body text-sm tracking-wide hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Tính năng</a>
              <a className="text-on-surface-variant font-body text-sm tracking-wide hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Bảo mật</a>
              <a className="text-on-surface-variant font-body text-sm tracking-wide hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Bảng giá</a>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="text-on-surface font-bold font-headline">Pháp lý</h4>
              <a className="text-on-surface-variant font-body text-sm tracking-wide hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Chính sách bảo mật</a>
              <a className="text-on-surface-variant font-body text-sm tracking-wide hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Điều khoản sử dụng</a>
              <a className="text-on-surface-variant font-body text-sm tracking-wide hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Liên hệ hỗ trợ</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
