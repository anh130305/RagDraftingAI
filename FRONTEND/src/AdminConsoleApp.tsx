import React, { Suspense, lazy, useEffect, useState } from 'react';
import Sidebar, { ViewType } from './components/Sidebar';
import TopBar from './components/TopBar';
import { motion, AnimatePresence } from 'motion/react';
import './styles/admin.css';

const Dashboard = lazy(() => import('./components/Dashboard'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const KnowledgeBase = lazy(() => import('./components/KnowledgeBase'));
const MLOpsConfig = lazy(() => import('./components/MLOpsConfig'));
const SystemHealth = lazy(() => import('./components/SystemHealth'));
const HelpCenter = lazy(() => import('./components/HelpCenter'));
const Documentation = lazy(() => import('./components/Documentation'));
const Settings = lazy(() => import('./components/Settings'));

const adminViewMap: Record<ViewType, React.LazyExoticComponent<React.ComponentType>> = {
  dashboard: Dashboard,
  users: UserManagement,
  knowledge: KnowledgeBase,
  mlops: MLOpsConfig,
  health: SystemHealth,
  help: HelpCenter,
  docs: Documentation,
  settings: Settings,
};

export type ThemeMode = 'light' | 'dark' | 'system';

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [theme, setTheme] = useState<ThemeMode>('dark');

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
        
        <div className="p-8 w-full flex-1 overflow-x-hidden custom-scrollbar">
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-2">
                <h2 className="text-lg font-bold text-on-surface">Loading view...</h2>
                <p className="text-sm text-on-surface-variant">Preparing module assets for this section.</p>
              </div>
            }
          >
            <AnimatePresence mode="wait">
              <motion.div
                className="w-full h-full flex flex-col"
                key={activeView}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <ActiveView />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </div>

        <footer className="p-8 mt-auto border-t border-outline-variant/5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/30">
            Obsidian AI Admin Architecture © 2024. All Rights Reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
