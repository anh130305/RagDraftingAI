import React, { useState, useRef, useEffect } from 'react';
import { Search, Moon, Sun, Monitor, Bell, Command } from 'lucide-react';
import type { ThemeMode } from '../AdminConsoleApp';
import { cn } from '../lib/utils';

interface TopBarProps {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

export default function TopBar({ theme, setTheme }: TopBarProps) {
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 flex justify-between items-center w-full px-8 h-20 bg-background/80 backdrop-blur-xl border-b border-outline-variant transition-colors duration-300">
      <div className="flex items-center flex-1 max-w-xl">
        <div className="relative w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search systems, users, or models..."
            className="w-full bg-surface-high border border-outline-variant rounded-full py-2.5 pl-11 pr-12 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-on-surface-variant/60 shadow-sm"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-on-surface-variant/50">
            <Command className="w-3 h-3" />
            <span className="text-[10px] font-bold">K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        {/* Theme Toggle */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="px-3 py-2 rounded-lg border border-outline-variant/50 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest hover:border-outline transition-all"
            title="Theme Mode"
          >
            {theme === 'light' ? <Sun className="w-5 h-5" /> : theme === 'dark' ? <Moon className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {showThemeMenu && (
            <div className="absolute right-0 mt-2 w-36 bg-surface border border-outline-variant/50 rounded-lg shadow-[0_4px_18px_rgba(0,0,0,0.12)] overflow-hidden py-1 z-50">
              <button
                onClick={() => { setTheme('light'); setShowThemeMenu(false); }}
                className={cn("w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-surface-high transition-colors", theme === 'light' ? "text-primary font-medium" : "text-on-surface")}
              >
                <Sun className="w-4 h-4" /> Light
              </button>
              <button
                onClick={() => { setTheme('dark'); setShowThemeMenu(false); }}
                className={cn("w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-surface-high transition-colors", theme === 'dark' ? "text-primary font-medium" : "text-on-surface")}
              >
                <Moon className="w-4 h-4" /> Dark
              </button>
              <button
                onClick={() => { setTheme('system'); setShowThemeMenu(false); }}
                className={cn("w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-surface-high transition-colors", theme === 'system' ? "text-primary font-medium" : "text-on-surface")}
              >
                <Monitor className="w-4 h-4" /> System
              </button>
            </div>
          )}
        </div>

        <button className="p-2.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-all relative" title="Notifications">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full border-2 border-background"></span>
        </button>
      </div>
    </header>
  );
}
