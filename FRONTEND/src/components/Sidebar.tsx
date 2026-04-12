import React, { useState } from 'react';
import {
  LayoutDashboard,
  Database,
  Settings2,
  BrainCircuit,
  Bot,
  Activity,
  Settings,
  Plus,
  Hexagon,
  LogOut,
  AlertTriangle,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';

export type ViewType = 'dashboard' | 'knowledge' | 'prompt' | 'monitoring' | 'users' | 'health' | 'settings' | 'help' | 'docs';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
    { id: 'knowledge', label: 'Cơ sở tri thức', icon: Database },
    { id: 'prompt', label: 'Cấu Hình Lệnh Mẫu', icon: BrainCircuit },
    { id: 'monitoring', label: 'Theo dõi AI', icon: Bot },
    { id: 'users', label: 'Quản lý người dùng', icon: Settings2 },
    { id: 'health', label: 'Tình trạng hệ thống', icon: Activity },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    // Small delay for UX feedback before navigating away
    await new Promise((res) => setTimeout(res, 400));
    logout();
    navigate('/login', { replace: true });
  };

  // Derive display name and avatar initials from user object
  const displayName = user?.username ?? 'Quản trị viên';
  const avatarInitials = displayName.slice(0, 2).toUpperCase();
  const avatarSeed = user?.id ?? 'admin';

  return (
    <>
      <aside className="flex flex-col h-screen w-64 bg-surface-low py-5 px-4 fixed left-0 top-0 z-40 border-r-0">
        {/* Logo */}
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Hexagon className="text-surface w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-on-surface leading-none font-headline">RAG AI ADMIN</h1>
            <p className="text-[9px] text-on-surface-variant tracking-[0.15em] uppercase mt-0.5 font-bold">Control Panel</p>
          </div>
        </div>

        {/* Navigation */}
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
              <item.icon className={cn("w-5 h-5 shrink-0", activeView === item.id && "fill-primary/10")} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User footer */}
        <div className="mt-auto pt-6 border-t border-outline-variant">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant shrink-0 bg-primary/10 flex items-center justify-center">
              {user ? (
                <span className="text-sm font-bold text-primary select-none">{avatarInitials}</span>
              ) : (
                <img
                  src={`https://picsum.photos/seed/${avatarSeed}/100/100`}
                  alt="User"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-on-surface truncate">{displayName}</h4>
              <p className="text-xs text-on-surface-variant truncate capitalize">{user?.role ?? 'Quản trị viên'}</p>
            </div>
          </div>

          <button
            onClick={handleLogoutConfirm}
            disabled={isLoggingOut}
            className="w-full mt-2 flex items-center justify-center gap-2 px-2 py-2.5 text-sm rounded-xl text-error bg-error/10 hover:bg-error hover:text-on-error transition-all duration-200 font-bold tracking-wide disabled:opacity-50"
          >
            {isLoggingOut ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Đang đăng xuất...</span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
