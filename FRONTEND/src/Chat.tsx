import React from 'react';
import { Link } from 'react-router-dom';

export default function Chat() {
  return (
    <div className="bg-background text-on-background font-body min-h-screen flex overflow-hidden w-full">
      {/* Shared SideNavBar */}
      <aside className="hidden md:flex h-screen w-72 flex-col bg-[#131313] py-6 px-4 shrink-0">
        <div className="flex items-center gap-3 px-4 mb-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-fixed text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#85ADFF] font-headline">Obsidian AI</span>
        </div>
        <button className="flex items-center gap-3 w-full px-5 py-4 mb-8 bg-surface-container-highest rounded-full transition-transform active:scale-95 group">
          <span className="material-symbols-outlined text-primary">add</span>
          <span className="font-semibold text-primary font-label">New Chat</span>
        </button>
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest px-4 mb-2">Recent Chats</span>
          <a className="flex items-center gap-3 px-4 py-3 text-[#85ADFF] font-semibold bg-[#262626] rounded-full transition-colors duration-200" href="#">
            <span className="material-symbols-outlined text-xl">chat_bubble</span>
            <span className="text-sm truncate font-label">Recent Chat 1</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-[#ADAAAA] hover:text-white hover:bg-[#1A1919] transition-colors duration-200 rounded-full" href="#">
            <span className="material-symbols-outlined text-xl">chat_bubble</span>
            <span className="text-sm truncate font-label">Recent Chat 2</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-[#ADAAAA] hover:text-white hover:bg-[#1A1919] transition-colors duration-200 rounded-full" href="#">
            <span className="material-symbols-outlined text-xl">chat_bubble</span>
            <span className="text-sm truncate font-label">Recent Chat 3</span>
          </a>
        </div>
        <div className="mt-auto pt-6 border-t border-outline-variant/10 flex flex-col gap-1">
          <a className="flex items-center gap-3 px-4 py-3 text-[#ADAAAA] hover:text-white hover:bg-[#1A1919] transition-colors duration-200 rounded-full" href="#">
            <span className="material-symbols-outlined text-xl">history</span>
            <span className="text-sm font-label">Activity</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-[#ADAAAA] hover:text-white hover:bg-[#1A1919] transition-colors duration-200 rounded-full" href="#">
            <span className="material-symbols-outlined text-xl">help</span>
            <span className="text-sm font-label">Help</span>
          </a>
          <Link className="flex items-center gap-3 px-4 py-3 text-[#ADAAAA] hover:text-white hover:bg-[#1A1919] transition-colors duration-200 rounded-full" to="/settings">
            <span className="material-symbols-outlined text-xl">settings</span>
            <span className="text-sm font-label">Settings</span>
          </Link>
        </div>
      </aside>
      <main className="flex-1 flex flex-col relative h-screen">
        {/* Shared TopNavBar */}
        <header className="flex justify-between items-center px-8 w-full h-16 z-40 sticky top-0 bg-[#0E0E0E]/80 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-white font-headline">Obsidian Architect</span>
            <span className="bg-tertiary/10 text-tertiary text-[10px] font-bold px-2 py-0.5 rounded-full border border-tertiary/20">PRO</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-[#ADAAAA] hover:opacity-80 transition-opacity">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="relative group">
              <button className="p-2 text-primary hover:opacity-80 transition-opacity">
                <span className="material-symbols-outlined">dark_mode</span>
              </button>
              <div className="absolute right-0 mt-2 w-36 bg-surface-container-highest rounded-xl shadow-2xl border border-outline-variant/10 py-2 hidden group-hover:block z-50">
                <button className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">light_mode</span> Light
                </button>
                <button className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2 text-primary bg-white/5">
                  <span className="material-symbols-outlined text-lg">dark_mode</span> Dark
                </button>
                <button className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">settings_brightness</span> System
                </button>
              </div>
            </div>
            <div className="w-9 h-9 rounded-full overflow-hidden ml-2 ring-2 ring-primary/20 cursor-pointer">
              <img alt="User Avatar" className="w-full h-full object-cover" data-alt="portrait of a focused creative professional man in a minimal workspace with soft moody cinematic lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBcSjUBE8LH5O63KqcP3aROM383TpgfA5tV5blSxM-EzmlqczeTqLE_fKZv7iSuCRO0tKNJbLgjlN4DYBoULSoPdZqopLUC2juE_Y_46uA5FDZnrbxwFOy1uLhmWV2FDeLJOI0EtYXD-ZK_L6wy52YhnCCQWrK3nUOfrFOOje6HWZsf8yU0L6yTvaI9YC8UybAOCduhonpOUjbRYjXv4-s_8uoyEXxv7Jiz3cDEHTfofAYLHFbDl3iEscpaG9R8pXTRpIwkJIzOwqHg"/>
            </div>
          </div>
        </header>
        {/* Chat Area */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 pb-24 overflow-y-auto">
          <div className="w-full max-w-4xl text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-extrabold font-headline mb-4 bg-gradient-to-r from-white via-white to-primary-dim bg-clip-text text-transparent">
              How can I help you today?
            </h1>
            <p className="text-on-surface-variant text-lg max-w-2xl mx-auto font-body">
              Harness the power of Obsidian AI to build, create, and solve. What's on your mind?
            </p>
          </div>
          {/* Suggestion Bento Grid */}
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
            <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">palette</span>
              </div>
              <p className="font-semibold text-sm mb-1">Create Image</p>
              <p className="text-on-surface-variant text-xs leading-relaxed">Visualise concepts with DALL-E 3</p>
            </div>
            <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center mb-4 text-secondary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">code</span>
              </div>
              <p className="font-semibold text-sm mb-1">Code Assistant</p>
              <p className="text-on-surface-variant text-xs leading-relaxed">Debug and optimize architecture</p>
            </div>
            <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
              <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center mb-4 text-tertiary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">history_edu</span>
              </div>
              <p className="font-semibold text-sm mb-1">Content Writer</p>
              <p className="text-on-surface-variant text-xs leading-relaxed">Draft professional narratives</p>
            </div>
            <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
              <div className="w-10 h-10 rounded-full bg-primary-fixed-dim/10 flex items-center justify-center mb-4 text-primary-fixed-dim group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">explore</span>
              </div>
              <p className="font-semibold text-sm mb-1">Plan a Trip</p>
              <p className="text-on-surface-variant text-xs leading-relaxed">Curated travel itineraries</p>
            </div>
          </div>
          {/* Input Bar */}
          <div className="w-full max-w-3xl sticky bottom-4">
            <div className="glass-morphism rounded-full p-2 flex items-center gap-2 border border-outline-variant/15 focus-within:ring-4 focus-within:ring-primary/10 transition-all">
              <button className="p-3 text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">add_circle</span>
              </button>
              <input className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder:text-on-surface-variant font-body py-3 outline-none" placeholder="Message Obsidian Architect..." type="text"/>
              <div className="flex items-center gap-1 px-2">
                <button className="p-2 text-on-surface-variant hover:text-white transition-colors">
                  <span className="material-symbols-outlined">mic</span>
                </button>
                <button className="p-2 text-on-surface-variant hover:text-white transition-colors">
                  <span className="material-symbols-outlined">image</span>
                </button>
                <button className="p-2 text-on-surface-variant hover:text-white transition-colors">
                  <span className="material-symbols-outlined">grid_view</span>
                </button>
              </div>
              <button className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary-fixed hover:opacity-90 transition-opacity active:scale-95">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_forward</span>
              </button>
            </div>
            <p className="text-center text-[10px] text-on-surface-variant/60 mt-4 uppercase tracking-[0.2em] font-label">
              Obsidian AI can make mistakes. Verify important info.
            </p>
          </div>
        </section>
        {/* Subtle Ambient Background Decorations */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-tertiary/5 rounded-full blur-[120px] -z-10"></div>
      </main>
      {/* Mobile BottomNavBar (Visible only on mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full glass-morphism border-t border-outline-variant/10 flex justify-around items-center h-20 px-4 z-50">
        <a className="flex flex-col items-center gap-1 text-primary" href="#">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
          <span className="text-[10px] font-bold">Chat</span>
        </a>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <span className="material-symbols-outlined">history</span>
          <span className="text-[10px] font-bold">History</span>
        </a>
        <div className="relative -top-6">
          <button className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-container shadow-xl shadow-primary/20 flex items-center justify-center text-on-primary-fixed">
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <span className="material-symbols-outlined">auto_awesome</span>
          <span className="text-[10px] font-bold">Explore</span>
        </a>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[10px] font-bold">Menu</span>
        </a>
      </nav>
    </div>
  );
}
