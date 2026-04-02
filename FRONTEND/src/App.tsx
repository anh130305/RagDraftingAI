import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Chat from './Chat';
import Settings from './Settings';
import Register from './Register';
import Login from './Login';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}
