import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

const AdminConsoleApp = lazy(() => import('./AdminConsoleApp'));
const Chat = lazy(() => import('./Chat'));
const Login = lazy(() => import('./Login'));
const Register = lazy(() => import('./Register'));
const WorkspaceSettings = lazy(() => import('./Settings'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-background text-on-surface">
            <p className="text-sm tracking-wide text-on-surface-variant uppercase">Loading workspace...</p>
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/admin" element={<AdminConsoleApp />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/settings" element={<WorkspaceSettings />} />
          <Route path="/chat/settings" element={<WorkspaceSettings />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
