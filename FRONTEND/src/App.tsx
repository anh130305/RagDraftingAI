import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, RequireAuth, RedirectIfAuth } from './lib/AuthContext';

const AdminConsoleApp = lazy(() => import('./AdminConsoleApp'));
const Chat = lazy(() => import('./Chat'));
const Login = lazy(() => import('./Login'));
const Register = lazy(() => import('./Register'));
const WorkspaceSettings = lazy(() => import('./Settings'));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-surface">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm tracking-wide text-on-surface-variant uppercase">Loading workspace...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/chat" replace />} />

              {/* Public routes — redirect to /chat if already logged in */}
              <Route path="/login" element={<RedirectIfAuth><Login /></RedirectIfAuth>} />
              <Route path="/register" element={<RedirectIfAuth><Register /></RedirectIfAuth>} />

              {/* Protected routes — require authentication */}
              <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><WorkspaceSettings /></RequireAuth>} />
              <Route path="/chat/settings" element={<RequireAuth><WorkspaceSettings /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth><AdminConsoleApp /></RequireAuth>} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}
