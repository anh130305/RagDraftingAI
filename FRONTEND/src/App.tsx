import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, RequireAuth, RedirectIfAuth } from './lib/AuthContext';
import { ToastProvider } from './lib/ToastContext';
import FullScreenLoader from './components/FullScreenLoader';
import UserLayout from './components/UserLayout';

const AdminConsoleApp = lazy(() => import('./AdminConsoleApp'));
const Chat = lazy(() => import('./Chat'));
const Login = lazy(() => import('./Login'));
const Register = lazy(() => import('./Register'));
const WorkspaceSettings = lazy(() => import('./Settings'));

function LoadingFallback() {
  return <FullScreenLoader text="Đang tải không gian làm việc..." />;
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/chat" replace />} />

                {/* Public routes — redirect to /chat if already logged in */}
                <Route path="/login" element={<RedirectIfAuth><Login /></RedirectIfAuth>} />
                <Route path="/register" element={<RedirectIfAuth><Register /></RedirectIfAuth>} />

                {/* Protected user routes — share a single persistent UserLayout (sidebar stays alive) */}
                <Route element={<RequireAuth><UserLayout /></RequireAuth>}>
                  <Route path="/chat/:sessionId?" element={<Chat />} />
                  <Route path="/settings" element={<WorkspaceSettings />} />
                  <Route path="/chat/settings" element={<WorkspaceSettings />} />
                </Route>

                {/* Admin console — has its own layout */}
                <Route path="/admin" element={<RequireAuth><AdminConsoleApp /></RequireAuth>} />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/chat" replace />} />
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

