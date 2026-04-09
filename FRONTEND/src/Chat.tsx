import React from 'react';
import {
  Code2,
  Compass,
  History,
  MessageSquare,
  Palette,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react';
import ChatComposer from './components/ChatComposer';
import UserShell from './components/UserShell';

export default function Chat() {
  return (
    <UserShell activeNav="chat" showProBadge>
      <div className="relative h-full flex flex-col">
        {/* Chat Area */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 pb-24 overflow-y-auto">
          <div className="w-full max-w-4xl text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-extrabold font-headline mb-4 bg-gradient-to-r from-on-surface via-on-surface to-primary bg-clip-text text-transparent">
              How can I help you today?
            </h1>
            <p className="text-on-surface-variant text-lg max-w-2xl mx-auto font-body">
              Harness the power of Obsidian Nebula to build, create, and solve. What's on your mind?
            </p>
          </div>
          {/* Suggestion Bento Grid */}
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
            <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                <Palette className="w-5 h-5" />
              </div>
              <p className="font-semibold text-sm mb-1">Create Image</p>
              <p className="text-on-surface-variant text-xs leading-relaxed">Visualise concepts with DALL-E 3</p>
            </div>
            <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center mb-4 text-secondary group-hover:scale-110 transition-transform">
                <Code2 className="w-5 h-5" />
              </div>
              <p className="font-semibold text-sm mb-1">Code Assistant</p>
              <p className="text-on-surface-variant text-xs leading-relaxed">Debug and optimize architecture</p>
            </div>
            <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
              <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center mb-4 text-tertiary group-hover:scale-110 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="font-semibold text-sm mb-1">Content Writer</p>
              <p className="text-on-surface-variant text-xs leading-relaxed">Draft professional narratives</p>
            </div>
            <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
              <div className="w-10 h-10 rounded-full bg-primary-fixed-dim/10 flex items-center justify-center mb-4 text-primary-fixed-dim group-hover:scale-110 transition-transform">
                <Compass className="w-5 h-5" />
              </div>
              <p className="font-semibold text-sm mb-1">Plan a Trip</p>
              <p className="text-on-surface-variant text-xs leading-relaxed">Curated travel itineraries</p>
            </div>
          </div>
          <ChatComposer />
        </section>
        {/* Subtle Ambient Background Decorations */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-tertiary/5 rounded-full blur-[120px] -z-10"></div>
      </div>
      {/* Mobile BottomNavBar (Visible only on mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full glass-morphism border-t border-outline-variant/10 flex justify-around items-center h-20 px-4 z-50">
        <a className="flex flex-col items-center gap-1 text-primary" href="#">
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-bold">Chat</span>
        </a>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <History className="w-5 h-5" />
          <span className="text-[10px] font-bold">History</span>
        </a>
        <div className="relative -top-6">
          <button className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-container shadow-xl shadow-primary/20 flex items-center justify-center text-on-primary-fixed">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] font-bold">Explore</span>
        </a>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-bold">Menu</span>
        </a>
      </nav>
    </UserShell>
  );
}
