import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Shield, Users } from 'lucide-react';
import { apiInstance } from '../api';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState('admin');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
    if (selectedRole === 'admin') {
      setUsername('admin');
      setPassword('password'); // Hardcoded default for ease of testing
    } else {
      setUsername('sales');
      setPassword('password'); // Hardcoded default for ease of testing
    }
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await apiInstance.post('/api/auth/login', { username, password });
      const data = response.data;
      
      if (data.success) {
        login(data.user, data.token);
        navigate('/');
      } else {
        setError(data.error || 'Invalid username or password. Please try again.');
        setIsLoading(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Connection error. Is the server running?');
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#F8FAFC',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.04) 0%, transparent 60%)',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div 
        style={{ 
          width: '520px', 
          backgroundColor: '#FFFFFF', 
          borderRadius: '20px', 
          padding: '48px', 
          boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
          border: '1px solid #E2E8F0',
          transition: 'all 0.2s ease-in-out',
          animation: 'fadeIn 0.5s ease-out'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            backgroundColor: 'rgba(16, 185, 129, 0.1)', 
            borderRadius: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 24px auto'
          }}>
            <Shield size={32} color="#10B981" />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            TGM PANDI CAFE
          </h2>
          <p style={{ color: '#64748B', fontSize: '16px', margin: 0 }}>
            Sign in to continue
          </p>
        </div>

        {/* Role Selector */}
        <div style={{ 
          display: 'flex', 
          backgroundColor: '#F1F5F9', 
          padding: '6px', 
          borderRadius: '12px', 
          marginBottom: '32px' 
        }}>
          <button 
            type="button"
            onClick={() => handleRoleChange('admin')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: role === 'admin' ? '#10B981' : 'transparent',
              color: role === 'admin' ? '#FFFFFF' : '#64748B',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Shield size={18} /> Admin
          </button>
          <button 
            type="button"
            onClick={() => handleRoleChange('sales')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: role === 'sales' ? '#10B981' : 'transparent',
              color: role === 'sales' ? '#FFFFFF' : '#64748B',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Users size={18} /> Sales
          </button>
        </div>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {error && (
            <div style={{ backgroundColor: '#FEF2F2', color: '#EF4444', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, border: '1px solid #FCA5A5' }}>
              {error}
            </div>
          )}

          {/* Username Field */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '8px' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }}>
                <User size={20} />
              </div>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username" 
                required 
                style={{
                  width: '100%',
                  padding: '16px 16px 16px 48px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  fontSize: '15px',
                  color: '#0F172A',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#10B981'}
                onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '8px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '16px', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }}>
                <Lock size={20} />
              </div>
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                required 
                style={{
                  width: '100%',
                  padding: '16px 48px 16px 48px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  fontSize: '15px',
                  color: '#0F172A',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                  letterSpacing: showPassword ? 'normal' : '2px'
                }}
                onFocus={(e) => e.target.style.borderColor = '#10B981'}
                onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ 
                  position: 'absolute', 
                  top: '50%', 
                  right: '16px', 
                  transform: 'translateY(-50%)', 
                  background: 'none', 
                  border: 'none', 
                  color: '#94A3B8', 
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#64748B' }}>
              <input type="checkbox" defaultChecked style={{ width: '16px', height: '16px', accentColor: '#10B981', cursor: 'pointer' }} />
              Remember me
            </label>
            <span style={{ fontSize: '14px', color: '#10B981', fontWeight: 600, cursor: 'pointer' }}>Forgot Password?</span>
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            style={{ 
              marginTop: '12px', 
              padding: '0',
              height: '56px',
              background: 'linear-gradient(135deg, #10B981 0%, #22C55E 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isLoading ? 0.8 : 1
            }}
            onMouseOver={(e) => {
              if(!isLoading) e.target.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.6)';
            }}
            onMouseOut={(e) => {
              if(!isLoading) e.target.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.4)';
            }}
          >
            {isLoading ? 'Authenticating...' : 'Log in'}
          </button>
        </form>
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

export default Login;
