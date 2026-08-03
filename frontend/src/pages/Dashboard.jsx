import React, { useState, useEffect } from 'react';
import { IndianRupee, Receipt, TrendingUp, AlertTriangle, Package, ShoppingBag, TrendingDown, X, Plus } from 'lucide-react';
import { api, socket } from '../api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalBillsToday: 0,
    totalSalesToday: 0,
    totalItemsSold: 0,
    mostSoldItem: 'N/A',
    mostSoldItem: 'N/A',
    lowStockCount: 0,
    lowStockItems: [],
    totalPurchasesToday: 0
  });

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockAddInputs, setStockAddInputs] = useState({});
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  useEffect(() => {
    loadStats();
    const handleUpdate = () => loadStats();
    socket.on('database_update', handleUpdate);
    return () => socket.off('database_update', handleUpdate);
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats", err);
    }
  };

  const handleAddStock = async (item) => {
    const qtyToAdd = parseFloat(stockAddInputs[item.id]);
    if (!qtyToAdd || qtyToAdd <= 0) return;

    try {
      const newItem = {
        ...item,
        stock_count: item.stock_count + qtyToAdd
      };
      await api.updateMenuItem(newItem);
      setStockAddInputs({ ...stockAddInputs, [item.id]: '' });
      loadStats();
      
      // Basic Toast logic could go here
      alert(`Successfully added ${qtyToAdd} to ${item.name}!`);
    } catch (err) {
      alert("Failed to update stock");
      console.error(err);
    }
  };

  const netProfit = stats.totalSalesToday - (stats.totalPurchasesToday || 0);

  const filteredLowStock = (stats.lowStockItems || []).filter(item => {
    return (categoryFilter === 'All' || item.category === categoryFilter) &&
           item.name.toLowerCase().includes(search.toLowerCase());
  });

  const categories = ['All', ...new Set((stats.lowStockItems || []).map(i => i.category))];

  const statCards = [
    { title: "Today's Sales", value: `₹${stats.totalSalesToday.toFixed(2)}`, icon: <IndianRupee size={24} />, color: 'var(--success)' },
    { title: "Today's Purchases", value: `₹${(stats.totalPurchasesToday || 0).toFixed(2)}`, icon: <ShoppingBag size={24} />, color: 'var(--danger)' },
    { title: "Net Profit", value: `₹${netProfit.toFixed(2)}`, icon: netProfit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />, color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' },
    { title: "Total Bills", value: stats.totalBillsToday, icon: <Receipt size={24} />, color: 'var(--primary)' },
    { title: "Items Sold", value: stats.totalItemsSold, icon: <Package size={24} />, color: 'var(--warning)' },
    { title: "Top Item", value: stats.mostSoldItem || 'N/A', icon: <TrendingUp size={24} />, color: '#8b5cf6' },
  ];

  return (
    <div className="page-scroll">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Header Section */}
        <div>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '2rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>Dashboard Overview</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Monitor your cafe's daily performance and key metrics.</p>
        </div>

        {/* Alerts */}
        {stats.lowStockCount > 0 && (
          <div 
            onClick={() => setIsStockModalOpen(true)}
            style={{ 
              background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              padding: '1.25rem 1.5rem', 
              borderRadius: 'var(--r-lg)',
              display: 'flex', alignItems: 'center', gap: '1rem',
              color: 'var(--danger)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            className="hover-lift"
          >
            <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: '50%' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Low Stock Alert</h4>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9, marginTop: '0.2rem' }}>You have <strong style={{color: 'var(--danger)'}}>{stats.lowStockCount}</strong> items running low on stock. Click here to manage.</p>
            </div>
          </div>
        )}

        <div className="stat-cards-grid">
          {statCards.map((card, idx) => (
            <div key={idx} className="card animate-fade-in hover-lift" style={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.75rem', 
              animationDelay: `${idx * 0.1}s`,
              padding: '1.25rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Subtle background glow */}
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', background: card.color, opacity: 0.05, filter: 'blur(30px)', borderRadius: '50%' }} />
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {card.title}
                </div>
                <div style={{ 
                  background: `linear-gradient(135deg, ${card.color}20, ${card.color}10)`, 
                  color: card.color,
                  width: '36px', height: '36px', borderRadius: 'var(--r-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  border: `1px solid ${card.color}30`
                }}>
                  {React.cloneElement(card.icon, { size: 18 })}
                </div>
              </div>

              <div style={{ zIndex: 1, marginTop: '0.25rem' }}>
                <div style={{ 
                  fontSize: card.value.toString().length > 10 ? '1.25rem' : '1.5rem', 
                  fontWeight: 800, 
                  fontFamily: "'Inter', sans-serif", 
                  color: 'var(--text)', 
                  lineHeight: 1,
                  wordBreak: 'break-word'
                }}>
                  {card.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Chart Area Placeholder */}
        <div className="card" style={{ 
          flex: 1, 
          minHeight: '350px', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          color: 'var(--text-muted)',
          background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-surface2) 100%)',
          border: '1px dashed var(--border-strong)'
        }}>
          <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: '50%', marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
            <TrendingUp size={48} opacity={0.3} color="var(--primary)" />
          </div>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '1.5rem', color: 'var(--text)', marginBottom: '0.5rem' }}>Sales Analytics</h3>
          <p style={{ fontSize: '0.95rem' }}>Advanced charts and graphs will be integrated here</p>
        </div>

      </div>

      {/* Low Stock Manager Modal */}
      {isStockModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={() => setIsStockModalOpen(false)}>
          <div className="card modal-container" style={{
            width: '800px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'hidden', 
            display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s var(--ease)',
            border: '1px solid var(--border-strong)', background: 'var(--bg-surface-solid)'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}>
                  <AlertTriangle size={20} color="var(--danger)" /> Manage Low Stock
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{stats.lowStockCount} items need attention</p>
              </div>
              <button className="icon-btn" onClick={() => setIsStockModalOpen(false)}><X size={20} /></button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <input 
                type="text" 
                className="input" 
                placeholder="Search items..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                style={{ flex: 1 }}
              />
              <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: '200px', appearance: 'auto' }}>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredLowStock.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No items found.</div>
              ) : (
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface-solid)', zIndex: 10 }}>
                    <tr>
                      <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Item Name</th>
                      <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Category</th>
                      <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Stock</th>
                      <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Quick Add</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLowStock.map(item => {
                      const isOutOfStock = item.stock_count <= 0;
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>{item.name}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.category}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: isOutOfStock ? 'var(--danger)' : 'var(--warning)' }}>{item.stock_count}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>/ Min {item.min_stock || 10}</span>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ 
                              padding: '0.2rem 0.5rem', 
                              background: isOutOfStock ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                              color: isOutOfStock ? 'var(--danger)' : 'var(--warning)', 
                              borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 
                            }}>
                              {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <input 
                                type="number" 
                                className="input"
                                style={{ width: '80px', padding: '0.25rem 0.5rem' }} 
                                placeholder="Qty" 
                                step="any"
                                value={stockAddInputs[item.id] || ''}
                                onChange={(e) => setStockAddInputs({...stockAddInputs, [item.id]: e.target.value})}
                              />
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '0.25rem 0.75rem' }}
                                onClick={() => handleAddStock(item)}
                              >
                                <Plus size={14} /> Add
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;



