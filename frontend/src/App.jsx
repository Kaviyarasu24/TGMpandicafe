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

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const role = localStorage.getItem('role');
  
  if (!role) {
    return <Navigate to="/login" replace />;
  }
  
  if (requireAdmin && role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function AppContent() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  if (isLogin) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
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
            <Route path="/" element={
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
  return <AppContent />;
}

export default App;
