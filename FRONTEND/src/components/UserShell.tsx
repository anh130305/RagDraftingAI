import React, { useEffect, useRef, useState } from 'react';

import {
  Bell,
  CircleHelp,
  Hexagon,
  History,
  MessageSquare,
  Monitor,
  Moon,
  Plus,
  Settings,
  Sun,
  Trash2,
  MoreHorizontal,
  Pin,
  Edit2,
  LogOut,
  UserCircle2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import '../styles/chat-auth.css';

type UserNav = 'chat' | 'settings';
type ThemeMode = 'light' | 'dark' | 'system';

interface UserThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const UserThemeContext = React.createContext<UserThemeContextValue | null>(null);

interface UserShellProps {
  activeNav: UserNav;
  children: React.ReactNode;
  showProBadge?: boolean;
}

export function useUserTheme() {
  const context = React.useContext(UserThemeContext);

  if (!context) {
    throw new Error('useUserTheme must be used within UserShell');
  }

  return context;
}

export default function UserShell({ activeNav, children, showProBadge = false }: UserShellProps) {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('auth-theme') as ThemeMode | null;
    return saved || 'dark';
  });
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const [activeChatDropdown, setActiveChatDropdown] = useState<string | null>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    setShowProfileMenu(false);
    logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const root = window.document.documentElement;
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const resolvedTheme =
        theme === 'system' ? (systemThemeQuery.matches ? 'dark' : 'light') : theme;
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    };

    applyTheme();
    localStorage.setItem('auth-theme', theme);

    if (theme === 'system') {
      const handleSystemThemeChange = () => applyTheme();

      if (typeof systemThemeQuery.addEventListener === 'function') {
        systemThemeQuery.addEventListener('change', handleSystemThemeChange);
        return () => systemThemeQuery.removeEventListener('change', handleSystemThemeChange);
      }

      systemThemeQuery.addListener(handleSystemThemeChange);
      return () => systemThemeQuery.removeListener(handleSystemThemeChange);
    }

    return undefined;
  }, [theme]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
      if (chatListRef.current && !chatListRef.current.contains(event.target as Node)) {
        setActiveChatDropdown(null);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <UserThemeContext.Provider value={{ theme, setTheme }}>
      <div className="bg-background text-on-surface font-body min-h-screen flex overflow-hidden w-full">
      <aside className="hidden md:flex h-screen w-64 flex-col bg-surface-low py-6 px-4 shrink-0 border-r border-outline-variant/20">
        <div className="flex items-center gap-3 px-4 mb-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
            <Hexagon className="w-4 h-4 text-on-primary-fixed" />
          </div>
          <span className="text-xl font-bold tracking-tight text-primary font-headline">Obsidian AI</span>
        </div>

        <button className="flex items-center gap-3 w-full px-5 py-4 mb-8 bg-surface-container-highest rounded-full transition-transform active:scale-95 group">
          <Plus className="w-5 h-5 text-primary" />
          <span className="font-semibold text-primary font-label">New Chat</span>
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest px-4 mb-2">Recent Chats</span>
          <div ref={chatListRef} className="flex flex-col gap-1 w-full">
            {[
              { id: '1', title: 'Recent Chat 1' },
              { id: '2', title: 'Recent Chat 2' },
              { id: '3', title: 'Recent Chat 3' },
            ].map(chat => (
              <div key={chat.id} className="relative group w-full">
                <Link className={`ui-nav-item flex items-center pr-10 ${activeNav === 'chat' && chat.id === '1' ? 'ui-nav-item-active' : ''}`} to="/chat">
                  <MessageSquare className="w-5 h-5 shrink-0" />
                  <span className="text-sm truncate font-label">{chat.title}</span>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveChatDropdown(activeChatDropdown === chat.id ? null : chat.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest rounded-lg opacity-0 group-hover:opacity-100 transition-all font-bold"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {activeChatDropdown === chat.id && (
                  <div className="absolute top-10 right-2 w-36 bg-surface border border-outline-variant/50 rounded-lg shadow-[0_4px_18px_rgba(0,0,0,0.12)] overflow-hidden py-1 z-50">
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface hover:bg-surface-high transition-colors font-medium">
                      <Pin className="w-4 h-4" /> Ghim
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface hover:bg-surface-high transition-colors font-medium">
                      <Edit2 className="w-4 h-4" /> Đổi tên
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors font-bold tracking-wide">
                      <Trash2 className="w-4 h-4" /> Xoá
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-outline-variant/10 flex flex-col gap-1">
          <a className="ui-nav-item" href="#">
            <History className="w-5 h-5" />
            <span className="text-sm font-label">Activity</span>
          </a>
          <a className="ui-nav-item" href="#">
            <CircleHelp className="w-5 h-5" />
            <span className="text-sm font-label">Help</span>
          </a>
          <Link className={`ui-nav-item ${activeNav === 'settings' ? 'ui-nav-item-active' : ''}`} to="/settings">
            <Settings className="w-5 h-5" />
            <span className="text-sm font-label">Settings</span>
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-background/80 backdrop-blur-xl border-b border-outline-variant/20 flex justify-between items-center px-8 w-full z-40 sticky top-0 h-16 transition-all">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-on-surface font-headline">Obsidian Architect</span>
            {showProBadge && (
              <span className="bg-tertiary/10 text-tertiary text-[10px] font-bold px-2 py-0.5 rounded-full border border-tertiary/20">PRO</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button className="ui-icon-btn" title="Notifications">
              <Bell className="w-5 h-5" />
            </button>
            <div className="relative" ref={themeMenuRef}>
              <button
                className="px-3 py-2 rounded-lg border border-outline-variant/50 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest hover:border-outline transition-all"
                title="Theme mode"
                onClick={() => setShowThemeMenu((prev) => !prev)}
              >
                <ThemeIcon className="w-5 h-5" />
              </button>

              {showThemeMenu && (
                <div className="absolute right-0 mt-2 w-36 bg-surface border border-outline-variant/50 rounded-lg shadow-[0_4px_18px_rgba(0,0,0,0.12)] overflow-hidden py-1 z-50">
                  <button
                    onClick={() => { setTheme('light'); setShowThemeMenu(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-surface-high transition-colors ${theme === 'light' ? 'text-primary font-medium' : 'text-on-surface'}`}
                  >
                    <Sun className="w-4 h-4" /> Light
                  </button>
                  <button
                    onClick={() => { setTheme('dark'); setShowThemeMenu(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-surface-high transition-colors ${theme === 'dark' ? 'text-primary font-medium' : 'text-on-surface'}`}
                  >
                    <Moon className="w-4 h-4" /> Dark
                  </button>
                  <button
                    onClick={() => { setTheme('system'); setShowThemeMenu(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-surface-high transition-colors ${theme === 'system' ? 'text-primary font-medium' : 'text-on-surface'}`}
                  >
                    <Monitor className="w-4 h-4" /> System
                  </button>
                </div>
              )}
            </div>
            <div className="relative ml-2" ref={profileMenuRef}>
              <div 
                className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-primary/20 cursor-pointer bg-primary/10 flex items-center justify-center"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                title={user?.username || 'User'}
              >
                {user ? (
                  <span className="text-sm font-bold text-primary uppercase">
                    {user.username.slice(0, 2)}
                  </span>
                ) : (
                  <UserCircle2 className="w-5 h-5 text-on-surface-variant" />
                )}
              </div>

              {showProfileMenu && (
                <div className="absolute right-0 mt-3 w-48 bg-surface border border-outline-variant/50 rounded-lg shadow-[0_4px_18px_rgba(0,0,0,0.12)] overflow-hidden py-1 z-50">
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-outline-variant/20">
                    <p className="text-sm font-bold text-on-surface truncate">{user?.username}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5 capitalize">{user?.role} · {user?.department || 'No dept'}</p>
                  </div>
                  <button
                    onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-high transition-colors text-on-surface font-medium"
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-error/10 transition-colors text-error font-bold tracking-wide"
                  >
                    <LogOut className="w-4 h-4" /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {children}
      </main>
      </div>
    </UserThemeContext.Provider>
  );
}
