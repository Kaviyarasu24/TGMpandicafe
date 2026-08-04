import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import MenuManager from './pages/MenuManager';
import History from './pages/History';
import Purchases from './pages/Purchases';
import Login from './pages/Login';
import Reports from './pages/Reports';
import AIAnalytics from './pages/AIAnalytics';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import { AuthProvider } from './context/AuthContext';

function AppContent() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  if (isLogin) {
    return (
      <Routes>
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
      </Routes>
    );
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="page-container">
          <Routes>
            {/* Core POS Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/billing" element={
              <ProtectedRoute>
                <Billing />
              </ProtectedRoute>
            } />
            <Route path="/menu" element={
              <ProtectedRoute>
                <MenuManager />
              </ProtectedRoute>
            } />
            <Route path="/history" element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute>
                <History /> {/* Map orders route to existing History page */}
              </ProtectedRoute>
            } />
            
            {/* Customer route placeholder */}
            <Route path="/customers" element={
              <ProtectedRoute>
                <div style={{
                  padding: '2.5rem',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text)' }}>
                    Customers Management
                  </h2>
                  <p style={{ color: 'var(--text-light)', margin: 0 }}>
                    This module is currently under development. Here you will be able to manage customer profiles, loyalty programs, and dining histories.
                  </p>
                </div>
              </ProtectedRoute>
            } />
            
            {/* Admin Only Routes */}
            <Route path="/purchases" element={
              <ProtectedRoute requireAdmin={true}>
                <Purchases />
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute requireAdmin={true}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/admin/ai-analytics" element={
              <ProtectedRoute requireAdmin={true}>
                <AIAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            
            {/* Catch all unauthenticated / undefined routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
