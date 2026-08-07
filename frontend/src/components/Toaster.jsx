import React from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToast } from '../hooks/useToast';

const TYPE_CONFIG = {
  success: { icon: CheckCircle, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)' },
  error: { icon: XCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  info: { icon: Info, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
};

const Toaster = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      maxWidth: '360px',
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => {
        const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.info;
        const Icon = cfg.icon;
        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.9rem 1rem',
              background: 'var(--bg-surface-solid, #fff)',
              border: `1px solid ${cfg.color}33`,
              borderLeft: `4px solid ${cfg.color}`,
              borderRadius: '10px',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
              animation: 'slideUp 0.25s ease',
              pointerEvents: 'auto',
            }}
          >
            <Icon size={20} color={cfg.color} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text, #0f172a)', fontWeight: 500 }}>
              {t.message}
            </span>
            <button
              onClick={() => removeToast(t.id)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)', display: 'flex', padding: 0 }}
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Toaster;
