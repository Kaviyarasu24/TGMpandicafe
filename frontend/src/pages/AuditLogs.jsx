import React, { useState, useEffect } from 'react';
import { Search, ShieldCheck, RefreshCw } from 'lucide-react';
import { api, socket } from '../api';

// Color coding per action so admins can scan the trail quickly.
const ACTION_COLORS = {
  create: 'var(--success)',
  update: 'var(--primary)',
  delete: 'var(--danger)',
  void: 'var(--warning, #f59e0b)'
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    try {
      const data = await api.getAuditLogs({ limit: 200 });
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // Refresh whenever any mutating action broadcasts an update.
    const handleUpdate = () => loadLogs();
    socket.on('database_update', handleUpdate);
    return () => socket.off('database_update', handleUpdate);
  }, []);

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    return (
      (log.username || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q) ||
      (log.entity || '').toLowerCase().includes(q) ||
      (log.details || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-scroll">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '2rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>Activity Log</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Audit trail of who changed what across menu, bills, purchases, categories, and users.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '320px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              type="text"
              placeholder="Search user, action, entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>
          <button className="btn btn-outline" onClick={loadLogs} style={{ width: 'auto', flex: '0 0 auto' }}>
            <RefreshCw size={16} /> <span className="desktop-only">Refresh</span>
          </button>
        </div>

        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, border: 'none' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ paddingLeft: '1.5rem' }}>Time</th>
                  <th>User</th>
                  <th className="desktop-only">Role</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th style={{ paddingRight: '1.5rem' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ paddingLeft: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{log.username || '-'}</td>
                    <td className="desktop-only" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{log.role || '-'}</td>
                    <td>
                      <span style={{ padding: '0.25rem 0.6rem', borderRadius: 'var(--r-full)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#fff', background: ACTION_COLORS[log.action] || 'var(--text-muted)' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
                      {log.entity}{log.entity_id ? ` #${log.entity_id}` : ''}
                    </td>
                    <td style={{ paddingRight: '1.5rem', color: 'var(--text-light)', fontSize: '0.9rem', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.details || ''}>
                      {log.details || '-'}
                    </td>
                  </tr>
                ))}
                {!loading && filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <ShieldCheck size={48} opacity={0.3} />
                        <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>No activity recorded yet.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
