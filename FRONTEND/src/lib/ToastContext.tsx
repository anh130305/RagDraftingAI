import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'system-error';

export interface Toast {
  id: string;
  message: string;
  type?: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => {
      if (prev.some((t) => t.message === message)) {
        return prev;
      }
      return [...prev, { id, message, type }];
    });

    // Auto dismiss after 3s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-6 right-6 z-[99999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl glass-morphism border p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] min-w-[280px] max-w-sm backdrop-blur-xl ${toast.type === 'system-error'
                ? 'bg-error/20 border-error text-on-surface'
                : toast.type === 'error'
                  ? 'bg-error/10 border-error/20 text-on-surface'
                  : toast.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-on-surface'
                    : toast.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/20 text-on-surface'
                      : 'bg-surface/70 border-outline-variant/30 text-on-surface'
                }`}
            >
              <div className="shrink-0 mt-0.5">
                {toast.type === 'system-error' && <XCircle className="w-5 h-5 text-error animate-pulse" />}
                {toast.type === 'error' && <XCircle className="w-5 h-5 text-error" />}
                {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-primary" />}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-medium leading-relaxed">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded-full p-1 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors -m-1"
                aria-label="Đóng thông báo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
