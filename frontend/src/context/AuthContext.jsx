import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('full_name');
    setUser(null);
  };

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', userData.role);
    localStorage.setItem('username', userData.username);
    localStorage.setItem('full_name', userData.full_name || '');
    setUser(userData);
  };

  useEffect(() => {
    const verifyTokenOnStartup = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        setLoading(false);
        return;
      }
      try {
        const data = await api.verifyToken(token);
        if (data && data.success) {
          setUser(data.user);
          // Sync with local storage
          localStorage.setItem('role', data.user.role);
          localStorage.setItem('username', data.user.username);
          localStorage.setItem('full_name', data.user.full_name || '');
        } else {
          logout();
        }
      } catch (err) {
        console.error('Failed to verify token on startup:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    verifyTokenOnStartup();

    // Listen to global logout events triggered by interceptor
    const handleGlobalLogout = () => {
      setUser(null);
    };
    window.addEventListener('auth-logout', handleGlobalLogout);
    return () => window.removeEventListener('auth-logout', handleGlobalLogout);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
