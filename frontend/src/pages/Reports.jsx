import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Package, Users, DollarSign, Calendar } from 'lucide-react';
import { api } from '../api';

const Reports = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('Today'); // Today, Week, Month

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getBills();
      setBills(data);
    } catch (err) {
      console.error('Failed to load bills', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter bills based on timeframe
  const filteredBills = bills.filter(bill => {
    if (timeframe === 'All Time') return true;
    
    const billDate = new Date(bill.date_time);
    const today = new Date();
    
    if (timeframe === 'Today') {
      return billDate.toDateString() === today.toDateString();
    } else if (timeframe === 'Week') {
      const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return billDate >= oneWeekAgo;
    } else if (timeframe === 'Month') {
      return billDate.getMonth() === today.getMonth() && billDate.getFullYear() === today.getFullYear();
    }
    return true;
  });

  // Calculate stats
  const totalRevenue = filteredBills.reduce((sum, bill) => sum + bill.total, 0);
  const totalOrders = filteredBills.length;
  
  // Top items
  const itemCounts = {};
  filteredBills.forEach(bill => {
    if (bill.items) {
      bill.items.forEach(item => {
        itemCounts[item.item_name] = (itemCounts[item.item_name] || 0) + item.quantity;
      });
    }
  });
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="page-scroll">
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
        
        {/* Header Area */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '2rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>Sales Reports</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Overview of your business performance</p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['Today', 'Week', 'Month', 'All Time'].map(tf => (
              <button 
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--r-full)',
                  border: '1px solid',
                  borderColor: timeframe === tf ? 'var(--primary)' : 'var(--border)',
                  background: timeframe === tf ? 'var(--primary)' : 'var(--bg-surface)',
                  color: timeframe === tf ? '#fff' : 'var(--text)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--primary-glow)', padding: '1rem', borderRadius: '50%', color: 'var(--primary)' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Total Revenue</p>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)' }}>₹{totalRevenue.toFixed(2)}</h3>
            </div>
          </div>
          
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--success-bg)', padding: '1rem', borderRadius: '50%', color: 'var(--success)' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Total Orders</p>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)' }}>{totalOrders}</h3>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--danger-bg)', padding: '1rem', borderRadius: '50%', color: 'var(--danger)' }}>
              <Package size={24} />
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Items Sold</p>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)' }}>
                {Object.values(itemCounts).reduce((a, b) => a + b, 0)}
              </h3>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* Top Items */}
          <div className="card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={18} color="var(--primary)" /> Top Selling Items
            </h3>
            
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading data...</p>
            ) : topItems.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No sales data for this period.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {topItems.map(([name, count], idx) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-muted)', width: '20px' }}>#{idx + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{name}</span>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{count} qty</span>
                      </div>
                      <div style={{ width: '100%', background: 'var(--bg-surface2)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${(count / topItems[0][1]) * 100}%`, background: 'var(--primary)', height: '100%', borderRadius: '99px' }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;



