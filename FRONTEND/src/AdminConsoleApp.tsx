import React, { Suspense, lazy, useEffect, useState } from 'react';
import Sidebar, { ViewType } from './components/Sidebar';
import TopBar from './components/TopBar';
import { motion, AnimatePresence } from 'motion/react';
import FullScreenLoader from './components/FullScreenLoader';
import './styles/admin.css';

// Lazy load all admin views
const Dashboard = lazy(() => import('./components/Dashboard'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const KnowledgeBase = lazy(() => import('./components/KnowledgeBase'));
// Prompt setting feature 
const PromptTemplateConfig = lazy(() => import('./components/PromptTemplateConfig'));
const SystemHealth = lazy(() => import('./components/SystemHealth'));
const HelpCenter = lazy(() => import('./components/HelpCenter'));
const Documentation = lazy(() => import('./components/Documentation'));
const Settings = lazy(() => import('./components/Settings'));

const adminViewMap: Record<ViewType, React.LazyExoticComponent<React.ComponentType>> = {
  dashboard: Dashboard,
  users: UserManagement,
  knowledge: KnowledgeBase,
  prompt: PromptTemplateConfig,
  health: SystemHealth,
  help: HelpCenter,
  docs: Documentation,
  settings: Settings,
};

// Preload all lazy components immediately so switching tabs never triggers Suspense
const preloadAllAdminViews = () => {
  import('./components/Dashboard');
  import('./components/UserManagement');
  import('./components/KnowledgeBase');
  import('./components/PromptTemplateConfig');
  import('./components/SystemHealth');
  import('./components/HelpCenter');
  import('./components/Documentation');
  import('./components/Settings');
};

export type ThemeMode = 'light' | 'dark' | 'system';

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [theme, setThemeState] = useState<ThemeMode>(
    () => (localStorage.getItem('auth-theme') as ThemeMode | null) ?? 'system'
  );

  // Persist theme to localStorage so it stays in sync with the rest of the app
  const setTheme = (newTheme: ThemeMode) => {
    localStorage.setItem('auth-theme', newTheme);
    setThemeState(newTheme);
  };

  // Preload all views after the first render so navigation is instant
  useEffect(() => {
    preloadAllAdminViews();
  }, []);

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

  const ActiveView = adminViewMap[activeView];

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        <TopBar theme={theme} setTheme={setTheme} />

        {/* Suspense wraps the entire view area — fallback shows ONCE on initial load only */}
        <Suspense fallback={<FullScreenLoader text="Đang tải trang..." />}>
          <div className="p-6 w-full flex-1 overflow-x-hidden custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                className="w-full h-full flex flex-col"
                key={activeView}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <ActiveView />
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className="p-1 mt-auto border-t border-outline-variant/5 text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/20">
              RAG AI Admin Architecture © 2026. All Rights Reserved.
            </p>
          </footer>
        </Suspense>
      </main>
    </div>
  );
}
