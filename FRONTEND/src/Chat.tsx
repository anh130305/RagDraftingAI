import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Code2,
  Compass,
  History,
  MessageSquare,
  Palette,
  Plus,
  Settings,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Copy,
  Pencil,
  Hexagon,
  Check,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from './lib/api';
import type { ChatMessage } from './lib/api';
import ChatComposer from './components/ChatComposer';
import UserShell from './components/UserShell';

export default function Chat() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const isLanding = !sessionId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState('');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const [composerStatus, setComposerStatus] = useState<string | undefined>(undefined);
  const composerStatusTimerRef = useRef<number | null>(null);

  // Find the index of the latest user message
  const latestUserMsgIndex = [...messages].reverse().findIndex(m => m.role === 'user');
  const latestUserMsgId = latestUserMsgIndex !== -1 ? messages[messages.length - 1 - latestUserMsgIndex].id : null;

  // ── Load messages when sessionId changes ───────────────────
  useEffect(() => {
    if (sessionId) {
      const loadMessages = async () => {
        setIsLoading(true);
        try {
          const data = await api.getMessages(sessionId);
          setMessages(data);
        } catch (err) {
          console.error('Failed to load messages:', err);
        } finally {
          setIsLoading(false);
        }
      };
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  // ── Handle sending message ──────────────────────────────────
  const handleSend = async (content: string) => {
    if (sendingSessionId || statusText) return; // Prevent spam clicks
    let currentId = sessionId;

    // Clear thanh nhập Input ngay sau khi sendMessage
    setComposerValue('');

    try {
      setSendingSessionId(currentId || 'new');

      // Nếu chưa có session, tạo session mới trước
      if (!currentId) {
        const title = content.length > 30 ? content.slice(0, 30) + '...' : content;
        const newSession = await api.createSession(title);
        currentId = newSession.id;
        // Navigation will happen, but we want to keep the "sending" state for this new ID
        setSendingSessionId(currentId);
      }

      // Gửi tin nhắn thực tế (Chỉ có tin nhắn User được lưu ở DB lúc này)
      const userMessage = await api.sendMessage(currentId, content);

      // Cập nhật UI ngay lập tức với tin nhắn của user
      setMessages(prev => [...prev, userMessage]);

      // Nếu là session mới, cập nhật URL
      if (!sessionId && currentId) {
        navigate(`/chat/${currentId}`, { replace: true });
      }

      // Phát sự kiện để Sidebar cập nhật lại thứ tự
      window.dispatchEvent(new Event('chat_activity_updated'));

      // (Giả lập) Đợi phản hồi từ AI trong 10 giây với các thông điệp trạng thái động
      const statuses = [
        "Đang xử lý đầu vào...",
        "Đang phân tích dữ liệu...",
        "Đang truy xuất kiến thức...",
        "Đang chuẩn bị câu trả lời..."
      ];

      for (const status of statuses) {
        setStatusText(status);
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      // SAU 10 GIÂY: Gọi API Mock để Backend lưu tin nhắn AI vào DB
      await api.mockAssistantMessage(currentId);

      // Cập nhật lại danh sách messages từ DB
      const updatedMessages = await api.getMessages(currentId);
      setMessages(updatedMessages);

      // Cập nhật thẻ chat lại trên sidebar (sau 10s)
      window.dispatchEvent(new Event('chat_activity_updated'));

    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Có lỗi xảy ra khi gửi tin nhắn.');
    } finally {
      setSendingSessionId(null);
      setStatusText('');
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleEdit = (content: string) => {
    setComposerValue(content);
  };

  const handleUploadAttachment = async (file: File) => {
    if (sendingSessionId || statusText) return;

    try {
      if (composerStatusTimerRef.current) {
        window.clearTimeout(composerStatusTimerRef.current);
      }

      setComposerStatus(`Đang tải lên ${file.name}...`);
      await api.uploadDocument(file, file.name);
      setComposerStatus(`Đã tải lên ${file.name}`);

      composerStatusTimerRef.current = window.setTimeout(() => {
        setComposerStatus(undefined);
      }, 3000);
    } catch (err) {
      console.error('Failed to upload attachment:', err);
      setComposerStatus(undefined);
      alert('Có lỗi xảy ra khi tải tệp lên.');
      throw err;
    }
  };

  const handleReload = () => {
    if (sendingSessionId || statusText) return; // Prevent spam clicks
    if (messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) handleSend(lastUserMsg.content);
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'like' | 'dislike') => {
    // Optimistic UI update
    const currentMsg = messages.find(m => m.id === messageId);
    if (!currentMsg) return;
    const newFeedback = currentMsg.feedback === feedback ? null : feedback;

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, feedback: newFeedback } : m
    ));

    try {
      await api.submitMessageFeedback(messageId, newFeedback);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      // Revert on error
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, feedback: currentMsg.feedback } : m
      ));
    }
  };

  useEffect(() => {
    return () => {
      if (composerStatusTimerRef.current) {
        window.clearTimeout(composerStatusTimerRef.current);
      }
    };
  }, []);

  return (
    <UserShell activeNav="chat" isLoading={isLoading} loadingText="Đang tải đoạn chat...">
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* Chat Area */}
        <section className="flex-1 flex flex-col items-center px-2 md:px-12 pb-4 overflow-y-auto w-full relative no-scrollbar">
          <AnimatePresence mode="wait">
            {isLanding ? (
              <motion.div
                key="landing-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
                className="w-full flex-1 flex flex-col items-center justify-center min-h-[60vh] py-12"
              >
                <div className="w-full max-w-4xl text-center mb-12">
                  <h1 className="text-5xl md:text-6xl font-extrabold font-headline mb-4 bg-gradient-to-r from-on-surface via-on-surface to-primary bg-clip-text text-transparent">
                    Tôi có thể giúp gì cho bạn hôm nay?
                  </h1>
                  <p className="text-on-surface-variant text-lg max-w-2xl mx-auto font-body">
                    Khai phá sức mạnh của RAG AI để xây dựng, sáng tạo và giải quyết vấn đề. Bạn đang nghĩ gì?
                  </p>
                </div>
                {/* Suggestion Bento Grid */}
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
                  <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                      <Palette className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-sm mb-1">Tạo hình ảnh</p>
                    <p className="text-on-surface-variant text-xs leading-relaxed">Trực quan hoá ý tưởng</p>
                  </div>
                  <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center mb-4 text-secondary group-hover:scale-110 transition-transform">
                      <Code2 className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-sm mb-1">Trợ lý lập trình</p>
                    <p className="text-on-surface-variant text-xs leading-relaxed">Tìm kiếm lỗi và tối ưu kiến trúc</p>
                  </div>
                  <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
                    <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center mb-4 text-tertiary group-hover:scale-110 transition-transform">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-sm mb-1">Viết nội dung</p>
                    <p className="text-on-surface-variant text-xs leading-relaxed">Lên bản nháp chuyên nghiệp</p>
                  </div>
                  <div className="group cursor-pointer p-6 bg-surface-container hover:bg-surface-container-highest rounded-xl transition-all duration-300 border border-transparent hover:border-primary/20">
                    <div className="w-10 h-10 rounded-full bg-primary-fixed-dim/10 flex items-center justify-center mb-4 text-primary-fixed-dim group-hover:scale-110 transition-transform">
                      <Compass className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-sm mb-1">Lên kế hoạch</p>
                    <p className="text-on-surface-variant text-xs leading-relaxed">Sắp xếp các lịch trình chi tiết</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="session-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full flex-1 flex flex-col space-y-6 pt-6"
              >
                <div className="flex flex-col gap-8 w-full">
                  {messages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    const isLatestUser = msg.id === latestUserMsgId;

                    return (
                      <div
                        key={msg.id || idx}
                        className={`flex w-full group animate-in fade-in slide-in-from-bottom-2 duration-300 ${isUser ? 'justify-end' : 'justify-start gap-4'}`}
                      >
                        {!isUser && (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shrink-0 mt-1 shadow-sm border border-primary/20">
                            <Hexagon className="w-4 h-4 text-on-primary-fixed" />
                          </div>
                        )}

                        <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                          <div className={`px-5 py-3 rounded-2xl shadow-sm ${isUser
                            ? 'bg-primary text-on-primary-fixed rounded-tr-none'
                            : 'bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/10'
                            }`}>
                            <p className="text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap font-body">
                              {msg.content}
                            </p>
                          </div>

                          {/* Toolbar */}
                          <div className={`flex items-center gap-1 mt-2 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
                            {isUser ? (
                              <>
                                <button
                                  onClick={() => handleCopy(msg.content, msg.id)}
                                  className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-md transition-all group/btn relative"
                                  title="Sao chép"
                                >
                                  {copyStatus === msg.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                {isLatestUser && (
                                  <button
                                    onClick={() => handleEdit(msg.content)}
                                    className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-md transition-all"
                                    title="Chỉnh sửa"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'like')}
                                  className={`p-1.5 rounded-md transition-all ${msg.feedback === 'like' ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-primary hover:bg-primary/5'}`}
                                  title="Câu trả lời tốt"
                                >
                                  <ThumbsUp className={`w-3.5 h-3.5 ${msg.feedback === 'like' ? 'fill-primary' : ''}`} />
                                </button>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'dislike')}
                                  className={`p-1.5 rounded-md transition-all ${msg.feedback === 'dislike' ? 'text-error bg-error/10' : 'text-on-surface-variant hover:text-error hover:bg-error/5'}`}
                                  title="Câu trả lời tệ"
                                >
                                  <ThumbsDown className={`w-3.5 h-3.5 ${msg.feedback === 'dislike' ? 'fill-error' : ''}`} />
                                </button>
                                <button
                                  onClick={handleReload}
                                  className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-md transition-all"
                                  title="Tạo lại"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleCopy(msg.content, msg.id)}
                                  className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-md transition-all"
                                  title="Sao chép"
                                >
                                  {copyStatus === msg.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {sendingSessionId === (sessionId || 'new') && (
                    <div className="flex justify-start mb-4 animate-in fade-in duration-300 gap-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shrink-0 mt-1 shadow-sm border border-primary/20">
                        <Hexagon className="w-4 h-4 text-on-primary-fixed" />
                      </div>
                      <div className="bg-surface-container-high text-on-surface px-6 py-4 rounded-3xl rounded-tl-none border border-outline-variant/10 shadow-sm flex items-center gap-3">
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={statusText}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{
                              opacity: [0, 1, 0.8, 1],
                              scale: [0.98, 1, 0.99, 1],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              repeatType: "reverse",
                              ease: "easeInOut"
                            }}
                            className="text-sm font-bold text-primary bg-gradient-to-r from-primary via-primary/70 to-primary bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent min-w-[180px]"
                          >
                            {statusText || "Đang chuẩn bị..."}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Fixed Composer Area */}
        <div className="w-full shrink-0 flex justify-center px-2 md:px-12 pb-1">
          <ChatComposer
            onSend={handleSend}
            disabled={!!sendingSessionId}
            value={composerValue}
            onValueChange={setComposerValue}
            onUploadFile={handleUploadAttachment}
            onUploadImage={handleUploadAttachment}
            statusMessage={composerStatus}
          />
        </div>
        {/* Subtle Ambient Background Decorations */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-tertiary/5 rounded-full blur-[120px] -z-10"></div>
      </div>
      {/* Mobile BottomNavBar (Visible only on mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full glass-morphism border-t border-outline-variant/10 flex justify-around items-center h-20 px-4 z-50">
        <a className="flex flex-col items-center gap-1 text-primary" href="#">
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-bold">Trò chuyện</span>
        </a>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <History className="w-5 h-5" />
          <span className="text-[10px] font-bold">Lịch sử</span>
        </a>
        <div className="relative -top-6">
          <button className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-container shadow-xl shadow-primary/20 flex items-center justify-center text-on-primary-fixed">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] font-bold">Khám phá</span>
        </a>
        <a className="flex flex-col items-center gap-1 text-on-surface-variant" href="#">
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-bold">Danh mục</span>
        </a>
      </nav>
    </UserShell>
  );
}
