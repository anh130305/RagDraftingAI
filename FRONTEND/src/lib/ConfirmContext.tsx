import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Info, HelpCircle, X } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'info' | 'warning';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolve, setResolve] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((confirmOptions: ConfirmOptions): Promise<boolean> => {
    setOptions(confirmOptions);
    setIsOpen(true);
    return new Promise((res) => {
      setResolve(() => res);
    });
  }, []);

  const handleCancel = () => {
    setIsOpen(false);
    if (resolve) resolve(false);
  };

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolve) resolve(true);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {isOpen && options && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="absolute inset-0 bg-background/40 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface/80 p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
                  options.variant === 'danger' ? 'bg-error/10 text-error' :
                  options.variant === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                  'bg-primary/10 text-primary'
                }`}>
                  {options.variant === 'danger' && <AlertTriangle className="h-7 w-7" />}
                  {options.variant === 'warning' && <Info className="h-7 w-7" />}
                  {(!options.variant || options.variant === 'info') && <HelpCircle className="h-7 w-7" />}
                </div>

                <h3 className="mb-2 text-xl font-bold text-on-surface font-headline">
                  {options.title || 'Xác nhận hành động'}
                </h3>
                
                <p className="mb-8 text-sm leading-relaxed text-on-surface-variant font-medium">
                  {options.message}
                </p>

                <div className="flex w-full flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleCancel}
                    className="flex-1 rounded-2xl border border-outline-variant/50 bg-surface-container-highest px-6 py-3 text-sm font-bold text-on-surface transition-all hover:bg-surface-highest active:scale-95"
                  >
                    {options.cancelLabel || 'Hủy'}
                  </button>
                  <button
                    onClick={handleConfirm}
                    className={`flex-1 rounded-2xl px-6 py-3 text-sm font-bold text-on-primary-fixed transition-all active:scale-95 shadow-lg ${
                      options.variant === 'danger' ? 'bg-error hover:bg-error/90 shadow-error/20' :
                      'bg-primary hover:bg-primary/90 shadow-primary/20'
                    }`}
                  >
                    {options.confirmLabel || 'Xác nhận'}
                  </button>
                </div>
              </div>

              <button
                onClick={handleCancel}
                className="absolute right-4 top-4 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
