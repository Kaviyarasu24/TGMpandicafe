import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingBag, Grid3X3, Clock, 
  Package, DollarSign, User, FileText, 
  MessageSquare, Users, BarChart2, Settings, LogOut, Hexagon, BrainCircuit, ScrollText
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  
  const role = user?.role || 'sales';
  const isAdmin = role === 'admin';
  const fullName = user?.full_name || (isAdmin ? 'Admin User' : 'Sales Staff');

  const avatarName = encodeURIComponent(fullName);

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar" style={{ padding: '1.25rem 1rem', overflowY: 'auto' }}>
      
      {/* Brand / Logo */}
      <div className="desktop-only sidebar-hide-collapsed" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', paddingLeft: '0.5rem' }}>
        <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          TGM PANDI CAFE
        </span>
      </div>

      {/* User Profile */}
      <div className="desktop-only sidebar-hide-collapsed" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingLeft: '0.5rem' }}>
        <div style={{ 
          width: '36px', height: '36px', borderRadius: '50%', 
          background: 'var(--primary-glow)', overflow: 'hidden', flexShrink: 0 
        }}>
          <img src={`https://ui-avatars.com/api/?name=${avatarName}&background=10b981&color=fff`} alt="User" style={{ width: '100%', height: '100%' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, textTransform: 'capitalize' }}>
            {fullName}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 500, textTransform: 'capitalize' }}>
            {role}
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="nav-links" style={{ gap: '0.2rem' }}>
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={18} /> <span className="desktop-only">Dashboard</span>
        </NavLink>
        <NavLink to="/billing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <ShoppingBag size={18} /> <span className="desktop-only">Billing</span>
        </NavLink>
        <NavLink to="/menu" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Grid3X3 size={18} /> <span className="desktop-only">Menu Manager</span>
        </NavLink>
        
        {/* Offering Section */}
        <div className="desktop-only sidebar-hide-collapsed" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 600, marginTop: '1.25rem', marginBottom: '0.5rem', paddingLeft: '1rem' }}>
          Offering
        </div>
        
        {isAdmin && (
          <NavLink to="/purchases" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Package size={18} /> <span className="desktop-only">Purchases</span>
          </NavLink>
        )}
        
        <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Clock size={18} /> <span className="desktop-only">Order History</span>
        </NavLink>

        {/* Back Office Section */}
        {isAdmin && (
          <>
            <div className="desktop-only sidebar-hide-collapsed" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 600, marginTop: '1.25rem', marginBottom: '0.5rem', paddingLeft: '1rem' }}>
              Back Office
            </div>
            <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <BarChart2 size={18} /> <span className="desktop-only">Reports</span>
            </NavLink>
            <NavLink to="/admin/audit-logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <ScrollText size={18} /> <span className="desktop-only">Activity Log</span>
            </NavLink>
            <NavLink to="/admin/ai-analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{
              background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.1) 0%, transparent 100%)',
              borderLeft: '2px solid #8b5cf6',
              color: '#8b5cf6'
            }}>
              <BrainCircuit size={18} color="#8b5cf6" /> <span className="desktop-only" style={{fontWeight: 700}}>AI Analytics</span>
            </NavLink>
          </>
        )}

        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={18} /> <span className="desktop-only">Settings</span>
        </NavLink>

        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <button 
            onClick={handleLogout} 
            className="nav-item" 
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#EF4444' }}
          >
            <LogOut size={18} /> <span className="desktop-only">Logout</span>
          </button>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
