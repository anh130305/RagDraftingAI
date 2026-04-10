import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useUserTheme } from './UserShell';

export default function ThemeModeRow() {
  const { theme, setTheme } = useUserTheme();

  return (
    <div className="flex items-center justify-between p-5 bg-surface-container-low rounded-lg transition-all hover:bg-surface-container">
      <div>
        <p className="font-semibold text-on-surface">Chế độ Giao diện</p>
        <p className="text-sm text-on-surface-variant">
          Chế độ hiện tại: <span className="text-primary font-semibold capitalize">{theme}</span>
        </p>
      </div>
      <div className="flex bg-surface-container-highest p-1 rounded-full">
        <button
          className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 ${theme === 'dark' ? 'bg-primary text-on-primary-fixed' : 'text-on-surface-variant'}`}
          onClick={() => setTheme('dark')}
          type="button"
        >
          <Moon className="w-3.5 h-3.5" /> Tối
        </button>
        <button
          className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 ${theme === 'light' ? 'bg-primary text-on-primary-fixed' : 'text-on-surface-variant'}`}
          onClick={() => setTheme('light')}
          type="button"
        >
          <Sun className="w-3.5 h-3.5" /> Sáng
        </button>
        <button
          className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 ${theme === 'system' ? 'bg-primary text-on-primary-fixed' : 'text-on-surface-variant'}`}
          onClick={() => setTheme('system')}
          type="button"
        >
          <Monitor className="w-3.5 h-3.5" /> Hệ thống
        </button>
      </div>
    </div>
  );
}
