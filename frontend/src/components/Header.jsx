import React, { useState, useEffect } from 'react';
import { Search, Sun, Moon, Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

const Header = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const { user } = useAuth();
  
  const role = user?.role || 'sales';
  const isAdmin = role === 'admin';
  const fullName = user?.full_name || (isAdmin ? 'Admin User' : 'Sales Staff');
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const avatarName = encodeURIComponent(fullName);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <header className="header" style={{ padding: '0 1.5rem', height: '64px' }}>
      {/* Left: Spacer (Search Removed) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button 
          onClick={toggleTheme} 
          className="premium-hover"
          style={{ 
            width: '32px', height: '32px', borderRadius: '50%', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-surface2)', border: '1px solid var(--border)', 
            color: 'var(--text-muted)', cursor: 'pointer' 
          }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        
        <div 
          style={{ position: 'relative', display: 'flex', cursor: 'pointer' }} 
          onClick={() => navigate('/settings')}
          title="Settings"
        >
          <img 
            src={`https://ui-avatars.com/api/?name=${avatarName}&background=10b981&color=fff`}
            alt="Profile" 
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          />
          <div style={{ 
            position: 'absolute', bottom: 0, right: 0, 
            width: '10px', height: '10px', 
            background: 'var(--success)', 
            borderRadius: '50%',
            border: '2px solid var(--bg-surface)'
          }}></div>
        </div>
      </div>
    </header>
  );
};

export default Header;



