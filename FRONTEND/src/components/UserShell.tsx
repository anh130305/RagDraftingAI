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
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import * as api from '../lib/api';
import type { ChatSession } from '../lib/api';
import '../styles/chat-auth.css';
import FullScreenLoader from './FullScreenLoader';

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
  isLoading?: boolean;
  loadingText?: string;
}

export function useUserTheme() {
  const context = React.useContext(UserThemeContext);

  if (!context) {
    throw new Error('useUserTheme must be used within UserShell');
  }

  return context;
}

export default function UserShell({ activeNav, children, isLoading = false, loadingText }: UserShellProps) {
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
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

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
    const fetchHistory = async () => {
      if (!user) return;
      setIsHistoryLoading(true);
      try {
        const data = await api.listSessions();
        setSessions(data);
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    fetchHistory();

    window.addEventListener('chat_activity_updated', fetchHistory);
    return () => window.removeEventListener('chat_activity_updated', fetchHistory);
  }, [user, sessionId]);

  const handleNewChat = () => {
    navigate('/chat', { replace: true });
    // If the sidebar is open on mobile, maybe close it here if needed.
  };

  const deleteSession = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      if (confirm('Bạn có chắc chắn muốn xóa hội thoại này?')) {
        await api.deleteSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
        if (sessionId === id) navigate('/chat');
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
      alert('Không thể xoá cuộc hội thoại.');
    } finally {
      setActiveChatDropdown(null);
    }
  };

  const togglePinSession = async (id: string, currentPinStatus: boolean, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      const updated = await api.updateSession(id, { is_pinned: !currentPinStatus });
      setSessions(prev => prev.map(s => s.id === id ? { ...s, is_pinned: updated.is_pinned } : s));
    } catch (err) {
      console.error('Failed to pin/unpin session:', err);
      alert('Không thể ghim/bỏ ghim cuộc hội thoại.');
    } finally {
      setActiveChatDropdown(null);
    }
  };

  const startEditing = (id: string, currentTitle: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingSessionId(id);
    setEditingTitle(currentTitle || 'Hội thoại không tên');
    setActiveChatDropdown(null);
  };

  const saveTitle = async (id: string) => {
    try {
      if (editingTitle.trim()) {
        const updated = await api.updateSession(id, { title: editingTitle.trim() });
        setSessions(prev => prev.map(s => s.id === id ? { ...s, title: updated.title } : s));
      }
    } catch (err) {
      console.error('Failed to rename session:', err);
      alert('Không thể đổi tên cuộc hội thoại.');
    } finally {
      setEditingSessionId(null);
    }
  };

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
      {isHistoryLoading || isLoading ? (
        <FullScreenLoader text={loadingText || 'Đang tải không gian làm việc...'} />
      ) : (
        <div className="bg-background text-on-surface font-body min-h-screen flex overflow-hidden w-full">
          <aside className="hidden md:flex h-screen w-64 flex-col bg-surface-low py-6 px-4 shrink-0 border-r border-outline-variant/20">
            <div className="flex items-center gap-3 px-4 mb-10">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
                <Hexagon className="w-4 h-4 text-on-primary-fixed" />
              </div>
              <span className="text-xl font-bold tracking-tight text-primary font-headline">RAG AI</span>
            </div>

            <button
              onClick={handleNewChat}
              className="flex items-center gap-3 w-full px-5 py-4 mb-8 bg-surface-container-highest rounded-full transition-transform active:scale-95 group"
            >
              <Plus className="w-5 h-5 text-primary" />
              <span className="font-semibold text-primary font-label">CHAT MỚI</span>
            </button>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1" ref={chatListRef}>
              {sessions.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-on-surface-variant font-medium opacity-50">Chưa có cuộc trò chuyện nào</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4 w-full">
                  {/* Pinned Chats */}
                  {sessions.filter(s => s.is_pinned).length > 0 && (
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest px-4 mb-1">Đã ghim</span>
                      {sessions.filter(s => s.is_pinned).map(chat => (
                        <div key={chat.id} className="relative group w-full">
                          <Link
                            className={`ui-nav-item flex items-center pr-10 ${sessionId === chat.id ? 'ui-nav-item-active' : ''}`}
                            to={`/chat/${chat.id}`}
                          >
                            <MessageSquare className="w-5 h-5 shrink-0" />
                            {editingSessionId === chat.id ? (
                              <input
                                autoFocus
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={() => saveTitle(chat.id)}
                                onKeyDown={(e) => e.key === 'Enter' && saveTitle(chat.id)}
                                onClick={(e) => e.preventDefault()}
                                className="text-sm font-label bg-transparent outline-none border-b border-primary w-full"
                              />
                            ) : (
                              <span className="text-sm truncate font-label">{chat.title || 'Untitled Chat'}</span>
                            )}
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
                              <button onClick={(e) => togglePinSession(chat.id, chat.is_pinned, e)} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface hover:bg-surface-high transition-colors font-medium">
                                <Pin className="w-4 h-4" /> Bỏ ghim
                              </button>
                              <button onClick={(e) => startEditing(chat.id, chat.title || '', e)} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface hover:bg-surface-high transition-colors font-medium">
                                <Edit2 className="w-4 h-4" /> Đổi tên
                              </button>
                              <button
                                onClick={(e) => deleteSession(chat.id, e)}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors font-bold tracking-wide"
                              >
                                <Trash2 className="w-4 h-4" /> Xoá
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recent Chats */}
                  <div className="flex flex-col gap-1 w-full">
                    <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest px-4 mb-1">Gần đây</span>
                    {sessions.filter(s => !s.is_pinned).map(chat => (
                      <div key={chat.id} className="relative group w-full">
                        <Link
                          className={`ui-nav-item flex items-center pr-10 ${sessionId === chat.id ? 'ui-nav-item-active' : ''}`}
                          to={`/chat/${chat.id}`}
                        >
                          <MessageSquare className="w-5 h-5 shrink-0" />
                          {editingSessionId === chat.id ? (
                            <input
                              autoFocus
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => saveTitle(chat.id)}
                              onKeyDown={(e) => e.key === 'Enter' && saveTitle(chat.id)}
                              onClick={(e) => e.preventDefault()}
                              className="text-sm font-label bg-transparent outline-none border-b border-primary w-full"
                            />
                          ) : (
                            <span className="text-sm truncate font-label">{chat.title || 'Hội thoại không tên'}</span>
                          )}
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
                            <button onClick={(e) => togglePinSession(chat.id, chat.is_pinned, e)} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface hover:bg-surface-high transition-colors font-medium">
                              <Pin className="w-4 h-4" /> Ghim
                            </button>
                            <button onClick={(e) => startEditing(chat.id, chat.title || '', e)} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-on-surface hover:bg-surface-high transition-colors font-medium">
                              <Edit2 className="w-4 h-4" /> Đổi tên
                            </button>
                            <button
                              onClick={(e) => deleteSession(chat.id, e)}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors font-bold tracking-wide"
                            >
                              <Trash2 className="w-4 h-4" /> Xoá
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-auto pt-6 border-t border-outline-variant/10 flex flex-col gap-1">
              <a className="ui-nav-item" href="#">
                <CircleHelp className="w-5 h-5" />
                <span className="text-sm font-label">Trợ giúp</span>
              </a>
              <Link className={`ui-nav-item ${activeNav === 'settings' ? 'ui-nav-item-active' : ''}`} to="/settings">
                <Settings className="w-5 h-5" />
                <span className="text-sm font-label">Cài đặt</span>
              </Link>
            </div>
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-background/80 backdrop-blur-xl shrink-0 border-b border-outline-variant/20 flex justify-between items-center px-8 w-full z-40 sticky top-0 h-20 transition-all relative">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-on-surface font-headline">RAG Architect</span>
              </div>

              {/* Centered Chat Title */}
              {sessionId && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[40%] text-center hidden md:block">
                  <span className="text-sm font-bold text-on-surface font-label truncate block">
                    {sessions.find(s => s.id === sessionId)?.title || 'CHAT MỚI'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-4">
                <button className="ui-icon-btn" title="Thông báo">
                  <Bell className="w-5 h-5" />
                </button>
                <div className="relative" ref={themeMenuRef}>
                  <button
                    className="px-3 py-2 rounded-lg border border-outline-variant/50 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest hover:border-outline transition-all"
                    title="Đổi giao diện"
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
                        <Sun className="w-4 h-4" /> Sáng
                      </button>
                      <button
                        onClick={() => { setTheme('dark'); setShowThemeMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-surface-high transition-colors ${theme === 'dark' ? 'text-primary font-medium' : 'text-on-surface'}`}
                      >
                        <Moon className="w-4 h-4" /> Tối
                      </button>
                      <button
                        onClick={() => { setTheme('system'); setShowThemeMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-surface-high transition-colors ${theme === 'system' ? 'text-primary font-medium' : 'text-on-surface'}`}
                      >
                        <Monitor className="w-4 h-4" /> Hệ thống
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative ml-2" ref={profileMenuRef}>
                  <div
                    className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-primary/20 cursor-pointer bg-primary/10 flex items-center justify-center"
                    onClick={() => setShowProfileMenu((prev) => !prev)}
                    title={user?.username || 'Người dùng'}
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
                        <p className="text-xs text-on-surface-variant mt-0.5 capitalize">{user?.role} · {user?.department || 'Chưa có phòng ban'}</p>
                      </div>
                      <button
                        onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-high transition-colors text-on-surface font-medium"
                      >
                        <Settings className="w-4 h-4" /> Cài đặt
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-error/10 transition-colors text-error font-bold tracking-wide"
                      >
                        <LogOut className="w-4 h-4" /> Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {children}
          </main>
        </div>
      )}
    </UserThemeContext.Provider>
  );
}
