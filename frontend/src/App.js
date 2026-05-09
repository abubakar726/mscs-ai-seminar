import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import JoinPage from './pages/JoinPage';
import VerifyPage from './pages/VerifyPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import PresenterSessionPage from './pages/PresenterSessionPage';
import ParticipantSessionPage from './pages/ParticipantSessionPage';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
      <div className="text-cyan-400 text-sm font-mono animate-pulse">Loading...</div>
    </div>
  );
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
      <div className="text-cyan-400 text-sm font-mono animate-pulse">Loading...</div>
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" />;
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/verify" element={<VerifyPage />} />

      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />

      <Route path="/admin" element={
        <AdminRoute><AdminDashboardPage /></AdminRoute>
      } />

      <Route path="/session/:id/presenter" element={
        <ProtectedRoute><PresenterSessionPage /></ProtectedRoute>
      } />

      <Route path="/session/:id/participant" element={
        <ParticipantSessionPage />
      } />

      <Route path="*" element={
        <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
          <div className="text-center">
            <div className="text-slate-600 text-6xl font-black mb-4">404</div>
            <div className="text-white font-bold">Page not found</div>
            <a href="/" className="text-cyan-400 text-sm mt-2 block hover:underline">Go home</a>
          </div>
        </div>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}