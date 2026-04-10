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
  const menuRef = useRef<HTMLDivElement>(null);

  // Removed outside click listener state

  const navItems = [
    { id: 'dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
    { id: 'knowledge', label: 'Cơ sở tri thức', icon: Database },
    { id: 'mlops', label: 'Cấu hình MLOps', icon: Settings2 },
    { id: 'users', label: 'Quản lý người dùng', icon: BrainCircuit }, // Using BrainCircuit for user management as per image vibe
    { id: 'health', label: 'Tình trạng hệ thống', icon: Activity },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <aside className="flex flex-col h-screen w-64 bg-surface-low py-6 px-4 fixed left-0 top-0 z-40 border-r-0">
      <div className="mb-10 flex items-center gap-3 px-2">
        <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <Hexagon className="text-surface w-6 h-6 fill-current" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface leading-none font-headline">RAG AI</h1>
          <p className="text-[10px] text-on-surface-variant tracking-widest uppercase mt-1 font-bold">Bảng điều khiển quản trị</p>
        </div>
      </div>

      <button className="mb-8 w-full py-3 px-4 rounded-full gradient-primary text-surface font-bold flex items-center justify-center gap-2 hover:scale-[0.98] transition-transform duration-100 shadow-lg shadow-primary/10">
        <Plus className="w-5 h-5" />
        <span className="text-sm">Thử nghiệm mới</span>
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
                : "text-on-surface-variant hover:bg-surface-highest/50 hover:backdrop-blur-xl hover:text-on-surface hover:shadow-sm"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeView === item.id && "fill-primary/10")} />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-outline-variant">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant shrink-0">
            <img 
              src="https://picsum.photos/seed/admin/100/100" 
              alt="User" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-on-surface truncate">Adrian Valerius</h4>
            <p className="text-xs text-on-surface-variant truncate">Quản trị viên Stratos</p>
          </div>
        </div>
        <button 
          className="w-full mt-2 flex items-center justify-center gap-2 px-2 py-2.5 text-sm rounded-xl text-error bg-error/10 hover:bg-error hover:text-on-error transition-all font-bold tracking-wide"
        >
          <LogOut className="w-4 h-4" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
