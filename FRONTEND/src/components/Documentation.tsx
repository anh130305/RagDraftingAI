import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Code, Terminal, FileJson, Copy, CheckCircle2, BookOpen, Layers, ChevronRight, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

const navSections = [
  {
    title: 'Bắt đầu',
    items: ['Giới thiệu', 'Xác thực', 'Hướng dẫn Cài đặt Nhanh']
  },
  {
    title: 'Khái niệm Nhập môn',
    items: ['Models & Endpoints', 'Cửa sổ Ngữ cảnh', 'Embeddings']
  },
  {
    title: 'Tài liệu API',
    items: ['REST API', 'Webhooks', 'Giới hạn Rate', 'Mã Lỗi']
  }
];

export default function Documentation() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col lg:flex-row gap-8 h-full"
    >
      {/* Doc Sidebar */}
      <div className="w-full lg:w-64 shrink-0 space-y-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold font-headline text-on-surface">Khái niệm</h2>
        </div>

        <div className="space-y-6">
          {navSections.map((section, idx) => (
            <div key={idx}>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">{section.title}</h4>
              <ul className="space-y-1">
                {section.items.map((item, itemIdx) => (
                  <li key={itemIdx}>
                    <button className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      item === 'Xác thực' 
                        ? "bg-surface-highest text-primary font-medium" 
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-low"
                    )}>
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Doc Content */}
      <div className="flex-1 glass-card rounded-2xl p-8 lg:p-12 border border-outline-variant overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-6 font-medium">
            <span>Bắt đầu</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary">Xác thực</span>
          </div>

          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-4">Xác thực</h1>
          <p className="text-on-surface-variant leading-relaxed mb-8 text-lg">
            RAG AI API dùng mã bảo vệ để kết nối yêu cầu. Bạn có thể xem và kiểm soát mã bảo vệ của mình trong trang <span className="text-primary cursor-pointer hover:underline">Cài đặt</span>.
          </p>

          <div className="space-y-8">
            <section>
              <h3 className="text-xl font-bold font-headline text-on-surface mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-secondary" />
                Mã bảo vệ
              </h3>
              <p className="text-on-surface-variant leading-relaxed mb-4 text-sm">
                Bảo vệ tới API sẽ thông qua HTTP Bearer Auth. Bạn cần gửi khóa truy xuất như là đoạn mã trong mục tùy chỉnh HTTP headers.
              </p>
              
              <div className="relative group rounded-xl overflow-hidden border border-outline-variant bg-[#0a0a0a]">
                <div className="flex items-center justify-between px-4 py-2 bg-surface-highest border-b border-outline-variant">
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">cURL</span>
                  <button 
                    onClick={handleCopy}
                    className="p-1.5 rounded-md hover:bg-surface-variant text-on-surface-variant transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-sm font-mono text-on-surface-variant">
                    <code className="language-bash">
                      <span className="text-primary">curl</span> https://api.rag.ai/v1/models \<br/>
                      {'  '}-H <span className="text-secondary">"Authorization: Bearer OBS_SECRET_KEY"</span>
                    </code>
                  </pre>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-bold font-headline text-on-surface mb-4">Bảo vệ Khóa</h3>
              <div className="p-5 rounded-xl bg-surface-low border-l-4 border-l-tertiary">
                <h4 className="text-sm font-bold text-on-surface mb-2">Giữ khóa bí mật của bạn</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Vì khóa bảo vệ có thể vượt qua hầu hết rào cản, bạn không nên chia sẻ vào những môi trường như GitHub. 
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-bold font-headline text-on-surface mb-4">Bắt đầu Với Mã</h3>
              <p className="text-on-surface-variant leading-relaxed mb-4 text-sm">
                Chuyên sâu cho nền tảng Node.js và Python đã cho phép việc tạo môi trường và lấy thông tin chỉ bằng 1 câu lệnh.
              </p>
              
              <div className="relative rounded-xl overflow-hidden border border-outline-variant bg-[#0a0a0a]">
                <div className="flex items-center px-4 py-2 bg-surface-highest border-b border-outline-variant gap-4">
                  <span className="text-[10px] font-mono text-primary uppercase tracking-widest border-b border-primary pb-1">Node.js</span>
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest pb-1 cursor-pointer hover:text-on-surface">Python</span>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-sm font-mono text-on-surface-variant">
                    <code className="language-javascript">
                      <span className="text-tertiary">import</span> {'{'} RAG {'}'} <span className="text-tertiary">from</span> <span className="text-secondary">'rag-ai'</span>;<br/><br/>
                      <span className="text-primary">const</span> client = <span className="text-tertiary">new</span> RAG({'{'}<br/>
                      {'  '}apiKey: process.env.<span className="text-on-surface">RAG_API_KEY</span>,<br/>
                      {'}'});
                    </code>
                  </pre>
                </div>
              </div>
            </section>
          </div>
          
          <div className="mt-12 pt-8 border-t border-outline-variant flex justify-between items-center">
            <button className="text-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-2">
              <ChevronRight className="w-4 h-4 rotate-180" />
              Giới thiệu
            </button>
            <button className="text-sm text-primary hover:text-primary-container transition-colors flex items-center gap-2 font-medium">
              Hướng dẫn Cài đặt Nhanh
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
