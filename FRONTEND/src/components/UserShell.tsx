import React, { useEffect, useRef, useState } from 'react';

import {
  Bell,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
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
  Download,
  Loader2
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { useConfirm } from '../lib/ConfirmContext';
import * as api from '../lib/api';
import type { ChatSession } from '../lib/api';
import { useTheme } from '../lib/ThemeContext';
import { readChatProcessingState, subscribeChatProcessingState } from '../lib/chatActivityStore';
import '../styles/chat-auth.css';
import FullScreenLoader from './FullScreenLoader';
import DocumentPreviewModal from './DocumentPreviewModal';

type UserNav = 'chat' | 'settings';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'rag_ai_sidebar_collapsed_v1';

interface UserShellProps {
  children: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
}


export default function UserShell({ children, isLoading = false, loadingText }: Omit<UserShellProps, 'activeNav'>) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const location = useLocation();
  const activeNav: UserNav = location.pathname.startsWith('/settings') ? 'settings' : 'chat';
  const { theme, setTheme } = useTheme();
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
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; fileType?: string | null } | null>(null);
  const [chatProcessingState, setChatProcessingState] = useState(readChatProcessingState);
  const [animatedProcessingPreview, setAnimatedProcessingPreview] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;

    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const uploadedFiles = modalFiles.filter((file) => !String(file.title || '').startsWith('Bản thảo:'));
  const createdFiles = modalFiles.filter((file) => String(file.title || '').startsWith('Bản thảo:'));
  const visibleFiles = fileTab === 'created' ? createdFiles : uploadedFiles;

  const currentSession = sessions.find(s => s.id === sessionId);

  const handleLogout = () => {
    setShowProfileMenu(false);
    logout();
    navigate('/login', { replace: true });
  };


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
  }, [user, sessionId]);

  useEffect(() => {
    setChatProcessingState(readChatProcessingState());
    const unsubscribe = subscribeChatProcessingState((state) => {
      setChatProcessingState(state);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, isSidebarCollapsed ? '1' : '0');
    } catch {
      // Ignore storage write failures.
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const previewSource = chatProcessingState.statusText || '';

    if (!chatProcessingState.busySessionId || !previewSource.trim()) {
      setAnimatedProcessingPreview('');
      return;
    }

    // During token streaming, statusText already grows naturally character-by-character.
    setAnimatedProcessingPreview(previewSource);
  }, [chatProcessingState.busySessionId, chatProcessingState.statusText]);

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
    <>
      {isHistoryLoading || isLoading ? (
        <FullScreenLoader text={loadingText || 'Đang tải không gian làm việc...'} />
      ) : (
        <div className="bg-background text-on-surface font-body h-screen flex overflow-hidden w-full">
          <aside className={`hidden md:flex h-screen flex-col bg-surface-low py-6 shrink-0 border-r border-outline-variant/20 transition-all duration-300 ease-out relative ${isSidebarCollapsed ? 'w-20 px-2' : 'w-64 px-4'}`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-2 mb-8' : 'justify-between px-4 mb-10'} gap-3`}>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shrink-0 ${isSidebarCollapsed ? '' : 'ml-0'}`}>
                <Hexagon className="w-4 h-4 text-on-primary-fixed" />
              </div>
              {!isSidebarCollapsed && <span className="text-xl font-bold tracking-tight text-primary font-headline">RAG AI</span>}
            </div>

            {/* Floating border toggle — fixed on the sidebar/content border at logo row height */}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className={`fixed top-[40px] -translate-x-1/2 -translate-y-1/2 z-50 w-7 h-7 rounded-md bg-surface border border-outline-variant/50 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest shadow-md transition-[left] duration-300 ease-out flex items-center justify-center ${isSidebarCollapsed ? 'left-20' : 'left-64'}`}
              aria-label={isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              title={isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleNewChat}
              className={`flex items-center w-full py-4 mb-8 bg-surface-container-highest rounded-full transition-transform active:scale-95 group ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-5'}`}
              title={isSidebarCollapsed ? 'Hội thoại mới' : undefined}
            >
              <Plus className="w-5 h-5 text-primary" />
              {!isSidebarCollapsed && <span className="font-semibold text-primary font-label items-center justify-center text-center text-base">HỘI THOẠI MỚI</span>}
            </button>

            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2 min-h-0" ref={chatListRef}>
              {sessions.length === 0 ? (
                <div className={`py-6 text-center ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
                  <p className={`text-xs text-on-surface-variant font-medium opacity-50 ${isSidebarCollapsed ? 'sr-only' : ''}`}>Chưa có cuộc trò chuyện nào</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 w-full">
                  {/* Pinned Chats */}
                  {sessions.filter(s => s.is_pinned).length > 0 && (
                    <div className="flex flex-col gap-2 w-full">
                      {!isSidebarCollapsed && <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest px-4 mb-1">Đã ghim</span>}
                      {sessions.filter(s => s.is_pinned).map(chat => (
                        <div key={chat.id} className="relative group w-full">
                          {(() => {
                            const isChatProcessing = chatProcessingState.busySessionId === chat.id;
                            const processingPreview = isChatProcessing
                              ? (animatedProcessingPreview || chatProcessingState.statusText || 'AI đang xử lý...')
                              : '';

                            return (
                              <Link
                                className={`ui-nav-item py-3 flex ${sessionId === chat.id ? 'ui-nav-item-active' : ''} ${isSidebarCollapsed ? 'items-center justify-center px-2 pr-2 gap-0' : 'items-start px-4 pr-10 gap-3'}`}
                                to={`/chat/${chat.id}`}
                                title={isSidebarCollapsed ? (chat.title || 'Untitled Chat') : undefined}
                              >
                                <Pin className="w-6 h-6 shrink-0 text-primary -rotate-45" fill="currentColor" />
                                {!isSidebarCollapsed && editingSessionId === chat.id ? (
                                  <input
                                    autoFocus
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onBlur={() => saveTitle(chat.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && saveTitle(chat.id)}
                                    onClick={(e) => e.preventDefault()}
                                    className="text-sm font-label bg-transparent outline-none border-b border-primary w-full"
                                  />
                                ) : !isSidebarCollapsed ? (
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-base truncate font-label">{chat.title || 'Untitled Chat'}</span>
                                      {isChatProcessing && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
                                    </div>
                                    {isChatProcessing && (
                                      <p className="mt-0.5 text-[11px] text-primary/90 font-medium truncate">{processingPreview}</p>
                                    )}
                                  </div>
                                ) : null}
                              </Link>
                            );
                          })()}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setActiveChatDropdown(activeChatDropdown === chat.id ? null : chat.id);
                            }}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest rounded-lg opacity-0 group-hover:opacity-100 transition-all font-bold ${isSidebarCollapsed ? 'hidden' : ''}`}
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
                    {!isSidebarCollapsed && <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest px-4 mb-1">Gần đây</span>}
                    {sessions.filter(s => !s.is_pinned).map(chat => (
                      <div key={chat.id} className="relative group w-full">
                        {(() => {
                          const isChatProcessing = chatProcessingState.busySessionId === chat.id;
                          const processingPreview = isChatProcessing
                            ? (animatedProcessingPreview || chatProcessingState.statusText || 'AI đang xử lý...')
                            : '';

                          return (
                            <Link
                              className={`ui-nav-item py-3 flex ${sessionId === chat.id ? 'ui-nav-item-active' : ''} ${isSidebarCollapsed ? 'items-center justify-center px-2 pr-2 gap-0' : 'items-start px-4 pr-10 gap-3'}`}
                              to={`/chat/${chat.id}`}
                              title={isSidebarCollapsed ? (chat.title || 'Hội thoại không tên') : undefined}
                            >
                              <MessageSquare className="w-6 h-6 shrink-0" />
                              {!isSidebarCollapsed && editingSessionId === chat.id ? (
                                <input
                                  autoFocus
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onBlur={() => saveTitle(chat.id)}
                                  onKeyDown={(e) => e.key === 'Enter' && saveTitle(chat.id)}
                                  onClick={(e) => e.preventDefault()}
                                  className="text-sm font-label bg-transparent outline-none border-b border-primary w-full"
                                />
                              ) : !isSidebarCollapsed ? (
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-base truncate font-label">{chat.title || 'Hội thoại không tên'}</span>
                                    {isChatProcessing && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
                                  </div>
                                  {isChatProcessing && (
                                    <p className="mt-0.5 text-[11px] text-primary/90 font-medium truncate">{processingPreview}</p>
                                  )}
                                </div>
                              ) : null}
                            </Link>
                          );
                        })()}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveChatDropdown(activeChatDropdown === chat.id ? null : chat.id);
                          }}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest rounded-lg opacity-0 group-hover:opacity-100 transition-all font-bold ${isSidebarCollapsed ? 'hidden' : ''}`}
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
              <a className={`ui-nav-item py-3 ${isSidebarCollapsed ? 'px-2 justify-center' : 'px-4'}`} href="#" title={isSidebarCollapsed ? 'Trợ giúp' : undefined}>
                <CircleHelp className="w-7 h-7" />
                {!isSidebarCollapsed && <span className="text-base font-label">Trợ giúp</span>}
              </a>
              <Link className={`ui-nav-item py-3 ${isSidebarCollapsed ? 'px-2 justify-center' : 'px-4'} ${activeNav === 'settings' ? 'ui-nav-item-active' : ''}`} to="/settings" title={isSidebarCollapsed ? 'Cài đặt' : undefined}>
                <Settings className="w-7 h-7" />
                {!isSidebarCollapsed && <span className="text-base font-label">Cài đặt</span>}
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
                          onClick={() => { setShowHeaderMenu(false); setFileTab('uploaded'); setShowFilesModal(true); }}
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
                      Đã thêm ({uploadedFiles.length})
                    </button>
                    <button
                      onClick={() => setFileTab('created')}
                      className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${fileTab === 'created' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                    >
                      Đã tạo ({createdFiles.length})
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto min-h-[300px] flex-1 custom-scrollbar">
                    {loadingFiles ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-50 py-10">
                        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                        <p className="text-sm font-medium">Đang tải danh sách tệp...</p>
                      </div>
                    ) : visibleFiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-50 py-10 text-on-surface-variant">
                        <Folders className="w-12 h-12 mb-4 opacity-50" />
                        <p className="font-medium">
                          {fileTab === 'created'
                            ? 'Chưa có tệp nào được tạo từ RAG AI trong đoạn chat này.'
                            : 'Chưa có tệp nào được tải lên trong đoạn chat này.'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {visibleFiles.map(file => {
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
                              onClick={() => setPreviewFile({ name: file.title, url: fileUrl, fileType: file.file_type })}
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
                                download={file.title}
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

            <DocumentPreviewModal
              file={previewFile}
              onClose={() => setPreviewFile(null)}
            />

          </main>
        </div>
      )}
    </>
  );
}
