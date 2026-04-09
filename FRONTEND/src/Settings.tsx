import React from 'react';
import { Link } from 'react-router-dom';
import './styles/chat-auth.css';

export default function Settings() {
  return (
    <div className="bg-background text-on-surface font-body overflow-hidden h-screen flex w-full">
      {/* SideNavBar Component */}
      <aside className="bg-[#131313] h-screen w-72 flex flex-col transition-all duration-200 flex-shrink-0">
        <div className="flex flex-col h-full py-6 px-4">
          {/* Header */}
          <div className="mb-8 px-2">
            <h1 className="text-xl font-bold tracking-tight text-[#85ADFF] font-headline">Obsidian AI</h1>
            <p className="text-[10px] uppercase tracking-widest text-[#ADAAAA] font-medium mt-1">Pro Workspace</p>
          </div>
          {/* CTA */}
          <button className="mb-8 w-full py-3 px-4 bg-gradient-to-r from-primary to-primary-container text-on-primary-fixed font-bold rounded-full flex items-center justify-center gap-2 scale-98-on-click transition-transform">
            <span className="material-symbols-outlined text-sm">add</span>
            <span className="font-label">New Chat</span>
          </button>
          {/* Navigation Scrollable */}
          <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
            <div className="text-[#ADAAAA] text-[11px] font-bold px-3 mb-2 uppercase tracking-wider">Recent</div>
            <Link className="flex items-center gap-3 px-3 py-2 text-[#ADAAAA] hover:text-white hover:bg-[#1A1919] transition-colors duration-200 rounded-full group" to="/chat">
              <span className="material-symbols-outlined text-xl">chat_bubble</span>
              <span className="font-label text-sm truncate">Recent Chat 1</span>
            </Link>
            <Link className="flex items-center gap-3 px-3 py-2 text-[#ADAAAA] hover:text-white hover:bg-[#1A1919] transition-colors duration-200 rounded-full group" to="/chat">
              <span className="material-symbols-outlined text-xl">chat_bubble</span>
              <span className="font-label text-sm truncate">Recent Chat 2</span>
            </Link>
            <Link className="flex items-center gap-3 px-3 py-2 text-[#ADAAAA] hover:text-white hover:bg-[#1A1919] transition-colors duration-200 rounded-full group" to="/chat">
              <span className="material-symbols-outlined text-xl">chat_bubble</span>
              <span className="font-label text-sm truncate">Recent Chat 3</span>
            </Link>
            <div className="my-6 border-t border-outline-variant/10"></div>
            <a className="flex items-center gap-3 px-3 py-2 text-[#ADAAAA] hover:text-white hover:bg-[#1A1919] transition-colors duration-200 rounded-full group" href="#">
              <span className="material-symbols-outlined text-xl">help</span>
              <span className="font-label text-sm">Help</span>
            </a>
            {/* Active Tab: Settings */}
            <a className="flex items-center gap-3 px-3 py-2 text-[#85ADFF] font-semibold bg-[#262626] rounded-full scale-98-on-click transition-transform" href="#">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>settings</span>
              <span className="font-label text-sm">Settings</span>
            </a>
          </nav>
          {/* Footer Tabs */}
          <div className="mt-auto pt-6 space-y-1 border-t border-outline-variant/10">
            <a className="flex items-center gap-3 px-3 py-2 text-[#ADAAAA] hover:text-white hover:bg-[#1A1919] transition-colors duration-200 rounded-full" href="#">
              <span className="material-symbols-outlined text-xl">history</span>
              <span className="font-label text-sm">Activity</span>
            </a>
            <a className="flex items-center gap-3 px-3 py-2 text-[#ADAAAA] hover:text-white hover:bg-[#1A1919] transition-colors duration-200 rounded-full" href="#">
              <span className="material-symbols-outlined text-xl">delete</span>
              <span className="font-label text-sm">Trash</span>
            </a>
          </div>
        </div>
      </aside>
      {/* Main Content Canvas */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* TopNavBar Component */}
        <header className="bg-[#0E0E0E]/80 backdrop-blur-xl flex justify-between items-center px-8 w-full z-40 sticky top-0 h-16 transition-all">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-white font-headline">Obsidian Architect</span>
          </div>
          <div className="flex items-center gap-6">
            <button className="text-[#ADAAAA] hover:opacity-80 transition-all">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="text-[#ADAAAA] hover:text-white transition-all flex items-center justify-center p-1 rounded-full hover:bg-surface-container-highest group" title="Toggle Appearance Mode">
              <span className="material-symbols-outlined text-xl group-active:rotate-90 transition-transform duration-300">settings_brightness</span>
            </button>
            <div className="h-8 w-8 rounded-full overflow-hidden border border-outline-variant/20">
              <img alt="User Avatar" className="w-full h-full object-cover" data-alt="Modern close-up portrait of a creative professional with neutral expression, dramatic high-contrast lighting on dark background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwzC4GqZ5nOtocUP6oEN-QuBq3cPu3axVnOx_5yZPvZnNz1VDFMOM7oicoCh_otvSncFLpFZWHoA0_YDw0HSBoSGZz8uGtHX1arWveaWqX2j3oqRRiMEa0CexySReM5WVlQ6NNcKCts8SS1gweKpHfH0kBtEdGfBa-TFk3DJ9UWA-W5zAdb62-jhY5ZWjrzMO71UaUWxKv9uV9tLEbFKzeQRlv_IvVABhvp1wWzbJf0m4boeZZ1qm_VHzHPCOo-j29_hyQ78kCgL53"/>
            </div>
          </div>
        </header>
        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-12 py-10">
          <div className="max-w-6xl mx-auto grid grid-cols-12 gap-10">
            {/* Left: Settings Navigation & Fields */}
            <div className="col-span-7 space-y-12">
              <section>
                <h2 className="text-4xl font-extrabold font-headline mb-8 tracking-tight">Settings</h2>
                <div className="flex gap-2 p-1 bg-surface-container rounded-full w-max mb-10">
                  <button className="px-6 py-2 bg-surface-variant text-primary font-semibold rounded-full text-sm">Account</button>
                  <button className="px-6 py-2 text-on-surface-variant hover:text-white transition-colors text-sm">Data &amp; Privacy</button>
                  <button className="px-6 py-2 text-on-surface-variant hover:text-white transition-colors text-sm">Security</button>
                  <button className="px-6 py-2 text-on-surface-variant hover:text-white transition-colors text-sm">Billing</button>
                </div>
                <div className="space-y-8">
                  {/* Setting Group: Appearance */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Appearance</h3>
                    <div className="flex items-center justify-between p-5 bg-surface-container-low rounded-lg transition-all hover:bg-surface-container">
                      <div>
                        <p className="font-semibold text-on-surface">Theme Mode</p>
                        <p className="text-sm text-on-surface-variant">Switch between Obsidian Dark and Bright modes</p>
                      </div>
                      <div className="flex bg-surface-container-highest p-1 rounded-full">
                        <button className="px-4 py-1.5 bg-primary text-on-primary-fixed rounded-full text-xs font-bold">Dark</button>
                        <button className="px-4 py-1.5 text-on-surface-variant text-xs font-bold">Light</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-5 bg-surface-container-low rounded-lg transition-all hover:bg-surface-container">
                      <div>
                        <p className="font-semibold text-on-surface">Glassmorphism Effects</p>
                        <p className="text-sm text-on-surface-variant">Enable translucent surface textures</p>
                      </div>
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input defaultChecked className="sr-only peer" type="checkbox"/>
                        <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </div>
                    </div>
                  </div>
                  {/* Setting Group: Language */}
                  <div className="space-y-4 pt-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">General</h3>
                    <div className="flex items-center justify-between p-5 bg-surface-container-low rounded-lg transition-all hover:bg-surface-container">
                      <div>
                        <p className="font-semibold text-on-surface">Language</p>
                        <p className="text-sm text-on-surface-variant">Primary interface language</p>
                      </div>
                      <div className="flex items-center gap-2 text-on-surface-variant hover:text-white cursor-pointer px-4 py-2 border border-outline-variant/20 rounded-xl">
                        <span className="text-sm font-medium">English (US)</span>
                        <span className="material-symbols-outlined text-lg">unfold_more</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-5 bg-surface-container-low rounded-lg transition-all hover:bg-surface-container">
                      <div>
                        <p className="font-semibold text-on-surface">Auto-Update</p>
                        <p className="text-sm text-on-surface-variant">Keep workspace architect tools up to date</p>
                      </div>
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input defaultChecked className="sr-only peer" type="checkbox"/>
                        <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            {/* Right: Profile Summary */}
            <div className="col-span-5">
              <div className="sticky top-0 space-y-6">
                <div className="glass-panel p-8 rounded-xl border border-outline-variant/10">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-6">
                      <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-primary/20 ring-offset-4 ring-offset-background">
                        <img alt="User Profile" className="w-full h-full object-cover" data-alt="Close-up studio portrait of a man with minimalist aesthetic, soft rim lighting, dark high-fashion editorial style" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBns5ScLKa66Ok8tDJVg5SkfTUAGzeBGqhYQI4dheTUax5wq899jKZlhigJbwcibDRmxQvTDY0DT64a465wPOgiRc8Eke8um_QZxIEbQYime9MclEumbKgiAyLIMIQXOFZjcRW26kdY5Y6moQi5msJRvJ2VYcEbdfQLY2OcFI6QzmfbJp-uIziGNVeWdadP3KWERDvYt3-XDAZS2lIr-b-2wbkmhvoLDwdPmSlPOU2qjSu07eG-XnjESqY0aUScL1hznpGQ1ABLu8hS"/>
                      </div>
                      <button className="absolute bottom-1 right-1 bg-primary p-2 rounded-full text-on-primary-fixed shadow-xl">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                    </div>
                    <h3 className="text-2xl font-bold font-headline mb-1">Julian Thorne</h3>
                    <p className="text-on-surface-variant text-sm mb-6">julian.thorne@obsidian.arch</p>
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-secondary/10 border border-secondary/20 text-secondary rounded-full text-xs font-bold uppercase tracking-widest">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      Pro Member
                    </div>
                  </div>
                  <div className="mt-10 space-y-6 border-t border-outline-variant/10 pt-8">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-on-surface-variant">Storage</span>
                      <span className="text-sm font-semibold">12.4 GB / 100 GB</span>
                    </div>
                    <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: '12.4%' }}></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 text-center">
                        <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Tokens Used</p>
                        <p className="text-lg font-bold font-headline">1.2M</p>
                      </div>
                      <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 text-center">
                        <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Models Active</p>
                        <p className="text-lg font-bold font-headline">4</p>
                      </div>
                    </div>
                  </div>
                  <button className="w-full mt-10 py-4 bg-surface-container-highest hover:bg-surface-variant transition-colors rounded-xl font-bold text-sm border border-outline-variant/10 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined">logout</span>
                    Sign Out
                  </button>
                </div>
                {/* Ad/Promo Surface */}
                <div className="relative overflow-hidden rounded-xl h-48 bg-surface-container-low group">
                  <div className="absolute inset-0 opacity-40">
                    <img alt="Abstract decorative" className="w-full h-full object-cover" data-alt="Fluid abstract 3D wave pattern with iridescent blue and purple highlights on a deep obsidian black background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB9y9fAQ6iMVPw7ZbyHLW7FtF2Leos96ldkghqXt5YcSTmbE81-zbsu49HjgpkojDHWtwpdX9hmB9HyVxu4OiFjrw1xsDYAq37542UXCeug2gZd3snpACUXljYm6Z0hgQSz6NNeW-Gk9pxgKrHonAY3P8Tj7O1m8Rl2_zKG94LtQ-mWPgey5Cm0eY05_hQEAe2k2-uvto81DFfLfajceqCqUuh4-5CA3Nf7wHQfz0VCwiLYKuvmQgzb56oD4xkFBrbWGrdyo_rYrss8"/>
                  </div>
                  <div className="relative z-10 p-6 h-full flex flex-col justify-between">
                    <div>
                      <h4 className="text-lg font-bold font-headline leading-tight">Architect<br/>Enterprise</h4>
                      <p className="text-xs text-on-surface-variant mt-1">Scale your team workflow</p>
                    </div>
                    <button className="w-max px-6 py-2 bg-white text-black font-bold rounded-full text-xs scale-98-on-click transition-transform">
                      Upgrade Plan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* Luminous Typing Indicator (Floating Hidden Context) */}
      <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3 glass-panel px-4 py-2 rounded-full border border-outline-variant/20 shadow-2xl">
        <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_rgba(251,180,255,0.8)]"></div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">System Ready</span>
      </div>
    </div>
  );
}
