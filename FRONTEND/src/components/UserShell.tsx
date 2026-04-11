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
  MoreVertical,
  Folders,
  X,
  File,
  Download
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { useConfirm } from '../lib/ConfirmContext';
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

type PreviewDocument = api.DocumentResponse & {
  mappedUrl: string;
};

const UserThemeContext = React.createContext<UserThemeContextValue | null>(null);

interface UserShellProps {
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

export default function UserShell({ children, isLoading = false, loadingText }: Omit<UserShellProps, 'activeNav'>) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const location = useLocation();
  const activeNav: UserNav = location.pathname.startsWith('/settings') ? 'settings' : 'chat';
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

  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  const [showFilesModal, setShowFilesModal] = useState(false);
  const [modalFiles, setModalFiles] = useState<api.DocumentResponse[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [fileTab, setFileTab] = useState<'uploaded' | 'created'>('uploaded');
  const [previewFile, setPreviewFile] = useState<PreviewDocument | null>(null);
  const [previewRenderUrl, setPreviewRenderUrl] = useState<string | null>(null);
  const [preparingPreview, setPreparingPreview] = useState(false);
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false);
  const previewObjectUrlRef = useRef<string | null>(null);

  const currentSession = sessions.find(s => s.id === sessionId);

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
    let isMounted = true;
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const data = await api.listSessions();
        if (isMounted) setSessions(data);
      } catch (err) {
        if (isMounted) console.error('Failed to fetch chat history:', err);
      } finally {
        if (isMounted) setIsHistoryLoading(false);
      }
    };

    fetchHistory();

    window.addEventListener('chat_activity_updated', fetchHistory);
    return () => {
      isMounted = false;
      window.removeEventListener('chat_activity_updated', fetchHistory);
    };
  }, [user]);

  useEffect(() => {
    if (!showFilesModal) return;

    let isCancelled = false;

    // File modal in chat context must only show files attached to the current session.
    if (!sessionId) {
      setModalFiles([]);
      setLoadingFiles(false);
      return;
    }

    setLoadingFiles(true);
    api.listDocuments(0, 50, sessionId)
      .then((res) => {
        if (!isCancelled) setModalFiles(res.items);
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to load session files:', err);
          setModalFiles([]);
        }
      })
      .finally(() => {
        if (!isCancelled) setLoadingFiles(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [showFilesModal, sessionId]);

  useEffect(() => {
    setPreviewLoadFailed(false);

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }

    if (!previewFile) {
      setPreviewRenderUrl(null);
      setPreparingPreview(false);
      return;
    }

    const previewKind = api.inferDocumentPreviewKind({
      fileName: previewFile.title,
      fileType: previewFile.file_type,
      filePath: previewFile.mappedUrl,
    });
    const previewSourceUrl = api.getDocumentPreviewUrl(
      previewFile.mappedUrl,
      previewKind,
      previewFile.title,
      previewFile.file_type,
    );

    // For PDF, build a local blob URL to avoid blank previews from remote header/content-type quirks.
    if (previewKind === 'pdf') {
      const controller = new AbortController();
      let cancelled = false;

      const preparePdfPreview = async () => {
        setPreparingPreview(true);
        try {
          const response = await fetch(previewSourceUrl, {
            signal: controller.signal,
            credentials: 'omit',
          });
          if (!response.ok) {
            throw new Error(`Failed to fetch preview file (HTTP ${response.status})`);
          }

          const rawBlob = await response.blob();
          if (cancelled) return;

          const normalizedBlob = rawBlob.type === 'application/pdf'
            ? rawBlob
            : new Blob([rawBlob], { type: 'application/pdf' });

          const objectUrl = URL.createObjectURL(normalizedBlob);
          previewObjectUrlRef.current = objectUrl;
          setPreviewRenderUrl(objectUrl);
        } catch (err) {
          if (!cancelled) {
            console.warn('Unable to prepare local PDF preview. Falling back to source URL.', err);
            setPreviewRenderUrl(previewSourceUrl);
          }
        } finally {
          if (!cancelled) {
            setPreparingPreview(false);
          }
        }
      };

      void preparePdfPreview();

      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    setPreparingPreview(false);
    setPreviewRenderUrl(previewSourceUrl);
    return;
  }, [previewFile]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
  }, []);

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
      const isConfirmed = await confirm({
        title: 'Xóa hội thoại',
        message: 'Bạn có chắc chắn muốn xóa hội thoại này? Toàn bộ nội dung tin nhắn sẽ bị mất vĩnh viễn.',
        confirmLabel: 'Xóa ngay',
        variant: 'danger'
      });

      if (isConfirmed) {
        await api.deleteSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
        if (sessionId === id) navigate('/chat');
        showToast('Đã xóa hội thoại thành công', 'success');
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
      showToast('Không thể xoá cuộc hội thoại.', 'error');
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
      showToast('Không thể ghim/bỏ ghim cuộc hội thoại.', 'error');
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
      showToast('Không thể đổi tên cuộc hội thoại.', 'error');
    } finally {
      setEditingSessionId(null);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setShowHeaderMenu(false);
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
        <div className="bg-background text-on-surface font-body h-screen flex overflow-hidden w-full">
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
              <span className="font-semibold text-primary font-label items-center justify-center text-center text-base">HỘI THOẠI MỚI</span>
            </button>

            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2 min-h-0" ref={chatListRef}>
              {sessions.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-on-surface-variant font-medium opacity-50">Chưa có cuộc trò chuyện nào</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 w-full">
                  {/* Pinned Chats */}
                  {sessions.filter(s => s.is_pinned).length > 0 && (
                    <div className="flex flex-col gap-2 w-full">
                      <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest px-4 mb-1">Đã ghim</span>
                      {sessions.filter(s => s.is_pinned).map(chat => (
                        <div key={chat.id} className="relative group w-full">
                          <Link
                            className={`ui-nav-item py-3 px-4 flex items-center pr-10 ${sessionId === chat.id ? 'ui-nav-item-active' : ''}`}
                            to={`/chat/${chat.id}`}
                          >
                            <Pin className="w-6 h-6 shrink-0 text-primary -rotate-45" fill="currentColor" />
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
                              <span className="text-base truncate font-label">{chat.title || 'Untitled Chat'}</span>
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
                  <div className="flex flex-col gap-2 w-full">
                    <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest px-4 mb-1">Gần đây</span>
                    {sessions.filter(s => !s.is_pinned).map(chat => (
                      <div key={chat.id} className="relative group w-full">
                        <Link
                          className={`ui-nav-item py-3 px-4 flex items-center pr-10 ${sessionId === chat.id ? 'ui-nav-item-active' : ''}`}
                          to={`/chat/${chat.id}`}
                        >
                          <MessageSquare className="w-6 h-6 shrink-0" />
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
                            <span className="text-base truncate font-label">{chat.title || 'Hội thoại không tên'}</span>
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

            <div className="mt-auto pt-4 border-t-2 border-on-surface-variant/10 flex flex-col gap-1">
              <a className="ui-nav-item py-3 px-4" href="#">
                <CircleHelp className="w-7 h-7" />
                <span className="text-base font-label">Trợ giúp</span>
              </a>
              <Link className={`ui-nav-item py-3 px-4 ${activeNav === 'settings' ? 'ui-nav-item-active' : ''}`} to="/settings">
                <Settings className="w-7 h-7" />
                <span className="text-base font-label">Cài đặt</span>
              </Link>
            </div>
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden min-h-0 w-full relative">
            <header className="bg-background/80 backdrop-blur-xl shrink-0 border-b border-outline-variant/20 flex justify-between items-center px-8 w-full z-40 sticky top-0 h-20 transition-all relative">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-on-surface font-headline">RAG AI</span>
              </div>

              {/* Centered Chat Title */}
              {sessionId && currentSession && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[40%] flex items-center gap-2 hidden md:flex">
                  <span className="text-sm font-bold text-on-surface font-label truncate block">
                    {currentSession.title || 'Hội thoại không tên'}
                  </span>
                  {currentSession.is_pinned && <Pin className="w-3 h-3 text-on-surface-variant fill-on-surface-variant shrink-0" />}
                </div>
              )}
              <div className="flex items-center gap-4">
                {/* 3-dots Menu cho Chat Header */}
                {sessionId && currentSession && (
                  <div className="relative" ref={headerMenuRef}>
                    <button
                      className="px-2 py-2 rounded-lg border border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-all"
                      onClick={() => setShowHeaderMenu((prev) => !prev)}
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {showHeaderMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-surface border border-outline-variant/50 rounded-lg shadow-[0_4px_18px_rgba(0,0,0,0.12)] overflow-hidden py-1 z-50">
                        <button
                          onClick={() => { setShowHeaderMenu(false); setShowFilesModal(true); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-high transition-colors text-on-surface font-medium"
                        >
                          <Folders className="w-4 h-4" /> Tra cứu Tệp
                        </button>
                        <button
                          onClick={() => { setShowHeaderMenu(false); togglePinSession(currentSession.id, currentSession.is_pinned); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-high transition-colors text-on-surface font-medium"
                        >
                          <Pin className="w-4 h-4" /> {currentSession.is_pinned ? 'Bỏ ghim' : 'Ghim đoạn chat'}
                        </button>
                        <button
                          onClick={() => { setShowHeaderMenu(false); startEditing(currentSession.id, currentSession.title || ''); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-high transition-colors text-on-surface font-medium"
                        >
                          <Edit2 className="w-4 h-4" /> Đổi tên
                        </button>
                        <button
                          onClick={() => { setShowHeaderMenu(false); deleteSession(currentSession.id); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-error/10 transition-colors text-error font-bold"
                        >
                          <Trash2 className="w-4 h-4" /> Xoá hội thoại
                        </button>
                      </div>
                    )}
                  </div>
                )}

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

            {/* Modal Tệp */}
            {showFilesModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-surface border border-outline-variant rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                  <div className="px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-low">
                    <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                      <Folders className="w-5 h-5 text-primary" />
                      Tra cứu tệp đính kèm
                    </h3>
                    <button onClick={() => setShowFilesModal(false)} className="p-2 bg-surface-high hover:bg-surface-highest rounded-full text-on-surface-variant transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-4 px-6 border-b border-outline-variant/30 bg-surface-lowest">
                    <button
                      onClick={() => setFileTab('uploaded')}
                      className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${fileTab === 'uploaded' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                    >
                      Đã thêm
                    </button>
                    <button
                      onClick={() => setFileTab('created')}
                      className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${fileTab === 'created' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                    >
                      Đã tạo
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto min-h-[300px] flex-1 custom-scrollbar">
                    {loadingFiles ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-50 py-10">
                        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                        <p className="text-sm font-medium">Đang tải danh sách tệp...</p>
                      </div>
                    ) : modalFiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-50 py-10 text-on-surface-variant">
                        <Folders className="w-12 h-12 mb-4 opacity-50" />
                        <p className="font-medium">Chưa có tệp nào được lưu trữ.</p>
                      </div>
                    ) : fileTab === 'created' ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-50 py-10 text-on-surface-variant">
                        <File className="w-12 h-12 mb-4 opacity-50" />
                        <p className="font-medium">Bạn chưa tạo tệp nào từ RAG AI.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {modalFiles.map(file => {
                          const fileUrl = api.resolveDocumentFileUrl(file.file_path);
                          const fileKind = api.inferDocumentPreviewKind({
                            fileName: file.title,
                            fileType: file.file_type,
                            filePath: fileUrl,
                          });
                          const downloadUrl = api.getDocumentDownloadUrl(fileUrl, fileKind, file.title, file.file_type);
                          return (
                            <div
                              key={file.id}
                              onClick={() => setPreviewFile({ ...file, mappedUrl: fileUrl })}
                              className="p-3 rounded-xl border border-outline-variant/50 bg-surface-high flex items-start gap-3 hover:border-primary/30 transition-colors group cursor-pointer"
                            >
                              <div className="p-2.5 bg-surface rounded-lg text-primary shrink-0">
                                <File className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1 py-0.5">
                                <p className="font-bold text-sm text-on-surface truncate pr-2" title={file.title}>{file.title}</p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-on-surface-variant">
                                  <span>{file.file_size ? (file.file_size / 1024).toFixed(0) + ' KB' : 'Unknown'}</span>
                                  <span>•</span>
                                  <span>{new Date(file.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <a
                                title="Tải xuống tệp gốc"
                                href={downloadUrl}
                                download
                                onClick={(e) => e.stopPropagation()}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Xem trước (Preview) */}
            {previewFile && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md animate-in fade-in duration-200">
                <div className="bg-surface border border-outline-variant rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-5 py-3 border-b border-outline-variant/30 flex justify-between items-center bg-surface-low">
                    <h3 className="font-bold text-on-surface truncate flex-1 pr-4">{previewFile.title}</h3>
                    <div className="flex items-center gap-3">
                      <a
                        href={api.getDocumentDownloadUrl(
                          previewFile.mappedUrl,
                          api.inferDocumentPreviewKind({
                            fileName: previewFile.title,
                            fileType: previewFile.file_type,
                            filePath: previewFile.mappedUrl,
                          }),
                          previewFile.title,
                          previewFile.file_type,
                        )}
                        download
                        className="flex items-center gap-2 px-4 py-1.5 bg-primary text-on-primary hover:bg-primary/90 rounded-lg transition-colors text-sm font-semibold"
                      >
                        <Download className="w-4 h-4" /> Tải về
                      </a>
                      <button onClick={() => setPreviewFile(null)} className="p-2 bg-surface hover:bg-surface-highest rounded-full text-on-surface-variant transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden bg-surface-lowest flex items-center justify-center relative">
                    {(() => {
                      const previewKind = api.inferDocumentPreviewKind({
                        fileName: previewFile.title,
                        fileType: previewFile.file_type,
                        filePath: previewFile.mappedUrl,
                      });
                      const isWord = previewKind === 'word';
                      const isPDF = previewKind === 'pdf';
                      const inlineUrl = api.getDocumentPreviewUrl(
                        previewFile.mappedUrl,
                        previewKind,
                        previewFile.title,
                        previewFile.file_type,
                      );
                      const downloadUrl = api.getDocumentDownloadUrl(
                        previewFile.mappedUrl,
                        previewKind,
                        previewFile.title,
                        previewFile.file_type,
                      );
                      const finalUrl = previewRenderUrl || inlineUrl;

                      if (preparingPreview) {
                        return (
                          <div className="flex flex-col items-center gap-4 py-16 text-center px-8">
                            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            <h4 className="text-base font-bold">Đang chuẩn bị bản xem trước...</h4>
                            <p className="font-medium text-on-surface-variant">Hệ thống đang tối ưu tệp để hiển thị trong trình duyệt.</p>
                          </div>
                        );
                      }

                      if (isWord) {
                        return (
                          <div className="flex flex-col items-center gap-4 py-16">
                            <File className="w-20 h-20 text-primary opacity-50" />
                            <h4 className="text-xl font-bold">Không thể xem trước tệp trực tiếp</h4>
                            <p className="font-medium text-on-surface-variant mb-4">
                              Trình duyệt không hỗ trợ xem trước tệp Microsoft Word (.docx).<br />
                              Vui lòng sử dụng tính năng bên dưới để tải tệp về thiết bị.
                            </p>
                            <a
                              href={downloadUrl}
                              download
                              className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                            >
                              Tải xuống tài liệu gốc
                            </a>
                          </div>
                        );
                      }

                      if (isPDF) {
                        return (
                          <div className="w-full h-full relative">
                            <iframe
                              src={finalUrl}
                              title="PDF Preview"
                              className="w-full h-full border-none"
                              onLoad={() => setPreviewLoadFailed(false)}
                            />
                            {previewLoadFailed && (
                              <div className="absolute inset-0 bg-surface-lowest/95 flex flex-col items-center justify-center text-center px-6 gap-3">
                                <p className="font-semibold text-on-surface">Không thể hiển thị PDF trực tiếp trong khung xem trước.</p>
                                <a
                                  href={inlineUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary/90 transition-colors"
                                >
                                  Mở trong tab mới
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (previewKind === 'image') {
                        return (
                          <div className="w-full h-full flex items-center justify-center p-4 bg-surface-lowest">
                            <img
                              src={finalUrl}
                              alt={previewFile.title}
                              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                              onLoad={() => setPreviewLoadFailed(false)}
                              onError={() => setPreviewLoadFailed(true)}
                            />
                            {previewLoadFailed && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-3">
                                <p className="font-semibold text-on-surface">Không thể tải hình ảnh xem trước.</p>
                                <a
                                  href={inlineUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary/90 transition-colors"
                                >
                                  Mở ảnh gốc
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Default iframe for other types (Text, etc.)
                      return (
                        <div className="w-full h-full relative">
                          <iframe
                            src={finalUrl}
                            className="w-full h-full border-none bg-white"
                            title="Document Preview"
                            onLoad={() => setPreviewLoadFailed(false)}
                          />
                          {previewLoadFailed && (
                            <div className="absolute inset-0 bg-surface-lowest/95 flex flex-col items-center justify-center text-center px-6 gap-3">
                              <p className="font-semibold text-on-surface">Không thể hiển thị xem trước trực tiếp cho tệp này.</p>
                              <a
                                href={inlineUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary/90 transition-colors"
                              >
                                Mở trong tab mới
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>
      )}
    </UserThemeContext.Provider>
  );
}
