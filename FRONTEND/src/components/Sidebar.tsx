import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Settings2, 
  BrainCircuit, 
  Activity, 
  Settings, 
  Plus, 
  HelpCircle, 
  FileText,
  Hexagon,
  LogOut,
  User
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export type ViewType = 'dashboard' | 'knowledge' | 'mlops' | 'users' | 'health' | 'settings' | 'help' | 'docs';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'knowledge', label: 'Knowledge Base', icon: Database },
    { id: 'mlops', label: 'MLOps Config', icon: Settings2 },
    { id: 'users', label: 'User Management', icon: BrainCircuit }, // Using BrainCircuit for user management as per image vibe
    { id: 'health', label: 'System Health', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="flex flex-col h-screen w-64 bg-surface-low py-6 px-4 fixed left-0 top-0 z-40 border-r-0">
      <div className="mb-10 flex items-center gap-3 px-2">
        <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <Hexagon className="text-surface w-6 h-6 fill-current" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface leading-none font-headline">Obsidian AI</h1>
          <p className="text-[10px] text-on-surface-variant tracking-widest uppercase mt-1 font-bold">Admin Console</p>
        </div>
      </div>

      <button className="mb-8 w-full py-3 px-4 rounded-full gradient-primary text-surface font-bold flex items-center justify-center gap-2 hover:scale-[0.98] transition-transform duration-100 shadow-lg shadow-primary/10">
        <Plus className="w-5 h-5" />
        <span className="text-sm">New Experiment</span>
      </button>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id as ViewType)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              activeView === item.id 
                ? "bg-surface-highest text-primary font-bold shadow-sm" 
                : "text-on-surface-variant hover:bg-surface-highest/50 hover:text-on-surface"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeView === item.id && "fill-primary/10")} />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-outline-variant/10 relative" ref={menuRef}>
        {showUserMenu && (
          <div className="absolute bottom-full left-0 mb-2 w-full bg-surface-highest border border-outline-variant/20 rounded-xl shadow-xl overflow-hidden py-1 z-50">
            <button 
              onClick={() => { onViewChange('settings'); setShowUserMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-high transition-colors"
            >
              <User className="w-4 h-4" /> Profile & Settings
            </button>
            <div className="h-px bg-outline-variant/10 my-1"></div>
            <button 
              onClick={() => setShowUserMenu(false)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-surface-high transition-colors font-medium"
            >
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
        )}
        <div 
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-highest/50 transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant/20 shrink-0">
            <img 
              src="https://picsum.photos/seed/admin/100/100" 
              alt="User" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-on-surface truncate">Adrian Valerius</h4>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest truncate">Admin Stratos</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
